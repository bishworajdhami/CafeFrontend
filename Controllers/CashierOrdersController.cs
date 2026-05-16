using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using CafeSystem.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/cashier/orders")]
    [Authorize(Roles = "Cashier,Waiter")]

    public class CashierOrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<OrderHub> _hub;

        public CashierOrdersController(ApplicationDbContext context, IHubContext<OrderHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        private async Task<Setting?> GetSettingCaseInsensitive(string key)
        {
            var lowered = key.ToLower();
            return await _context.Settings.FirstOrDefaultAsync(s => s.Key.ToLower() == lowered);
        }

        public class CreateOrderRequest
        {
            public string OrderType { get; set; } // "dine-in" or "takeaway"
            public string? TableNumber { get; set; }
            public List<OrderItemRequest> Items { get; set; } = new List<OrderItemRequest>();
            public decimal Subtotal { get; set; }
            public decimal Tax { get; set; }
            public decimal ServiceCharge { get; set; } = 0;
            public decimal BookingCharge { get; set; } = 0;
            public decimal Total { get; set; }
            // Booking and Seat Management
            public bool IsBooking { get; set; } = false;
            public int? BookingDurationMinutes { get; set; }

            public string? FloorName { get; set; }
            public int? SeatNumber { get; set; } // Deprecated, kept for backward compatibility
            public List<int>? SeatNumbers { get; set; } // New: Support multiple seats
            public string? CustomerName { get; set; }
            public string? CustomerPhone { get; set; }
            public int? ExistingBookingId { get; set; } // Link to existing active booking
        }

        public class OrderItemRequest
        {
            public int MenuItemId { get; set; }
            public int Quantity { get; set; }
            public string? SpecialRequest { get; set; }
            public decimal Price { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (request == null)
                return BadRequest(new { Status = false, Message = "Invalid order data" });

            // Validate order type
            if (request.OrderType != "dine-in" && request.OrderType != "takeaway")
                return BadRequest(new { Status = false, Message = "Order type must be 'dine-in' or 'takeaway'" });

            // Normalize Seat Inputs: Combine SeatNumber and SeatNumbers
            var targetSeats = new List<int>();
            if (request.SeatNumbers != null && request.SeatNumbers.Any())
            {
                targetSeats.AddRange(request.SeatNumbers);
            }
            else if (request.SeatNumber.HasValue)
            {
                targetSeats.Add(request.SeatNumber.Value);
            }
            // Remove duplicates
            targetSeats = targetSeats.Distinct().ToList();

            // Validate items — allow empty cart if a booking charge is being applied
            if ((request.Items == null || request.Items.Count == 0) &&
                request.BookingCharge <= 0 &&
                !request.IsBooking &&
                !request.ExistingBookingId.HasValue)
                return BadRequest(new { Status = false, Message = "Order must contain at least one item" });

            // Validate amounts
            if (request.Subtotal < 0 || request.Tax < 0 || request.Total < 0)
                return BadRequest(new { Status = false, Message = "Amounts must be non-negative" });

            // Get the current user (cashier) ID from JWT token
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userEmail = User.FindFirst(ClaimTypes.Name)?.Value;
            int? userId = null;

            if (!string.IsNullOrEmpty(userEmail))
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
                userId = user?.Id;
            }

            // Verify all menu items exist and are available (skip for booking-charge-only orders)
            var menuItems = new List<MenuItem>();
            if (request.Items != null && request.Items.Count > 0)
            {
                var menuItemIds = request.Items.Select(i => i.MenuItemId).ToList();
                menuItems = await _context.MenuItems
                    .Where(m => menuItemIds.Contains(m.Id))
                    .ToListAsync();

                if (menuItems.Count != menuItemIds.Count)
                    return BadRequest(new { Status = false, Message = "One or more menu items not found" });

                var unavailableItems = menuItems.Where(m => !m.IsAvailable).ToList();
                if (unavailableItems.Any())
                {
                    var itemNames = string.Join(", ", unavailableItems.Select(m => m.Name));
                    return BadRequest(new { Status = false, Message = $"The following items are unavailable: {itemNames}" });
                }
            }

            // Handle booking and seat assignment
            int? bookingId = null;
            string? finalFloorName = request.FloorName;
            string? finalTableNumber = request.TableNumber;
            int? tableSessionId = null;
            // logic below will populate list of final seats
            
            // Check if manual table selection is enabled
            var manualSelectionSetting = await GetSettingCaseInsensitive("enableManualTableSelection");
            bool manualSelectionEnabled = manualSelectionSetting != null 
                ? bool.Parse(manualSelectionSetting.Value ?? "true") 
                : true; // Default to true if setting doesn't exist

            // Only require/validate table assignment if manual selection is enabled
            if (request.OrderType == "dine-in" && manualSelectionEnabled)
            {
                // If user left fields empty, attempt auto-assignment
                if (string.IsNullOrEmpty(finalTableNumber) || 
                    string.IsNullOrEmpty(finalFloorName) ||
                    targetSeats.Count == 0)
                {
                    // Load table configuration for auto-assignment
                    var tableConfigSetting = await GetSettingCaseInsensitive("TableConfiguration");
                    if (tableConfigSetting == null || string.IsNullOrEmpty(tableConfigSetting.Value))
                    {
                        return BadRequest(new { Status = false, Message = "Table configuration not found. Please set up tables in Manager Settings or disable Manual Table Selection." });
                    }

                    try
                    {
                        var tableConfig = System.Text.Json.JsonSerializer.Deserialize<TableConfiguration>(tableConfigSetting.Value);
                        if (tableConfig != null && tableConfig.floors != null && tableConfig.floors.Any())
                        {
                            var availableParams = await GetRandomAvailableSeat(tableConfig);
                            if (availableParams.HasValue)
                            {
                                finalFloorName = availableParams.Value.Floor;
                                finalTableNumber = availableParams.Value.Table;
                                if (targetSeats.Count == 0)
                                {
                                    targetSeats.Add(availableParams.Value.Seat);
                                }
                            }
                            else
                            {
                                return BadRequest(new { Status = false, Message = "All tables are currently occupied. Please wait or try again later." });
                            }
                        }
                        else
                        {
                            return BadRequest(new { Status = false, Message = "No floors or tables configured. Please set up tables in Manager Settings." });
                        }
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(new { Status = false, Message = $"Error processing table configuration: {ex.Message}" });
                    }
                }
            }
            // If manual selection is OFF, we allow orders without table info - no validation needed


            // Validate walk-in seat selection: block if a named booking already holds the table
            if (!request.IsBooking && !request.ExistingBookingId.HasValue &&
                request.OrderType == "dine-in" &&
                targetSeats.Count > 0 &&
                !string.IsNullOrEmpty(finalFloorName) &&
                !string.IsNullOrEmpty(finalTableNumber))
            {
                var namedBookingExists = await _context.TableBookings
                    .AnyAsync(b => b.FloorName == finalFloorName &&
                                   b.TableNumber == finalTableNumber &&
                                   b.Status == "Active");
                if (namedBookingExists)
                    return BadRequest(new { Status = false, Message = "This table has an active named booking. Walk-in seat booking is not allowed." });

                // Verify none of the requested seats are already occupied by a DIFFERENT order
                // (same seats → handled by merge below; different order seats → reject)
                var occupiedByOther = await _context.TableSeats
                    .Where(s => s.FloorName == finalFloorName &&
                                s.TableNumber == finalTableNumber &&
                                s.Status == "Occupied" &&
                                targetSeats.Contains(s.SeatNumber))
                    .Select(s => new { s.SeatNumber, s.OrderId })
                    .ToListAsync();

                if (occupiedByOther.Any())
                {
                    // Check if ALL overlapping seats belong to one single existing order (= same customer adding items)
                    var distinctOrderIds = occupiedByOther.Select(s => s.OrderId).Distinct().ToList();
                    if (distinctOrderIds.Count > 1)
                    {
                        var seatList = string.Join(", ", occupiedByOther.Select(s => s.SeatNumber).OrderBy(n => n));
                        return BadRequest(new { Status = false, Message = $"Seat(s) {seatList} are already occupied by different orders. Please select different seats." });
                    }
                    // Single order overlap → merge will handle it below
                }
            }

            // If linking to an existing booking
            if (request.ExistingBookingId.HasValue && request.OrderType == "dine-in")
            {
                var existingBookingVal = await _context.TableBookings.FindAsync(request.ExistingBookingId.Value);
                if (existingBookingVal != null &&
                    existingBookingVal.Status == "Active" &&
                    (!existingBookingVal.EndTime.HasValue || existingBookingVal.EndTime > DateTime.UtcNow))
                {
                    bookingId = existingBookingVal.Id;
                    finalFloorName = existingBookingVal.FloorName;
                    finalTableNumber = existingBookingVal.TableNumber;
                    
                    // We don't overwrite seats/customer info as we trust the booking
                    // But maybe we should update Order with Booking's seat info?
                    // targetSeats logic below might need adjustment or we just trust the finalTableNumber linkage
                    
                    // Fetch existing seats for this booking to populate order relations
                    var bookedSeats = await _context.TableSeats
                        .Where(s => s.BookingId == bookingId)
                        .Select(s => s.SeatNumber)
                        .ToListAsync();
                        
                    if (bookedSeats.Any())
                    {
                        targetSeats = bookedSeats;
                    }
                }
                else 
                {
                     return BadRequest(new { Status = false, Message = "Invalid or inactive booking ID provided" });
                }
            }
            // If NEW booking is requested
            else if (request.IsBooking && request.OrderType == "dine-in")
            {
                if (string.IsNullOrEmpty(finalFloorName) || string.IsNullOrEmpty(finalTableNumber))
                {
                    return BadRequest(new { Status = false, Message = "Floor and Table are required for booking" });
                }

                // Phone Validation
                if (string.IsNullOrEmpty(request.CustomerPhone) || !System.Text.RegularExpressions.Regex.IsMatch(request.CustomerPhone, @"^\d{10}$"))
                {
                    return BadRequest(new { Status = false, Message = "Phone number must be exactly 10 digits and contain only numbers." });
                }

                // Phone Ownership Validation
                var existingCustomer = await _context.TableBookings
                    .Where(b => b.CustomerPhone == request.CustomerPhone)
                    .Select(b => b.CustomerName)
                    .FirstOrDefaultAsync();

                if (existingCustomer != null && !string.Equals(existingCustomer, request.CustomerName, StringComparison.OrdinalIgnoreCase))
                {
                     return BadRequest(new { Status = false, Message = $"Phone number {request.CustomerPhone} is already associated with {existingCustomer}. Please use a different number or corrected name." });
                }

                // Whole Table Booking Logic:
                // If booking, we ignore specific `targetSeats` and instead find ALL seats for this table
                // from the configuration to mark them as occupied.
                
                var allSeatsOnTable = new List<int>();
                
                // Retrieve seat count from config to know how many seats to block
                var tableConfigSetting = await GetSettingCaseInsensitive("TableConfiguration");
                if (tableConfigSetting != null && !string.IsNullOrEmpty(tableConfigSetting.Value))
                {
                     try {
                        var tableConfig = System.Text.Json.JsonSerializer.Deserialize<TableConfiguration>(tableConfigSetting.Value);
                        var floorConfig = tableConfig?.floors?.FirstOrDefault(f => f.name == finalFloorName);
                        if (floorConfig != null) {
                            var seatCount = floorConfig.customSeats != null && floorConfig.customSeats.TryGetValue(finalTableNumber, out int customCount)
                                ? customCount
                                : floorConfig.seats;
                            for(int s=1; s <= seatCount; s++) {
                                allSeatsOnTable.Add(s);
                            }
                        }
                     } catch {}
                }

                if (allSeatsOnTable.Count > 0) 
                {
                    targetSeats = allSeatsOnTable;
                }
                else if (targetSeats.Count == 0) // fallback
                {
                    targetSeats.Add(1); 
                }

                var startTime = DateTime.UtcNow;
                var durationMinutes = request.BookingDurationMinutes ?? 60;
                var endTime = startTime.AddMinutes(durationMinutes);

                // Create booking record
                // We'll associate it with the first seat mainly for the record, but the system understands it's the whole table 
                // via the separate TableSeat records we are about to create.
                var booking = new TableBooking
                {
                    FloorName = finalFloorName,
                    TableNumber = finalTableNumber,
                    SeatNumber = targetSeats.FirstOrDefault(), // Representative seat
                    CustomerName = request.CustomerName,
                    CustomerPhone = request.CustomerPhone,
                    StartTime = startTime,
                    EndTime = endTime,
                    DurationMinutes = durationMinutes,

                    Status = "Active"
                };

                _context.TableBookings.Add(booking);
                await _context.SaveChangesAsync();
                bookingId = booking.Id;

                // Create seat reservations for ALL seats at the table
                foreach(var sNum in targetSeats)
                {
                    // Check if already occupied? (Should be checked before, but for now we assume valid)
                    var seat = new TableSeat
                    {
                        FloorName = finalFloorName,
                        TableNumber = finalTableNumber,
                        SeatNumber = sNum,
                        Status = "Occupied",
                        BookingId = booking.Id,
                        OccupiedAt = DateTime.UtcNow
                    };
                    _context.TableSeats.Add(seat);
                }
                await _context.SaveChangesAsync();
            }

            // ── Issue #4: Server-side price validation & recalculation ──
            var allSettings = await _context.Settings.ToListAsync();
            string? GetSetting(string key) => allSettings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase))?.Value;

            var vatPct = decimal.Parse(GetSetting("vatPercentage") ?? "13");
            var vatIncluded = (GetSetting("vatIncluded") ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);
            var scPct = decimal.Parse(GetSetting("serviceChargePercentage") ?? "0");
            var scIncluded = (GetSetting("serviceChargeIncluded") ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);
            var tableBookingCharge = decimal.Parse(GetSetting("tableBookingCharge") ?? "0");
            var tableBookingChargeType = GetSetting("tableBookingChargeType") ?? "flat";

            var utcNow = DateTime.UtcNow;
            var activeDiscounts = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .Where(d => d.Active && d.OfferType != "combo")
                .Where(d => !d.StartDate.HasValue || d.StartDate <= utcNow)
                .Where(d => !d.EndDate.HasValue || d.EndDate >= utcNow)
                .ToListAsync();

            // Build validated items with server-computed prices
            decimal serverSubtotal = 0;
            var validatedItems = new List<(int MenuItemId, string Name, int Quantity, decimal Price, string? SpecialRequest)>();
            foreach (var itemReq in request.Items ?? new List<OrderItemRequest>())
            {
                var mi = menuItems.First(m => m.Id == itemReq.MenuItemId);
                var price = mi.Price;

                var disc = activeDiscounts.FirstOrDefault(d =>
                    d.DiscountMenuItems != null && d.DiscountMenuItems.Any(dmi => dmi.MenuItemId == itemReq.MenuItemId));
                if (disc != null)
                {
                    if (disc.DiscountType == "percentage")
                        price = mi.Price * (1 - disc.Value / 100m);
                    else if (disc.DiscountType == "fixed")
                        price = Math.Max(0, mi.Price - disc.Value);
                }
                price = decimal.Round(price, 2);
                serverSubtotal += price * itemReq.Quantity;
                validatedItems.Add((itemReq.MenuItemId, mi.Name, itemReq.Quantity, price,
                    string.IsNullOrWhiteSpace(itemReq.SpecialRequest) ? null : itemReq.SpecialRequest.Trim()));
            }

            decimal serverTax = vatIncluded ? serverSubtotal - (serverSubtotal / (1 + vatPct / 100m)) : serverSubtotal * (vatPct / 100m);
            decimal serverSC = scIncluded ? serverSubtotal - (serverSubtotal / (1 + scPct / 100m)) : serverSubtotal * (scPct / 100m);
            serverTax = decimal.Round(serverTax, 2);
            serverSC = decimal.Round(serverSC, 2);
            decimal serverBookingCharge = 0;
            if (bookingId.HasValue)
            {
                var linkedBooking = await _context.TableBookings.FindAsync(bookingId.Value);
                if (linkedBooking != null)
                {
                    var duration = Math.Max(1, linkedBooking.DurationMinutes ?? request.BookingDurationMinutes ?? 60);
                    if (tableBookingChargeType == "per_hour")
                        serverBookingCharge = tableBookingCharge * (duration / 60m);
                    else if (tableBookingChargeType == "per_minute")
                        serverBookingCharge = tableBookingCharge * duration;
                    else
                        serverBookingCharge = tableBookingCharge;
                }
            }
            serverBookingCharge = decimal.Round(serverBookingCharge, 2);
            decimal serverTotal = serverSubtotal + (vatIncluded ? 0 : serverTax) + (scIncluded ? 0 : serverSC) + serverBookingCharge;

            // -------------------------------------------------------
            // MERGE: Check for an existing unpaid order at
            // same table/floor before creating a new one (dine-in only)
            // -------------------------------------------------------
            if (request.OrderType == "dine-in" && 
                !string.IsNullOrEmpty(finalFloorName) && 
                !string.IsNullOrEmpty(finalTableNumber))
            {
                // Ensure a session exists for this table (open tab model)
                var existingSession = await _context.TableSessions
                    .OrderByDescending(s => s.OpenedAt)
                    .FirstOrDefaultAsync(s =>
                        s.FloorName == finalFloorName &&
                        s.TableNumber == finalTableNumber &&
                        (s.Status == "Open" || s.Status == "Closing"));

                if (existingSession == null)
                {
                    existingSession = new TableSession
                    {
                        FloorName = finalFloorName,
                        TableNumber = finalTableNumber,
                        Status = "Open",
                        CustomerName = request.CustomerName,
                        CustomerPhone = request.CustomerPhone,
                        BookingId = bookingId,
                        OpenedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.TableSessions.Add(existingSession);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    // Best-effort enrich customer info
                    if (!string.IsNullOrWhiteSpace(request.CustomerName) && string.IsNullOrWhiteSpace(existingSession.CustomerName))
                        existingSession.CustomerName = request.CustomerName;
                    if (!string.IsNullOrWhiteSpace(request.CustomerPhone) && string.IsNullOrWhiteSpace(existingSession.CustomerPhone))
                        existingSession.CustomerPhone = request.CustomerPhone;
                    existingSession.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                tableSessionId = existingSession.Id;

                // Seat-aware merge: if specific seats are provided, only merge into an order
                // whose seats OVERLAP with the incoming seats. No overlap = new independent order.
                Order? existingOrder = null;
                if (targetSeats.Count > 0)
                {
                    var overlappingOrderIds = await _context.TableSeats
                        .Where(s => s.FloorName == finalFloorName &&
                                    s.TableNumber == finalTableNumber &&
                                    s.Status == "Occupied" &&
                                    s.OrderId != null &&
                                    targetSeats.Contains(s.SeatNumber))
                        .Select(s => s.OrderId!.Value)
                        .Distinct()
                        .ToListAsync();

                    if (overlappingOrderIds.Any())
                    {
                        existingOrder = await _context.Orders
                            .Include(o => o.Items)
                            .FirstOrDefaultAsync(o =>
                                overlappingOrderIds.Contains(o.Id) &&
                                o.PaymentStatus == "unpaid" &&
                                o.Status != "Cancelled");
                    }
                }
                else
                {
                    // No specific seats — table-level merge (legacy path: named bookings, etc.)
                    existingOrder = await _context.Orders
                        .Include(o => o.Items)
                        .FirstOrDefaultAsync(o =>
                            o.FloorName == finalFloorName &&
                            o.TableNumber == finalTableNumber &&
                            o.PaymentStatus == "unpaid" &&
                            o.Status != "Cancelled" &&
                            (o.TableSessionId == null || o.TableSessionId == tableSessionId));
                }

                if (existingOrder != null)
                {
                    if (!existingOrder.TableSessionId.HasValue)
                        existingOrder.TableSessionId = tableSessionId;

                    // Append validated items to the existing order
                    foreach (var vi in validatedItems)
                    {
                        var existingItem = existingOrder.Items.FirstOrDefault(i =>
                            i.MenuItemId == vi.MenuItemId &&
                            i.Price == vi.Price &&
                            i.SpecialRequest == vi.SpecialRequest);

                        if (existingItem != null)
                        {
                            existingItem.Quantity += vi.Quantity;
                        }
                        else
                        {
                            _context.OrderItems.Add(new OrderItem
                            {
                                OrderId = existingOrder.Id,
                                MenuItemId = vi.MenuItemId,
                                Name = vi.Name,
                                Quantity = vi.Quantity,
                                Price = vi.Price,
                                SpecialRequest = vi.SpecialRequest
                            });
                        }
                    }

                    // Use server-computed totals (not client-sent)
                    existingOrder.Subtotal += serverSubtotal;
                    existingOrder.Tax += serverTax;
                    existingOrder.ServiceCharge += serverSC;
                    existingOrder.BookingCharge += serverBookingCharge;
                    existingOrder.Total += serverTotal;
                    existingOrder.UpdatedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();

                    var mergedOrder = await _context.Orders
                        .Include(o => o.Items)
                        .FirstOrDefaultAsync(o => o.Id == existingOrder.Id);

                    // Broadcast that order was updated (merge path)
                    await _hub.Clients.All.SendAsync("OrderUpdated", existingOrder.Id);
                    await _hub.Clients.All.SendAsync("NewOrder", existingOrder.Id);
                    await _hub.Clients.All.SendAsync("order.statusChanged", new { orderId = existingOrder.Id, status = existingOrder.Status });
                    await _hub.Clients.All.SendAsync("order.itemsAdded", new { orderId = existingOrder.Id, sessionId = existingOrder.TableSessionId, updatedAt = DateTime.UtcNow });
                    await _hub.Clients.All.SendAsync("session.updated", new { sessionId = tableSessionId, updatedAt = DateTime.UtcNow });

                    return Ok(new
                    {
                        Status = true,
                        Message = "Items added to existing table order",
                        Order = mergedOrder,
                        OrderId = existingOrder.Id,
                        Merged = true,
                        AssignedTable = finalTableNumber,
                        AssignedFloor = finalFloorName,
                        AssignedSeats = targetSeats
                    });
                }
            }

            // Create the order with server-validated prices
            var order = new Order
            {
                UserId = userId,
                TableSessionId = tableSessionId,
                OrderType = request.OrderType,
                TableNumber = request.OrderType == "dine-in" ? finalTableNumber?.Trim() : null,
                Status = "Pending",
                Subtotal = serverSubtotal,
                Tax = serverTax,
                ServiceCharge = serverSC,
                BookingCharge = serverBookingCharge,
                Total = serverTotal,
                PaymentStatus = "unpaid",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                BookingId = bookingId,
                FloorName = finalFloorName,
                SeatNumber = targetSeats.FirstOrDefault()
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // Link Order to Booking and Seats
            if (bookingId.HasValue)
            {
                var booking = await _context.TableBookings.FindAsync(bookingId.Value);
                if (booking != null)
                {
                    booking.OrderId = order.Id;
                }

                var seats = await _context.TableSeats
                    .Where(s => s.BookingId == bookingId.Value)
                    .ToListAsync();
                
                foreach(var s in seats) s.OrderId = order.Id;
                
                await _context.SaveChangesAsync();
            }
            else if (targetSeats.Count > 0 && !string.IsNullOrEmpty(finalFloorName) && !string.IsNullOrEmpty(finalTableNumber))
            {
                 foreach(var sNum in targetSeats)
                 {
                     var seat = new TableSeat
                     {
                         FloorName = finalFloorName,
                         TableNumber = finalTableNumber,
                         SeatNumber = sNum,
                         Status = "Occupied",
                         OrderId = order.Id,
                         OccupiedAt = DateTime.UtcNow
                     };
                     _context.TableSeats.Add(seat);
                 }
                 await _context.SaveChangesAsync();
            }

            // Create order items with validated prices
            foreach (var vi in validatedItems)
            {
                var orderItem = new OrderItem
                {
                    OrderId = order.Id,
                    MenuItemId = vi.MenuItemId,
                    Name = vi.Name,
                    Quantity = vi.Quantity,
                    Price = vi.Price,
                    SpecialRequest = vi.SpecialRequest
                };

                _context.OrderItems.Add(orderItem);
            }

            await _context.SaveChangesAsync();

            // Load the order with items for response
            var createdOrder = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == order.Id);

            // Broadcast new order to kitchen and all cashiers
            await _hub.Clients.All.SendAsync("NewOrder", order.Id);
            await _hub.Clients.All.SendAsync("OrderUpdated", order.Id);
            await _hub.Clients.All.SendAsync("order.created", new { orderId = order.Id, status = order.Status });
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = finalFloorName, tableNumber = finalTableNumber });
            if (tableSessionId.HasValue)
                await _hub.Clients.All.SendAsync("session.updated", new { sessionId = tableSessionId.Value, updatedAt = DateTime.UtcNow });

            return CreatedAtAction(
                nameof(GetOrder), 
                new { id = order.Id }, 
                new { 
                    Status = true, 
                    Message = "Order created successfully", 
                    Order = createdOrder,
                    OrderId = order.Id,
                    AssignedTable = finalTableNumber,
                    AssignedFloor = finalFloorName,
                    AssignedSeats = targetSeats
                });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrder(int id)
        {
            var order = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
                return NotFound(new { Status = false, Message = "Order not found" });

            return Ok(order);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllOrders([FromQuery] bool history = false, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null)
        {
            // Use provided date or fallback to server UTC date
            var cutoffDate = fromDate ?? DateTime.UtcNow.Date;
            
            var query = _context.Orders
                .Include(o => o.Items)
                .AsQueryable();

            if (history)
            {
                // For history, we want a specific range if provided, or just older than today
                if (fromDate.HasValue && toDate.HasValue)
                {
                    query = query.Where(o => o.CreatedAt >= fromDate.Value && o.CreatedAt <= toDate.Value);
                }
                else
                {
                    query = query.Where(o => o.CreatedAt < cutoffDate);
                }
            }
            else
            {
                // Current orders: today onwards
                query = query.Where(o => o.CreatedAt >= cutoffDate);
            }

            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingOrders()
        {
            try
            {
                var orders = await _context.Orders
                    .Include(o => o.Items)
                    .Where(o => (o.PaymentStatus == "unpaid" || o.PaymentStatus == null) && o.Status != "Cancelled")
                    .OrderByDescending(o => o.CreatedAt)
                    .ToListAsync();

                var orderIds = orders.Select(o => o.Id).ToList();
                var seatMappings = await _context.TableSeats
                    .Where(s => s.OrderId != null && orderIds.Contains(s.OrderId.Value))
                    .ToListAsync();

                var sessionIds = orders
                    .Where(o => o.TableSessionId.HasValue)
                    .Select(o => o.TableSessionId!.Value)
                    .Distinct()
                    .ToList();

                var sessions = sessionIds.Any()
                    ? await _context.TableSessions.Where(s => sessionIds.Contains(s.Id)).ToListAsync()
                    : new List<TableSession>();

                var unpaidCharges = sessionIds.Any()
                    ? await _context.TableSessionCharges
                        .Where(c => sessionIds.Contains(c.TableSessionId) && c.Status == "Unpaid")
                        .ToListAsync()
                    : new List<TableSessionCharge>();

                var bookingIds = orders
                    .Where(o => o.BookingId.HasValue)
                    .Select(o => o.BookingId!.Value)
                    .Concat(sessions.Where(s => s.BookingId.HasValue).Select(s => s.BookingId!.Value))
                    .Distinct()
                    .ToList();

                var bookings = bookingIds.Any()
                    ? await _context.TableBookings.Where(b => bookingIds.Contains(b.Id)).ToListAsync()
                    : new List<TableBooking>();

                var allSettings = await _context.Settings.ToListAsync();
                string? GetSetting(string key) => allSettings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase))?.Value;
                decimal.TryParse(GetSetting("tableBookingCharge") ?? "0", out var tableBookingCharge);
                var tableBookingChargeType = GetSetting("tableBookingChargeType") ?? "flat";

                foreach (var order in orders)
                {
                    order.SeatNumbers = seatMappings
                        .Where(s => s.OrderId == order.Id)
                        .Select(s => s.SeatNumber)
                        .OrderBy(n => n)
                        .ToList();

                    var session = order.TableSessionId.HasValue
                        ? sessions.FirstOrDefault(s => s.Id == order.TableSessionId.Value)
                        : null;

                    var sessionChargeTotal = session == null
                        ? 0
                        : unpaidCharges
                            .Where(c => c.TableSessionId == session.Id)
                            .Sum(c => c.Amount);

                    order.UnpaidSessionCharges = sessionChargeTotal;
                    if (sessionChargeTotal > 0)
                    {
                        order.BookingCharge += sessionChargeTotal;
                        order.Total += sessionChargeTotal;
                    }
                }

                return Ok(orders);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Status = false, Message = "Failed to load pending orders: " + ex.Message });
            }
        }

        [Authorize(Roles = "Chef,Cashier,Manager")]
        [HttpGet("kitchen")]
        public async Task<IActionResult> GetKitchenOrders()
        {
            var orders = await _context.Orders
                .Include(o => o.Items)
                .Where(o => (o.Status == "Pending" || o.Status == "Preparing") && o.Status != "Cancelled")
                .OrderBy(o => o.CreatedAt) 
                .ToListAsync();

            return Ok(orders);
        }

        [HttpGet("refundable")]
        public async Task<IActionResult> GetRefundableOrders([FromQuery] DateTime? fromDate = null)
        {
            // Get list of OrderIds that have been fully refunded
            var fullyRefundedOrderIds = await _context.Refunds
                .Where(r => r.RefundType == "full")
                .Select(r => r.OrderId)
                .ToListAsync();

            // Use provided date or fallback to server UTC date
            var cutoffDate = fromDate ?? DateTime.UtcNow.Date;

            // Get orders that are paid and completed (or can be refunded)
            // And exclude fully refunded ones AND cancelled ones
            // Also enforce SAME BUSINESS DAY rule here to filter old orders from the UI
            var orders = await _context.Orders
                .Include(o => o.Items)
                .Where(o => o.PaymentStatus == "paid" 
                            && o.Status != "Cancelled" 
                            && !fullyRefundedOrderIds.Contains(o.Id)
                            && o.CreatedAt >= cutoffDate)
                .OrderByDescending(o => o.CreatedAt)
                .Take(50) 
                .ToListAsync();

            return Ok(orders);
        }

        public class UpdateStatusRequest
        {
            public string Status { get; set; }
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Status))
                return BadRequest(new { Status = false, Message = "Status is required" });

            var order = await _context.Orders.FindAsync(id);
            if (order == null)
                return NotFound(new { Status = false, Message = "Order not found" });

            // Validate status
            var validStatuses = new[] { "Pending", "Preparing", "Ready", "Completed", "Cancelled" };
            if (!validStatuses.Contains(request.Status, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { Status = false, Message = "Invalid status value" });

            order.Status = request.Status;

            // Set ReadyAt timestamp when order becomes Ready
            if (request.Status.Equals("Ready", StringComparison.OrdinalIgnoreCase) && order.ReadyAt == null)
            {
                order.ReadyAt = DateTime.UtcNow;

                // Update seat auto-release time (30 minutes after ready)
                var seat = await _context.TableSeats
                    .FirstOrDefaultAsync(s => s.OrderId == order.Id);
                if (seat != null)
                {
                    seat.ReadyAt = DateTime.UtcNow;
                    seat.AutoReleaseAt = DateTime.UtcNow.AddMinutes(30);
                }
            }
            else if (request.Status.Equals("Completed", StringComparison.OrdinalIgnoreCase) || 
                     request.Status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
            {
                // Release associated seats
                var seats = await _context.TableSeats
                    .Where(s => s.OrderId == order.Id)
                    .ToListAsync();

                foreach (var seat in seats)
                {
                    seat.Status = "Available";
                    seat.OrderId = null;
                    seat.OccupiedAt = null;
                    seat.ReadyAt = null;
                    seat.AutoReleaseAt = null;
                }

                // If the order has an associated booking, complete or cancel it
                if (order.BookingId.HasValue)
                {
                    var booking = await _context.TableBookings.FindAsync(order.BookingId.Value);
                    if (booking != null && booking.Status != "Cancelled" && booking.Status != "Completed")
                    {
                        booking.Status = request.Status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase) ? "Cancelled" : "Completed";
                        if (booking.Status == "Completed")
                        {
                            booking.EndTime = DateTime.UtcNow;
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();

            // Broadcast status change to kitchen + cashier queues
            await _hub.Clients.All.SendAsync("OrderUpdated", id);
            await _hub.Clients.All.SendAsync("order.statusChanged", new { orderId = id, status = order.Status });
            if (request.Status.Equals("Ready", StringComparison.OrdinalIgnoreCase))
            {
                await _hub.Clients.All.SendAsync("order.ready", new { orderId = id, floorName = order.FloorName, tableNumber = order.TableNumber });
            }
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = order.FloorName, tableNumber = order.TableNumber });

            return Ok(new { Status = true, Message = "Order status updated successfully", Order = order });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var order = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
                return NotFound(new { Status = false, Message = "Order not found" });

            // Validate: only allow deletion of unpaid orders
            if (order.PaymentStatus == "paid")
                return BadRequest(new { Status = false, Message = "Cannot delete a paid order" });

            // Release associated seats before deleting order
            var seats = await _context.TableSeats
                .Where(s => s.OrderId == order.Id)
                .ToListAsync();

            foreach (var seat in seats)
            {
                seat.Status = "Available";
                seat.OrderId = null;
                seat.OccupiedAt = null;
                seat.ReadyAt = null;
                seat.AutoReleaseAt = null;
            }

            // Cancel associated booking if exists
            if (order.BookingId.HasValue)
            {
                var booking = await _context.TableBookings.FindAsync(order.BookingId.Value);
                if (booking != null && booking.Status != "Cancelled" && booking.Status != "Completed")
                {
                    booking.Status = "Cancelled";
                }
            }

            // Delete order items first
            _context.OrderItems.RemoveRange(order.Items);
            
            // Delete the order
            _context.Orders.Remove(order);
            
            await _context.SaveChangesAsync();

            // Broadcast order deletion to all connected clients
            await _hub.Clients.All.SendAsync("OrderUpdated", id);
            await _hub.Clients.All.SendAsync("order.statusChanged", new { orderId = id, status = "Deleted" });
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = order.FloorName, tableNumber = order.TableNumber });

            return Ok(new { Status = true, Message = "Order deleted successfully" });
        }

        // Helper classes for table configuration
        public class TableConfiguration
        {
            public List<FloorConfig>? floors { get; set; }
        }

        public class FloorConfig
        {
            public int id { get; set; }
            public string name { get; set; } = "";
            public int tableCount { get; set; }
            public int seats { get; set; } = 4;
            public Dictionary<string, int>? customSeats { get; set; } // Per-table seat overrides
        }

        private async Task<(string Floor, string Table, int Seat)?> GetRandomAvailableSeat(TableConfiguration config)
        {
            // Get all occupied seats
            var occupiedSeats = await _context.TableSeats
                .Where(s => s.Status == "Occupied")
                .ToListAsync();

            var availableOptions = new List<(string Floor, string Table, int Seat)>();

            if (config.floors != null)
            {
                foreach (var floor in config.floors)
                {
                    for (int t = 1; t <= floor.tableCount; t++)
                    {
                        for (int s = 1; s <= floor.seats; s++)
                        {
                            string tableNum = t.ToString();
                            // Check if this seat is occupied
                            bool isOccupied = occupiedSeats.Any(os => 
                                os.FloorName == floor.name && 
                                os.TableNumber == tableNum && 
                                os.SeatNumber == s);
                            
                            if (!isOccupied)
                            {
                                availableOptions.Add((floor.name, tableNum, s));
                            }
                        }
                    }
                }
            }

            if (availableOptions.Count > 0)
            {
                var random = new Random();
                return availableOptions[random.Next(availableOptions.Count)];
            }

            return null;
        }
    }
}

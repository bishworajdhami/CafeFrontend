using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using Microsoft.AspNetCore.SignalR;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/sessions")]
    [Authorize(Roles = "Cashier,Waiter,Manager,Chef")]
    public class TableSessionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<OrderHub> _hub;

        public TableSessionsController(ApplicationDbContext context, IHubContext<OrderHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        public class OpenSessionRequest
        {
            public string FloorName { get; set; } = "";
            public string TableNumber { get; set; } = "";
            public string Mode { get; set; } = "walkin"; // walkin | named
            public string? CustomerName { get; set; }
            public string? CustomerPhone { get; set; }
            public int? BookingId { get; set; }
        }

        [HttpPost("open")]
        public async Task<IActionResult> Open([FromBody] OpenSessionRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.FloorName) || string.IsNullOrWhiteSpace(request.TableNumber))
                return BadRequest(new { status = false, message = "FloorName and TableNumber are required" });

            var floor = request.FloorName.Trim();
            var table = request.TableNumber.Trim();

            // ── Issue #5: Validate booking ownership if BookingId is provided ──
            if (request.BookingId.HasValue)
            {
                var booking = await _context.TableBookings.FindAsync(request.BookingId.Value);
                if (booking == null)
                    return BadRequest(new { status = false, message = "Booking not found" });
                if (booking.Status != "Active")
                    return BadRequest(new { status = false, message = $"Booking is {booking.Status}, not Active" });
                if (booking.FloorName != floor || booking.TableNumber != table)
                    return BadRequest(new { status = false, message = "Booking does not belong to this table" });
                if (booking.EndTime.HasValue && booking.EndTime.Value <= DateTime.UtcNow)
                    return BadRequest(new { status = false, message = "Booking has expired" });
            }

            var existing = await _context.TableSessions
                .OrderByDescending(s => s.OpenedAt)
                .FirstOrDefaultAsync(s =>
                    s.FloorName == floor &&
                    s.TableNumber == table &&
                    (s.Status == "Open" || s.Status == "Closing"));

            if (existing != null)
            {
                // Best-effort enrichment
                if (!string.IsNullOrWhiteSpace(request.CustomerName) && string.IsNullOrWhiteSpace(existing.CustomerName))
                    existing.CustomerName = request.CustomerName.Trim();
                if (!string.IsNullOrWhiteSpace(request.CustomerPhone) && string.IsNullOrWhiteSpace(existing.CustomerPhone))
                    existing.CustomerPhone = request.CustomerPhone.Trim();
                if (request.BookingId.HasValue && !existing.BookingId.HasValue)
                    existing.BookingId = request.BookingId.Value;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _hub.Clients.All.SendAsync("session.updated", new { sessionId = existing.Id, updatedAt = existing.UpdatedAt });
                return Ok(new { status = true, session = existing, reused = true });
            }

            if (request.Mode == "named")
            {
                if (string.IsNullOrWhiteSpace(request.CustomerName))
                    return BadRequest(new { status = false, message = "CustomerName is required for named sessions" });
                if (string.IsNullOrWhiteSpace(request.CustomerPhone) || !System.Text.RegularExpressions.Regex.IsMatch(request.CustomerPhone.Trim(), @"^\d{10}$"))
                    return BadRequest(new { status = false, message = "CustomerPhone must be exactly 10 digits" });
            }

            var session = new TableSession
            {
                FloorName = floor,
                TableNumber = table,
                Status = "Open",
                CustomerName = request.CustomerName?.Trim(),
                CustomerPhone = request.CustomerPhone?.Trim(),
                BookingId = request.BookingId,
                OpenedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.TableSessions.Add(session);
            await _context.SaveChangesAsync();

            await EnsureTableSeatOccupied(session.FloorName, session.TableNumber);

            await _hub.Clients.All.SendAsync("session.opened", new { sessionId = session.Id, floorName = session.FloorName, tableNumber = session.TableNumber, updatedAt = session.UpdatedAt });
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = session.FloorName, tableNumber = session.TableNumber });

            return Ok(new { status = true, session, reused = false });
        }

        [HttpGet("by-table")]
        public async Task<IActionResult> ByTable([FromQuery] string floorName, [FromQuery] string tableNumber)
        {
            if (string.IsNullOrWhiteSpace(floorName) || string.IsNullOrWhiteSpace(tableNumber))
                return BadRequest(new { status = false, message = "floorName and tableNumber are required" });

            var session = await _context.TableSessions
                .OrderByDescending(s => s.OpenedAt)
                .FirstOrDefaultAsync(s =>
                    s.FloorName == floorName &&
                    s.TableNumber == tableNumber &&
                    (s.Status == "Open" || s.Status == "Closing"));

            if (session == null)
                return Ok(new { status = true, session = (object?)null });

            var charges = await _context.TableSessionCharges
                .Where(c => c.TableSessionId == session.Id && c.Status == "Unpaid")
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var order = session.CurrentOrderId.HasValue
                ? await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == session.CurrentOrderId.Value)
                : await _context.Orders.Include(o => o.Items)
                    .OrderByDescending(o => o.CreatedAt)
                    .FirstOrDefaultAsync(o => o.TableSessionId == session.Id && o.PaymentStatus != "paid" && o.Status != "Cancelled");

            return Ok(new
            {
                status = true,
                session,
                order,
                unpaidCharges = charges,
                unpaidChargesTotal = charges.Sum(c => c.Amount)
            });
        }

        public class AddItemsRequest
        {
            public List<ItemLine> Items { get; set; } = new();
            public decimal Subtotal { get; set; }
            public decimal Tax { get; set; }
            public decimal ServiceCharge { get; set; }
            public decimal BookingCharge { get; set; }
            public decimal Total { get; set; }

            public class ItemLine
            {
                public int MenuItemId { get; set; }
                public int Quantity { get; set; }
                public decimal Price { get; set; }
                public string? SpecialRequest { get; set; }
            }
        }

        [HttpPost("{sessionId}/items")]
        public async Task<IActionResult> AddItems(int sessionId, [FromBody] AddItemsRequest request)
        {
            if (request == null || request.Items == null || request.Items.Count == 0)
                return BadRequest(new { status = false, message = "Items are required" });

            var session = await _context.TableSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session == null) return NotFound(new { status = false, message = "Session not found" });
            if (session.Status != "Open" && session.Status != "Closing") return BadRequest(new { status = false, message = "Session is not open" });

            // Find an existing unpaid order for this session (regardless of kitchen status) and append.
            var order = await _context.Orders
                .Include(o => o.Items)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync(o => o.TableSessionId == sessionId && o.PaymentStatus != "paid" && o.Status != "Cancelled");

            // Ensure menu items exist
            var menuItemIds = request.Items.Select(i => i.MenuItemId).Distinct().ToList();
            var menuItems = await _context.MenuItems.Where(m => menuItemIds.Contains(m.Id)).ToListAsync();
            if (menuItems.Count != menuItemIds.Count)
                return BadRequest(new { status = false, message = "One or more menu items not found" });

            if (order == null)
            {
                order = new Order
                {
                    TableSessionId = sessionId,
                    OrderType = "dine-in",
                    FloorName = session.FloorName,
                    TableNumber = session.TableNumber,
                    Status = "Pending",
                    PaymentStatus = "unpaid",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    Subtotal = 0,
                    Tax = 0,
                    ServiceCharge = 0,
                    BookingCharge = 0,
                    Total = 0
                };
                _context.Orders.Add(order);
                await _context.SaveChangesAsync();

                session.CurrentOrderId = order.Id;
            }

            // ── Issue #4: Server-side price validation & recalculation ──
            // Load settings for VAT / service charge computation
            var settings = await _context.Settings.ToListAsync();
            string? GetSettingVal(string key) => settings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase))?.Value;

            var vatPct = decimal.Parse(GetSettingVal("vatPercentage") ?? "13");
            var vatIncluded = (GetSettingVal("vatIncluded") ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);
            var scPct = decimal.Parse(GetSettingVal("serviceChargePercentage") ?? "0");
            var scIncluded = (GetSettingVal("serviceChargeIncluded") ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);

            // Load active discounts for price validation
            var now = DateTime.UtcNow;
            var activeDiscounts = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .Where(d => d.Active && d.OfferType != "combo")
                .Where(d => !d.StartDate.HasValue || d.StartDate <= now)
                .Where(d => !d.EndDate.HasValue || d.EndDate >= now)
                .ToListAsync();

            // Validate each item price and compute server-side subtotal
            decimal serverSubtotal = 0;
            foreach (var itemRequest in request.Items)
            {
                var menuItem = menuItems.First(m => m.Id == itemRequest.MenuItemId);
                var expectedPrice = menuItem.Price;

                // Check if a discount applies to this item
                var discount = activeDiscounts.FirstOrDefault(d =>
                    d.DiscountMenuItems != null && d.DiscountMenuItems.Any(dmi => dmi.MenuItemId == itemRequest.MenuItemId));
                if (discount != null)
                {
                    if (discount.DiscountType == "percentage")
                        expectedPrice = menuItem.Price * (1 - discount.Value / 100m);
                    else if (discount.DiscountType == "fixed")
                        expectedPrice = Math.Max(0, menuItem.Price - discount.Value);
                }

                // Use server-computed price (ignore client-sent price)
                var validatedPrice = decimal.Round(expectedPrice, 2);
                serverSubtotal += validatedPrice * itemRequest.Quantity;

                var existingItem = order.Items.FirstOrDefault(i =>
                    i.MenuItemId == itemRequest.MenuItemId &&
                    i.Price == validatedPrice &&
                    i.SpecialRequest == (string.IsNullOrWhiteSpace(itemRequest.SpecialRequest) ? null : itemRequest.SpecialRequest.Trim()));

                if (existingItem != null)
                {
                    existingItem.Quantity += itemRequest.Quantity;
                }
                else
                {
                    _context.OrderItems.Add(new OrderItem
                    {
                        OrderId = order.Id,
                        MenuItemId = itemRequest.MenuItemId,
                        Name = menuItem.Name,
                        Quantity = itemRequest.Quantity,
                        Price = validatedPrice,
                        SpecialRequest = string.IsNullOrWhiteSpace(itemRequest.SpecialRequest) ? null : itemRequest.SpecialRequest.Trim()
                    });
                }
            }

            // Server-side total recalculation (ignore client-sent totals)
            decimal serverTax = vatIncluded ? serverSubtotal - (serverSubtotal / (1 + vatPct / 100m)) : serverSubtotal * (vatPct / 100m);
            decimal serverSC = scIncluded ? serverSubtotal - (serverSubtotal / (1 + scPct / 100m)) : serverSubtotal * (scPct / 100m);

            order.Subtotal += serverSubtotal;
            order.Tax += decimal.Round(serverTax, 2);
            order.ServiceCharge += decimal.Round(serverSC, 2);
            order.BookingCharge += request.BookingCharge; // Booking charge is validated separately
            order.Total += serverSubtotal + (vatIncluded ? 0 : decimal.Round(serverTax, 2)) + (scIncluded ? 0 : decimal.Round(serverSC, 2)) + request.BookingCharge;
            order.UpdatedAt = DateTime.UtcNow;

            session.UpdatedAt = DateTime.UtcNow;

            await EnsureTableSeatOccupied(session.FloorName, session.TableNumber, order.Id);
            await _context.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("OrderUpdated", order.Id);
            await _hub.Clients.All.SendAsync("NewOrder", order.Id);
            await _hub.Clients.All.SendAsync("order.itemsAdded", new { orderId = order.Id, sessionId = sessionId, updatedAt = order.UpdatedAt });
            await _hub.Clients.All.SendAsync("session.updated", new { sessionId = sessionId, updatedAt = session.UpdatedAt });
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = session.FloorName, tableNumber = session.TableNumber });

            return Ok(new { status = true, orderId = order.Id, sessionId = sessionId, merged = true });
        }

        public class BookingChargeRequest
        {
            public int DurationMinutes { get; set; } = 60;
        }

        [HttpPost("{sessionId}/charges/booking")]
        public async Task<IActionResult> AddBookingCharge(int sessionId, [FromBody] BookingChargeRequest request)
        {
            var session = await _context.TableSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session == null) return NotFound(new { status = false, message = "Session not found" });

            // Read settings
            var settings = await _context.Settings.ToListAsync();
            string? GetVal(string key) => settings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase))?.Value;

            var baseCharge = decimal.Parse(GetVal("tableBookingCharge") ?? "0");
            var chargeType = GetVal("tableBookingChargeType") ?? "flat";

            var duration = Math.Max(1, request?.DurationMinutes ?? 60);
            decimal amount;
            if (chargeType == "per_hour")
                amount = baseCharge * (duration / 60m);
            else if (chargeType == "per_minute")
                amount = baseCharge * duration;
            else
                amount = baseCharge;

            var charge = new TableSessionCharge
            {
                TableSessionId = sessionId,
                Type = "BookingCharge",
                Amount = decimal.Round(amount, 2),
                Status = "Unpaid",
                CreatedAt = DateTime.UtcNow
            };

            _context.TableSessionCharges.Add(charge);
            session.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("session.updated", new { sessionId = sessionId, updatedAt = session.UpdatedAt });
            return Ok(new { status = true, charge });
        }

        private async Task EnsureTableSeatOccupied(string floorName, string tableNumber, int? orderId = null)
        {
            // Minimal occupancy: ensure at least one occupied seat exists for table.
            var existing = await _context.TableSeats
                .Where(s => s.FloorName == floorName && s.TableNumber == tableNumber && s.Status != "Available")
                .ToListAsync();

            if (existing.Any())
            {
                if (orderId.HasValue)
                {
                    foreach (var s in existing.Where(s => s.OrderId == null))
                        s.OrderId = orderId.Value;
                    await _context.SaveChangesAsync();
                }
                return;
            }

            var seat = new TableSeat
            {
                FloorName = floorName,
                TableNumber = tableNumber,
                SeatNumber = 1,
                Status = "Occupied",
                OrderId = orderId,
                OccupiedAt = DateTime.UtcNow
            };
            _context.TableSeats.Add(seat);
            await _context.SaveChangesAsync();
        }
    }
}


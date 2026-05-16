using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using Microsoft.AspNetCore.SignalR;
using System.Data;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/booking")]
    [Authorize]
    public class TableBookingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<OrderHub> _hub;

        public TableBookingController(ApplicationDbContext context, IHubContext<OrderHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        private async Task<Setting?> GetSettingCaseInsensitive(string key)
        {
            var lowered = key.ToLower();
            return await _context.Settings.FirstOrDefaultAsync(s => s.Key.ToLower() == lowered);
        }

        // GET: api/booking/available
        // Get available seats for a specific table/floor and time slot
        [HttpGet("available")]
        public async Task<IActionResult> GetAvailableSeats(
            [FromQuery] string? floorName, 
            [FromQuery] string? tableNumber, 
            [FromQuery] int durationMinutes = 60,
            [FromQuery] DateTime? startTime = null)
        {
            await AutoReleaseExpiredBookings(); // Ensure expired bookings are cleared first
            try
            {
                var now = startTime ?? DateTime.UtcNow;
                var endTime = now.AddMinutes(durationMinutes);
                var comparisonEndTime = endTime;

                // Get all seats (from table configuration)
                var settingsData = await GetSettingCaseInsensitive("TableConfiguration");

                if (settingsData == null || string.IsNullOrEmpty(settingsData.Value))
                {
                    return Ok(new { availableSeats = new List<object>(), message = "No table configuration found" });
                }

                // Parse table configuration
                var tableConfig = System.Text.Json.JsonSerializer.Deserialize<TableConfiguration>(settingsData.Value);
                if (tableConfig == null || tableConfig.floors == null)
                {
                    return Ok(new { availableSeats = new List<object>() });
                }

                // Only check physical seat occupancy if the requested window includes "now".
                // For future time slots, availability is driven solely by booking overlaps below.
                var currentMoment = DateTime.UtcNow;
                var occupiedSeats = new List<TableSeat>();
                if (now <= currentMoment.AddMinutes(5) && (endTime > currentMoment))
                {
                    occupiedSeats = await _context.TableSeats
                        .Where(s => s.Status != "Available")
                        .Where(s => string.IsNullOrEmpty(floorName) || s.FloorName == floorName)
                        .Where(s => string.IsNullOrEmpty(tableNumber) || s.TableNumber == tableNumber)
                        .ToListAsync();
                }

                // Also check bookings that overlap with requested time slot
                var overlappingBookings = await _context.TableBookings
                    .Where(b => b.Status == "Active")
                    .Where(b => b.StartTime < comparisonEndTime && (b.EndTime == null || b.EndTime > now))
                    .Where(b => string.IsNullOrEmpty(floorName) || b.FloorName == floorName)
                    .Where(b => string.IsNullOrEmpty(tableNumber) || b.TableNumber == tableNumber)
                    .ToListAsync();

                // Build availability information
                var availability = new List<object>();

                foreach (var floor in tableConfig.floors)
                {
                    if (!string.IsNullOrEmpty(floorName) && floor.name != floorName) continue;

                    for (int tableNum = 1; tableNum <= floor.tableCount; tableNum++)
                    {
                        var tableName = tableNum.ToString();
                        if (!string.IsNullOrEmpty(tableNumber) && tableName != tableNumber) continue;

                        var tableSeats = new List<object>();
                        var seatsPerTable = floor.customSeats != null && floor.customSeats.TryGetValue(tableName, out int customSeats)
                            ? customSeats
                            : floor.seats;

                        for (int seatNum = 1; seatNum <= seatsPerTable; seatNum++)
                        {
                            var isOccupied = occupiedSeats.Any(s => 
                                s.FloorName == floor.name && 
                                s.TableNumber == tableName && 
                                s.SeatNumber == seatNum);

                            var isBooked = overlappingBookings.Any(b => 
                                b.FloorName == floor.name && 
                                b.TableNumber == tableName);

                            tableSeats.Add(new
                            {
                                seatNumber = seatNum,
                                available = !isOccupied && !isBooked
                            });
                        }

                        availability.Add(new
                        {
                            floor = floor.name,
                            table = tableName,
                            totalSeats = seatsPerTable,
                            seats = tableSeats
                        });
                    }
                }

                return Ok(new { status = true, availableSeats = availability });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // GET: api/booking/active-booking
        // Check for an active booking for a specific table
        [HttpGet("active-booking")]
        public async Task<IActionResult> GetActiveBooking([FromQuery] string floorName, [FromQuery] string tableNumber)
        {
            try
            {
                var now = DateTime.UtcNow;
                // Find booking that is Active and currently ongoing (Start <= Now <= End)
                // OR upcoming within a short window? "Later order food" implies they are AT the table.
                // So now should be within the booking window.
                var booking = await _context.TableBookings
                    .Where(b => b.FloorName == floorName && b.TableNumber == tableNumber && b.Status == "Active")
                    .Where(b => b.StartTime <= now.AddMinutes(15))
                    // Actually, if they are ordering, the booking should be Active.
                    // Let's stick to standard strict window or just "Active" status if we manage status well.
                    // But "Active" status persists until completed.
                    // Let's use strict time window to be safe, but maybe loose checks.
                    // If they are late, StartTime is in past. If they are early, StartTime is in future.
                    // Let's just user "Active" status primarily if Status logic is robust. 
                    // But assume Status might be "Active" even if time passed?
                    // Let's trust "Active" status plus rough time check.
                    .Where(b => !b.EndTime.HasValue || b.EndTime > now)
                    .FirstOrDefaultAsync();



                if (booking == null)
                {
                    return Ok(new { status = false, message = "No active booking found" });
                }
                
                // Double check if it should be expired?
                // AutoReleaseExpiredBookings updates DB, so if we found it passed that check, it's valid.
                // But GetActiveBooking didn't call AutoRelease yet. Let's do it.
                // Actually, if we just call it on list fetching, it might be enough.
                // But safer to call it here too.
                if (booking.EndTime.HasValue && booking.EndTime <= DateTime.UtcNow) {
                     await AutoReleaseExpiredBookings();
                     return Ok(new { status = false, message = "Booking has expired" });
                }

                return Ok(new { status = true, booking });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // GET: api/booking/seat-status
        // Returns per-seat availability for a specific table (used by walk-in seat picker)
        [HttpGet("seat-status")]
        public async Task<IActionResult> GetSeatStatus([FromQuery] string floorName, [FromQuery] string tableNumber)
        {
            try
            {
                // Get table configuration to know total seat count
                var settingRecord = await GetSettingCaseInsensitive("TableConfiguration");
                int maxSeats = 4;
                if (settingRecord != null && !string.IsNullOrEmpty(settingRecord.Value))
                {
                    var tableConfig = System.Text.Json.JsonSerializer.Deserialize<TableConfiguration>(settingRecord.Value);
                    var floor = tableConfig?.floors?.FirstOrDefault(f => f.name == floorName);
                    if (floor != null)
                    {
                        if (floor.customSeats != null && floor.customSeats.TryGetValue(tableNumber, out int customCount))
                            maxSeats = customCount;
                        else
                            maxSeats = floor.seats;
                    }
                }

                // Get currently occupied/reserved seats
                var occupiedSeats = await _context.TableSeats
                    .Where(s => s.FloorName == floorName && s.TableNumber == tableNumber && s.Status != "Available")
                    .Select(s => new { s.SeatNumber, s.Status, s.OrderId, s.BookingId })
                    .ToListAsync();

                // Check for active named booking (it locks the entire table)
                var hasNamedBooking = await _context.TableBookings
                    .AnyAsync(b => b.FloorName == floorName
                        && b.TableNumber == tableNumber
                        && b.Status == "Active"
                        && b.StartTime <= DateTime.UtcNow.AddMinutes(15)
                        && (!b.EndTime.HasValue || b.EndTime > DateTime.UtcNow));

                var seats = Enumerable.Range(1, maxSeats).Select(seatNum =>
                {
                    var occ = occupiedSeats.FirstOrDefault(s => s.SeatNumber == seatNum);
                    string seatStatus;
                    if (occ != null)
                        seatStatus = occ.Status; // "Occupied" or "Reserved"
                    else if (hasNamedBooking)
                        seatStatus = "Reserved"; // Named booking locks all seats
                    else
                        seatStatus = "Available";

                    return new
                    {
                        seatNumber = seatNum,
                        status = seatStatus,
                        orderId = occ?.OrderId,
                        bookingId = occ?.BookingId
                    };
                }).ToList();

                return Ok(new { status = true, seats, hasNamedBooking, maxSeats });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // POST: api/booking/reserve
        // Create a new table booking
        [HttpPost("reserve")]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
        {
            try
            {
                // Validate input
                if (string.IsNullOrEmpty(request.FloorName) || string.IsNullOrEmpty(request.TableNumber))
                {
                    return BadRequest(new { status = false, message = "Floor and table are required" });
                }
                if (string.IsNullOrEmpty(request.CustomerPhone) || !System.Text.RegularExpressions.Regex.IsMatch(request.CustomerPhone, @"^\d{10}$"))
                {
                    return BadRequest(new { status = false, message = "Phone number must be exactly 10 digits and contain only numbers." });
                }

                // Phone Ownership Validation
                var existingCustomer = await _context.TableBookings
                    .Where(b => b.CustomerPhone == request.CustomerPhone)
                    .Select(b => b.CustomerName)
                    .FirstOrDefaultAsync();

                if (existingCustomer != null && !string.Equals(existingCustomer, request.CustomerName, StringComparison.OrdinalIgnoreCase))
                {
                     return BadRequest(new { status = false, message = $"Phone number {request.CustomerPhone} is already associated with {existingCustomer}. Please use a different number or correct the name." });
                }

                var startTime = request.StartTime ?? DateTime.UtcNow;

                // Validate that booking is not in the past
                // Allow a small 2-minute buffer for network latency/clock drift
                if (startTime < DateTime.UtcNow.AddMinutes(-2))
                {
                    return BadRequest(new { status = false, message = "Cannot create a booking in the past." });
                }

                var durationMinutes = request.DurationMinutes;
                if (request.DurationMinutes < 15)
                {
                    return BadRequest(new { status = false, message = "Minimum duration is 15 minutes." });
                }

                DateTime endTime = startTime.AddMinutes(request.DurationMinutes);
                var comparisonEndTime = endTime;

                // ── Atomic overlap-check + insert (prevents double-booking race condition) ──
                using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                try
                {
                    // Check if TABLE is already booked for this time slot
                    var existingBooking = await _context.TableBookings
                        .Where(b => b.FloorName == request.FloorName)
                        .Where(b => b.TableNumber == request.TableNumber)
                        .Where(b => b.Status == "Active")
                        .Where(b => b.StartTime < comparisonEndTime && (b.EndTime == null || b.EndTime > startTime))
                        .FirstOrDefaultAsync();

                    if (existingBooking != null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { status = false, message = "This table is already booked for the requested time" });
                    }

                    // Create booking (whole table)
                    var booking = new TableBooking
                    {
                        FloorName = request.FloorName,
                        TableNumber = request.TableNumber,
                        SeatNumber = request.PartySize, // Store Party Size in SeatNumber
                        CustomerName = request.CustomerName,
                        CustomerPhone = request.CustomerPhone,
                        StartTime = startTime,
                        EndTime = endTime,
                        DurationMinutes = durationMinutes,

                        Status = "Active"
                    };

                    _context.TableBookings.Add(booking);
                    await _context.SaveChangesAsync();

                    // Only create seat reservations for IMMEDIATE bookings (starting within 15 min).
                    // Future bookings rely on overlap checks; seats are created when the session opens.
                    var isImmediateBooking = startTime <= DateTime.UtcNow.AddMinutes(15);
                    if (isImmediateBooking)
                    {
                        var settingRecord = await GetSettingCaseInsensitive("TableConfiguration");
                        int seatsPerTable = 4; // Default

                        if (settingRecord != null && !string.IsNullOrEmpty(settingRecord.Value))
                        {
                            var tableConfig = System.Text.Json.JsonSerializer.Deserialize<TableConfiguration>(settingRecord.Value);
                            var floor = tableConfig?.floors?.FirstOrDefault(f => f.name == request.FloorName);
                            if (floor != null)
                            {
                                // Respect per-table custom seat counts from frontend config
                                if (floor.customSeats != null && floor.customSeats.TryGetValue(request.TableNumber, out int customCount))
                                    seatsPerTable = customCount;
                                else
                                    seatsPerTable = floor.seats;
                            }
                        }

                        for (int i = 1; i <= seatsPerTable; i++)
                        {
                            var seat = new TableSeat
                            {
                                FloorName = request.FloorName,
                                TableNumber = request.TableNumber,
                                SeatNumber = i,
                                Status = "Reserved",
                                BookingId = booking.Id
                            };
                            _context.TableSeats.Add(seat);
                        }
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();

                    await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = request.FloorName, tableNumber = request.TableNumber });

                    return Ok(new { 
                        status = true, 
                        message = "Booking created successfully", 
                        bookingId = booking.Id,
                        partySize = request.PartySize
                    });
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return Conflict(new { status = false, message = "Table was just booked by another request. Please try again." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // POST: api/booking/release-seat
        // Manually release a seat
        [HttpPost("release-seat")]
        public async Task<IActionResult> ReleaseSeat([FromBody] ReleaseSeatRequest request)
        {
            try
            {
                var seatsToRelease = new List<TableSeat>();

                if (request.SeatId.HasValue)
                {
                    var seat = await _context.TableSeats.FindAsync(request.SeatId.Value);
                    if (seat != null) seatsToRelease.Add(seat);
                }
                else if (request.OrderId.HasValue)
                {
                    // Release ALL seats linked to this order, not just the first
                    seatsToRelease = await _context.TableSeats
                        .Where(s => s.OrderId == request.OrderId.Value)
                        .ToListAsync();
                }

                if (seatsToRelease.Count == 0)
                {
                    return NotFound(new { status = false, message = "Seat not found" });
                }

                // Collect booking IDs and table info before releasing
                var bookingIds = seatsToRelease
                    .Where(s => s.BookingId.HasValue)
                    .Select(s => s.BookingId!.Value)
                    .Distinct()
                    .ToList();
                var floorName = seatsToRelease.First().FloorName;
                var tableNumber = seatsToRelease.First().TableNumber;

                // Release all matched seats
                foreach (var s in seatsToRelease)
                {
                    s.Status = "Available";
                    s.OrderId = null;
                    s.BookingId = null;
                    s.OccupiedAt = null;
                    s.ReadyAt = null;
                    s.AutoReleaseAt = null;
                }
                await _context.SaveChangesAsync();

                // Only complete a booking when ALL of its seats have been released
                foreach (var bid in bookingIds)
                {
                    var remainingSeats = await _context.TableSeats
                        .CountAsync(s => s.BookingId == bid && s.Status != "Available");

                    if (remainingSeats == 0)
                    {
                        var booking = await _context.TableBookings.FindAsync(bid);
                        if (booking != null && booking.Status == "Active")
                        {
                            booking.Status = "Completed";
                        }
                    }
                }
                await _context.SaveChangesAsync();

                await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName, tableNumber });

                return Ok(new { status = true, message = "Seat released successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // GET: api/booking/current
        // Get bookings and seat statuses (optionally filtered by date range)
        [HttpGet("current")]
        public async Task<IActionResult> GetCurrentBookings([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                await AutoReleaseExpiredBookings();
                var now = DateTime.UtcNow;

                IQueryable<TableBooking> query = _context.TableBookings;

                if (startDate.HasValue)
                {
                    // If startDate is provided, show bookings for the range [startDate, endDate ?? startDate + 1]
                    var start = startDate.Value.Date;
                    var end = (endDate ?? startDate).Value.Date.AddDays(1);
                    query = query.Where(b => b.StartTime >= start && b.StartTime < end);
                }
                else
                {
                    // Default behavior: show only Active/Reserved bookings that haven't expired
                    // Allow null EndTime (walk-in / legacy open-ended bookings without an end time)
                    query = query.Where(b => (b.Status == "Active" || b.Status == "Reserved") && (!b.EndTime.HasValue || b.EndTime > now));
                }

                var bookings = await query
                    .OrderBy(b => b.StartTime)
                    .ToListAsync();

                // Physical seat state is only meaningful for the current moment.
                // For history views (past dates), return empty — seat rows are transient.
                var isHistory = startDate.HasValue && startDate.Value.Date < DateTime.Today;
                var seats = new List<TableSeat>();

                if (!isHistory)
                {
                    seats = await _context.TableSeats
                        .Where(s => s.Status != "Available")
                        .ToListAsync();

                    // Auto-release seats (only if checking for truly "current" status today)
                    if (!startDate.HasValue || startDate.Value.Date == DateTime.Today)
                    {
                        var seatsToRelease = seats
                            .Where(s => s.AutoReleaseAt.HasValue && s.AutoReleaseAt.Value <= now)
                            .ToList();

                        foreach (var seat in seatsToRelease)
                        {
                            seat.Status = "Available";
                            seat.OrderId = null;
                            seat.ReadyAt = null;
                            seat.AutoReleaseAt = null;
                        }

                        if (seatsToRelease.Any())
                        {
                            await _context.SaveChangesAsync();
                            seats = await _context.TableSeats.Where(s => s.Status != "Available").ToListAsync();
                        }
                    }
                }

                var tableStates = BuildTableStates(bookings, seats);

                return Ok(new
                {
                    status = true,
                    bookings = bookings,
                    occupiedSeats = seats,
                    tableStates = tableStates,
                    isHistory = startDate.HasValue
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // GET: api/cashier/bookings
        // Get all bookings for cashier dashboard (formatted for frontend)
        [HttpGet]
        [Route("/api/cashier/bookings")]
        public async Task<IActionResult> GetCashierBookings()
        {
            try
            {
                await AutoReleaseExpiredBookings();
                
                // Fetch entities first to allow in-memory DateTime processing
                // This prevents Entity Framework translation issues for DateTime.SpecifyKind
                var entities = await _context.TableBookings
                    .Where(b => b.Status != "Cancelled")
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();
                    
                var bookings = entities.Select(b => new
                    {
                        id = b.Id,
                        customerName = b.CustomerName ?? "Guest",
                        customerPhone = b.CustomerPhone ?? "",
                        floorName = b.FloorName,
                        tableNumber = b.TableNumber,
                        seatNumber = b.SeatNumber,
                        bookingDate = DateTime.SpecifyKind(b.StartTime, DateTimeKind.Utc),
                        durationMinutes = b.DurationMinutes,

                        status = b.Status.ToLower(),
                        createdAt = DateTime.SpecifyKind(b.CreatedAt, DateTimeKind.Utc),
                        startTime = DateTime.SpecifyKind(b.StartTime, DateTimeKind.Utc),
                        endTime = b.EndTime.HasValue ? DateTime.SpecifyKind(b.EndTime.Value, DateTimeKind.Utc) : (DateTime?)null,
                        orderId = b.OrderId
                    })
                    .ToList();

                return Ok(bookings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }

        // Helper class for table configuration
        private class TableConfiguration
        {
            public List<FloorConfig>? floors { get; set; }
        }

        private class FloorConfig
        {
            public string name { get; set; } = "";
            public int tableCount { get; set; }
            public int seats { get; set; } = 4; // Default 4 seats per table
            public Dictionary<string, int>? customSeats { get; set; } // Per-table seat overrides
        }

        private List<object> BuildTableStates(List<TableBooking> bookings, List<TableSeat> seats)
        {
            // Canonical precedence: occupied > reserved > available
            var allKeys = new HashSet<string>();
            foreach (var b in bookings)
            {
                allKeys.Add($"{b.FloorName}|{b.TableNumber}");
            }
            foreach (var s in seats)
            {
                allKeys.Add($"{s.FloorName}|{s.TableNumber}");
            }

            var results = new List<object>();
            foreach (var key in allKeys)
            {
                var parts = key.Split('|');
                var floorName = parts[0];
                var tableNumber = parts[1];

                var tableSeats = seats.Where(s => s.FloorName == floorName && s.TableNumber == tableNumber).ToList();
                var tableBookings = bookings.Where(b => b.FloorName == floorName && b.TableNumber == tableNumber).ToList();

                var hasOccupied = tableSeats.Any(s => s.Status == "Occupied");
                var hasReserved = tableSeats.Any(s => s.Status == "Reserved")
                    || tableBookings.Any(b => b.Status == "Active" || b.Status == "Reserved");

                var status = hasOccupied ? "occupied" : hasReserved ? "reserved" : "available";
                results.Add(new
                {
                    floorName,
                    tableNumber,
                    status
                });
            }

            return results;
        }
        // POST: api/booking/{id}/complete
        // Manually complete/free a booking
        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteBooking(int id)
        {
            try
            {
                var booking = await _context.TableBookings.FindAsync(id);
                if (booking == null)
                {
                    return NotFound(new { status = false, message = "Booking not found" });
                }

                if (booking.Status != "Active" && booking.Status != "Reserved")
                {
                   return BadRequest(new { status = false, message = $"Booking is already {booking.Status}" });
                }

                // Update booking status
                // If cancellation is happening BEFORE the booking start time, mark as 'Cancelled'
                // Otherwise, if it's during/after, mark as 'Completed' (finished early)
                if (DateTime.UtcNow < booking.StartTime)
                {
                    booking.Status = "Cancelled";
                }

                else
                {
                    booking.Status = "Completed";
                    booking.EndTime = DateTime.UtcNow; // Set actual end time only if completed/freed
                }

                // Release all associated seats
                var seats = await _context.TableSeats
                    .Where(s => s.BookingId == id)
                    .ToListAsync();

                foreach (var seat in seats)
                {
                    seat.Status = "Available";
                    seat.BookingId = null;
                    seat.OrderId = null;
                    seat.OccupiedAt = null;
                    seat.ReadyAt = null;
                    seat.AutoReleaseAt = null;
                }

                await _context.SaveChangesAsync();

                await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = booking.FloorName, tableNumber = booking.TableNumber });

                return Ok(new { status = true, message = "Table freed successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = ex.Message });
            }
        }







        // Helper to release expired bookings
        private async Task AutoReleaseExpiredBookings()
        {
            var now = DateTime.UtcNow;
            var expiredBookings = await _context.TableBookings
                .Where(b => b.Status == "Active" && b.EndTime.HasValue && b.EndTime <= now)
                .ToListAsync();

            if (expiredBookings.Any())
            {
                foreach (var booking in expiredBookings)
                {
                    booking.Status = "Completed";
                    
                    // Release associated seats
                    var seats = await _context.TableSeats
                        .Where(s => s.BookingId == booking.Id)
                        .ToListAsync();
                        
                    foreach(var seat in seats)
                    {
                        seat.Status = "Available";
                        seat.BookingId = null;
                        seat.OrderId = null;
                         seat.OccupiedAt = null;
                        seat.ReadyAt = null;
                        seat.AutoReleaseAt = null;
                    }
                }
                await _context.SaveChangesAsync();
            }
        }
    }

    // Request DTOs
    public class CreateBookingRequest
    {
        public string FloorName { get; set; } = "";
        public string TableNumber { get; set; } = "";
        public int PartySize { get; set; } = 2; // Number of guests
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public DateTime? StartTime { get; set; }
        public int DurationMinutes { get; set; } = 60;

    }

    public class ReleaseSeatRequest
    {
        public int? SeatId { get; set; }
        public int? OrderId { get; set; }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Helpers;
using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using Microsoft.AspNetCore.SignalR;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace cafeSystem.Controllers
{
    [Route("api/kitchen")]
    [ApiController]
    [Authorize(Roles = "Manager,Chef,Cashier")]
    public class KitchenController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<OrderHub> _hub;

        public KitchenController(ApplicationDbContext context, IHubContext<OrderHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        // GET: api/kitchen/orders
        [HttpGet("orders")]
        public async Task<ActionResult<IEnumerable<Order>>> GetKitchenOrders()
        {
            // Fetch active orders (Pending, Preparing) 
            // PLUS today's completed/ready orders to allow filtering
            var today = DateTime.UtcNow.Date;
            var orders = await _context.Orders
                .Include(o => o.Items)
                .Where(o => o.Status == "Pending" || o.Status == "Preparing" || 
                           ((o.Status == "Ready" || o.Status == "Completed") && o.CreatedAt >= today))
                .OrderBy(o => o.CreatedAt)
                .ToListAsync();

            return orders;
        }

        // GET: api/kitchen/history
        [HttpGet("history")]
        public async Task<ActionResult<IEnumerable<object>>> GetKitchenOrderHistory(
            [FromQuery] string range = "today",
            [FromQuery] DateTime? customStartDate = null,
            [FromQuery] DateTime? customEndDate = null)
        {
            var query = _context.Orders
                .Include(o => o.Items)
                .Where(o => o.Status == "Ready" || o.Status == "Completed" || o.Status == "Served");

            // Apply Date Filtering
            var now = DateTime.UtcNow;
            if (range == "today")
            {
                var today = now.Date;
                query = query.Where(o => o.CreatedAt >= today);
            }
            else if (range == "yesterday")
            {
                var yesterday = now.Date.AddDays(-1);
                var today = now.Date;
                query = query.Where(o => o.CreatedAt >= yesterday && o.CreatedAt < today);
            }
            else if (range == "week")
            {
                var startOfWeek = now.Date.AddDays(-(int)now.DayOfWeek);
                query = query.Where(o => o.CreatedAt >= startOfWeek);
            }
            else if (range == "month")
            {
                var startOfMonth = new DateTime(now.Year, now.Month, 1);
                query = query.Where(o => o.CreatedAt >= startOfMonth);
            }
            else if (range == "custom" && customStartDate.HasValue && customEndDate.HasValue)
            {
                // Ensure we cover the entire end date
                var endDate = customEndDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(o => o.CreatedAt >= customStartDate.Value.Date && o.CreatedAt <= endDate);
            }

            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new {
                    o.Id,
                    o.CreatedAt,
                    o.ReadyAt,
                    o.OrderType,
                    o.TableNumber,
                    o.FloorName,
                    ItemsCount = o.Items.Sum(i => i.Quantity),
                    PrepTimeMinutes = o.ReadyAt.HasValue ? EF.Functions.DateDiffMinute(o.CreatedAt, o.ReadyAt.Value) : 0,
                    Items = o.Items.Select(i => new { i.Name, i.Quantity }).ToList() // Optional: if we want to show details
                })
                .ToListAsync();

            return Ok(orders);
        }

        // PUT: api/kitchen/orders/5/status
        [HttpPut("orders/{id}/status")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] KitchenUpdateStatusRequest request)
        {
            var order = await _context.Orders.FindAsync(id);
            if (order == null)
            {
                return NotFound();
            }

            // Valid transitions for Kitchen: 
            // Pending -> Preparing
            // Preparing -> Ready
            order.Status = request.Status;
            
            if (request.Status == "Ready")
            {
                order.ReadyAt = DateTime.UtcNow;
                // If it's a table booking, we might update seat status too, but that's handled elsewhere usually
            }

            await _context.SaveChangesAsync();

            // Notify all connected clients about the status change
            await _hub.Clients.All.SendAsync("OrderUpdated", id);
            await _hub.Clients.All.SendAsync("order.statusChanged", new { orderId = id, status = order.Status });
            if (request.Status == "Ready")
            {
                await _hub.Clients.All.SendAsync("order.ready", new { orderId = id, floorName = order.FloorName, tableNumber = order.TableNumber });
            }
            await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = order.FloorName, tableNumber = order.TableNumber });

            return NoContent();
        }

        public class KitchenUpdateStatusRequest
        {
            public string Status { get; set; }
        }

        // --- Kitchen Settings ---

        // GET: api/kitchen/settings
        [HttpGet("settings")]
        public async Task<IActionResult> GetKitchenSettings()
        {
            var keys = new[] {
                "Kitchen_SoundEnabled", "Kitchen_AutoAcceptOrders", "Kitchen_PriorityAlerts",
                "Kitchen_DisplayMode", "Kitchen_PrepTimeWarning", "Kitchen_MaxActiveOrders"
            };
            var settings = await _context.Settings
                .Where(s => keys.Contains(s.Key))
                .ToListAsync();

            string? GetVal(string key) => settings.FirstOrDefault(s => s.Key == key)?.Value;

            return Ok(new {
                soundEnabled      = bool.Parse(GetVal("Kitchen_SoundEnabled")      ?? "true"),
                autoAcceptOrders  = bool.Parse(GetVal("Kitchen_AutoAcceptOrders")  ?? "true"),
                priorityAlerts    = bool.Parse(GetVal("Kitchen_PriorityAlerts")    ?? "true"),
                displayMode       = GetVal("Kitchen_DisplayMode")                  ?? "grid",
                prepTimeWarning   = int.Parse(GetVal("Kitchen_PrepTimeWarning")    ?? "15"),
                maxActiveOrders   = int.Parse(GetVal("Kitchen_MaxActiveOrders")    ?? "10")
            });
        }

        // PUT: api/kitchen/settings
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateKitchenSettings([FromBody] KitchenSettingsRequest model)
        {
            if (model == null) return BadRequest();

            async Task Save(string key, string value) {
                var s = await _context.Settings.FirstOrDefaultAsync(x => x.Key == key);
                if (s == null) { s = new Setting { Key = key }; _context.Settings.Add(s); }
                s.Value = value;
                s.UpdatedAt = DateTime.UtcNow;
            }

            await Save("Kitchen_SoundEnabled",     model.SoundEnabled.ToString());
            await Save("Kitchen_AutoAcceptOrders", model.AutoAcceptOrders.ToString());
            await Save("Kitchen_PriorityAlerts",   model.PriorityAlerts.ToString());
            await Save("Kitchen_DisplayMode",      model.DisplayMode ?? "grid");
            await Save("Kitchen_PrepTimeWarning",  model.PrepTimeWarning.ToString());
            await Save("Kitchen_MaxActiveOrders",  model.MaxActiveOrders.ToString());

            await _context.SaveChangesAsync();
            return Ok(new { status = true, message = "Kitchen settings saved." });
        }

        public class KitchenSettingsRequest
        {
            public bool SoundEnabled     { get; set; } = true;
            public bool AutoAcceptOrders { get; set; } = true;
            public bool PriorityAlerts   { get; set; } = true;
            public string DisplayMode    { get; set; } = "grid";
            public int PrepTimeWarning   { get; set; } = 15;
            public int MaxActiveOrders   { get; set; } = 10;
        }

        // --- Menu Availability Management ---

        // GET: api/kitchen/menu
        [HttpGet("menu")]
        public async Task<ActionResult<IEnumerable<MenuItem>>> GetMenuItems()
        {
            return await _context.MenuItems
                .OrderBy(m => m.Category)
                .ThenBy(m => m.Name)
                .ToListAsync();
        }

        // PUT: api/kitchen/menu/5/availability
        [HttpPut("menu/{id}/availability")]
        public async Task<IActionResult> ToggleItemAvailability(int id, [FromBody] UpdateAvailabilityRequest request)
        {
            if (!User.HasPermission("pos.toggle_availability") && !User.HasPermission("kitchen.toggle_availability")) return Forbid();
            var item = await _context.MenuItems.FindAsync(id);
            if (item == null) return NotFound();

            item.IsAvailable = request.IsAvailable;
            await _context.SaveChangesAsync();

            // Broadcast update to all clients (Waiters, Cashiers, etc.)
            await _hub.Clients.All.SendAsync("MenuUpdate");

            return Ok(item);
        }

        public class UpdateAvailabilityRequest
        {
            public bool IsAvailable { get; set; }
        }
    }
}

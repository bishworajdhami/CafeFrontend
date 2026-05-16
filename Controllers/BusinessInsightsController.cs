using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Models;
using cafeSystem.Data;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace cafeSystem.Controllers
{
    [Route("api/manager/insights")]
    [ApiController]
    // [Authorize(Roles = "Manager")] // Uncomment when auth is fully enforced
    public class BusinessInsightsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private static readonly TimeZoneInfo NepalTimeZone = GetNepalTimeZone();

        private static TimeZoneInfo GetNepalTimeZone()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("Nepal Standard Time"); }
            catch { try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kathmandu"); }
            catch { return TimeZoneInfo.Utc; } }
        }

        public BusinessInsightsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetInsights([FromQuery] string range = "daily", [FromQuery] DateTime? customStartDate = null, [FromQuery] DateTime? customEndDate = null)
        {
            try
            {
                var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NepalTimeZone);
                DateTime startDate;
                DateTime endDate = now.Date.AddDays(1).AddTicks(-1); // End of today (23:59:59.999)
                
                // ─── DATA REPAIR: Fix NULL UpdatedAt values that cause crashes ───
                // This happens when data is imported without the UpdatedAt column.
                await _context.Database.ExecuteSqlRawAsync("UPDATE Orders SET UpdatedAt = CreatedAt WHERE UpdatedAt IS NULL");
                // ─────────────────────────────────────────────────────────────────

                // 1. Determine Date Range (Nepal Time)
                switch (range.ToLower())
                {
                    case "weekly":
                        startDate = now.Date.AddDays(-6); // Last 7 days including today
                        break;
                    case "monthly":
                        // Start from the 1st day of the current month (or last 30 days? "Monthly" usually implies "This Month" or "Last 30 Days")
                        // Let's stick to "Last 30 Days" for rolling window, OR "Current Month"
                        // User request: "monthly data is not logical" - presumably they want to see day 1 to day 30/31
                        // Let's do "Current Month" to be cleaner, or sticking to rolling 30 days.
                        // "we have 24 hours data for day, 7 days data for week and but monly data is not logical"
                        // Let's try: Start of current month to today.
                        startDate = new DateTime(now.Year, now.Month, 1);
                        break;
                    case "yearly":
                        // Start of current year
                        startDate = new DateTime(now.Year, 1, 1);
                        break;
                    case "custom":
                        if (customStartDate.HasValue && customEndDate.HasValue)
                        {
                            startDate = customStartDate.Value.Date;
                            endDate = customEndDate.Value.Date.AddDays(1).AddTicks(-1);
                        }
                        else
                        {
                             startDate = now.Date; // Fallback
                        }
                        break;
                    case "daily":
                    default:
                        startDate = now.Date; // Today 00:00:00
                        break;
                }

                // 2. Convert to UTC for Database Queries
                // Note: Database stores UTC. We need to find the UTC equivalent of the Nepal Time start/end.
                // However, since we want "Nepal Day", we must cover the UTC range that corresponds to Nepal Day.
                // E.g. Nepal 00:00 is UTC 18:15 (previous day).
                var startUtc = TimeZoneInfo.ConvertTimeToUtc(startDate, NepalTimeZone);
                var endUtc = TimeZoneInfo.ConvertTimeToUtc(endDate, NepalTimeZone);

                // 3. Fetch Data
                // Fetch Payments (for Sales metrics)
                var payments = await _context.Payments
                    .Where(p => p.PaymentDate >= startUtc && p.PaymentDate <= endUtc)
                    .ToListAsync();

                // Fetch Orders (for Item metrics & Counts)
                // Filter: Created in range AND Not Cancelled
                var orders = await _context.Orders
                    .Include(o => o.Items)
                    .Where(o => o.CreatedAt >= startUtc && o.CreatedAt <= endUtc && o.Status != "Cancelled")
                    .ToListAsync();

                // 4. Calculate Aggregates
                
                // A. Key Metrics
                var totalSales = payments?.Sum(p => p.Amount) ?? 0m;
                var totalOrdersCount = orders.Count;
                var totalItemsSold = orders.SelectMany(o => o.Items).Sum(i => i.Quantity);
                var averageOrderValue = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0m;

                // B. Top Items
                // Flatten OrderItems, Group by Name
                var topItems = (orders ?? new List<Order>())
                    .SelectMany(o => o.Items ?? new List<OrderItem>())
                    .GroupBy(i => i.Name)
                    .Select(g => new
                    {
                        Name = g.Key ?? "Unknown",
                        Quantity = g.Sum(i => i.Quantity),
                        Revenue = g.Sum(i => i.Quantity * i.Price)
                    })
                    .OrderByDescending(x => x.Quantity)
                    .Take(5)
                    .ToList();

                // C. Busy Hours
                // Group orders by Hour (Nepal Time)
                // Use Enumerable.Range to ensure all hours/periods exist if needed, 
                // but for simplicity we'll just show hours with activity or let frontend handle gaps.
                // For "Daily", we show hour by hour.
                // For "Weekly/Monthly", this shows "When users usually order" (aggregated by time of day).
                var busyHoursData = orders
                    .GroupBy(o => TimeZoneInfo.ConvertTimeFromUtc(o.CreatedAt, NepalTimeZone).Hour)
                    .Select(g => new
                    {
                        Hour24 = g.Key,
                        Orders = g.Count()
                    })
                    .OrderBy(x => x.Hour24)
                    .ToList();

                var busyHours = busyHoursData.Select(h => new
                {
                    Hour = DateTime.Today.AddHours(h.Hour24).ToString("h tt"), // "8 AM", "1 PM"
                    SortKey = h.Hour24,
                    Orders = h.Orders
                }).OrderBy(x => x.SortKey).Select(x => new { x.Hour, x.Orders }).ToList();


                // D. Sales by Day (or Month for Yearly)
                object salesChartData;

                if (range.ToLower() == "daily")
                {
                    // Daily: Generate all hours 0-23
                    var allHours = Enumerable.Range(0, 24).Select(h => new
                    {
                        Hour = h,
                        Label = DateTime.Today.AddHours(h).ToString("h tt")
                    });

                    var salesByHour = payments
                        .GroupBy(p => TimeZoneInfo.ConvertTimeFromUtc(p.PaymentDate, NepalTimeZone).Hour)
                        .Select(g => new { Hour = g.Key, Sales = g.Sum(p => p.Amount) })
                        .ToList();

                    salesChartData = allHours.GroupJoin(
                        salesByHour,
                        h => h.Hour,
                        s => s.Hour,
                        (h, s) => new
                        {
                            Day = h.Label,
                            Sales = s.Sum(x => x.Sales)
                        })
                        .ToList();
                }
                else if (range.ToLower() == "yearly")
                {
                    // Yearly: Group by Month (Jan - Dec)
                    var allMonths = Enumerable.Range(1, 12).Select(m => new 
                    { 
                        Month = m, 
                        Label = new DateTime(now.Year, m, 1).ToString("MMM") 
                    });

                    var salesByMonth = payments
                        .GroupBy(p => TimeZoneInfo.ConvertTimeFromUtc(p.PaymentDate, NepalTimeZone).Month)
                        .Select(g => new { Month = g.Key, Sales = g.Sum(p => p.Amount) })
                        .ToList();

                    salesChartData = allMonths.GroupJoin(
                        salesByMonth,
                        m => m.Month,
                        s => s.Month,
                        (m, s) => new
                        {
                            Day = m.Label, // Reuse 'Day' property for frontend compatibility
                            Sales = s.Sum(x => x.Sales)
                        })
                        .ToList();
                }
                else
                {
                    // Weekly / Monthly / Custom: Group by Date
                    // Generate all days in the range
                    var totalDays = (endDate.Date - startDate.Date).Days + 1;
                    // Cap total days to avoid massive arrays if custom range is huge (e.g. max 365)
                    if (totalDays > 366) totalDays = 366; 

                    var allDays = Enumerable.Range(0, totalDays).Select(i => 
                        startDate.Date.AddDays(i)
                    );

                    var salesByDate = payments
                        .GroupBy(p => TimeZoneInfo.ConvertTimeFromUtc(p.PaymentDate, NepalTimeZone).Date)
                        .Select(g => new { Date = g.Key, Sales = g.Sum(p => p.Amount) })
                        .ToList();

                    salesChartData = allDays.GroupJoin(
                        salesByDate,
                        d => d,
                        s => s.Date,
                        (d, s) => new
                        {
                            Day = d.ToString("MMM d"), // "Jan 1"
                            Sales = s.Sum(x => x.Sales)
                        })
                        .ToList();
                }

                // E. Booking Stats
                var bookingStats = new
                {
                    TotalRevenue = orders.Sum(o => o.BookingCharge),
                    TotalBookings = orders.Count(o => o.BookingCharge > 0 || o.BookingId != null)
                };

                // F. Payment Method Stats
                var paymentMethodStats = payments
                    .GroupBy(p => p.Method)
                    .Select(g => new
                    {
                        Method = g.Key,
                        Count = g.Count(),
                        Total = g.Sum(p => p.Amount)
                    })
                    .OrderByDescending(x => x.Total)
                    .ToList();

                // G. Category Sales
                // Need to join OrderItems with MenuItems (or just use name grouping if categories not stored in OrderItem)
                // Note: OrderItem doesn't store Category directly. We might need to look up MenuItems.
                // For performance, let's fetch essential menu data first.
                var menuItems = await _context.MenuItems.Select(m => new { m.Id, m.Category }).ToListAsync();
                var menuCategoryMap = menuItems.ToDictionary(m => m.Id, m => m.Category);

                var categorySales = orders
                    .SelectMany(o => o.Items)
                    .GroupBy(i => menuCategoryMap.ContainsKey(i.MenuItemId) ? menuCategoryMap[i.MenuItemId] : "Uncategorized")
                    .Select(g => new
                    {
                        Category = g.Key ?? "Uncategorized", // Handle null categories
                        Revenue = g.Sum(i => i.Quantity * i.Price),
                        ItemsSold = g.Sum(i => i.Quantity)
                    })
                    .OrderByDescending(x => x.Revenue)
                    .ToList();

                // H. Order Type Breakdown
                var orderTypeStats = orders
                    .GroupBy(o => o.OrderType)
                    .Select(g => new
                    {
                        Type = g.Key,
                        Count = g.Count(),
                        Revenue = g.Sum(o => o.Total)
                    })
                    .ToList();

                // I. Cash Drawer Aggregation (Time Range Aware)
                var firstDateNepal = TimeZoneInfo.ConvertTimeFromUtc(startUtc, NepalTimeZone).Date;
                var lastDateNepal = TimeZoneInfo.ConvertTimeFromUtc(endUtc, NepalTimeZone).Date;
                var endOfDayNepal = lastDateNepal.AddDays(1).AddTicks(-1);

                var managerAdded = await _context.CashTransactions
                    .Where(t => t.Type == "Add" && t.Date >= firstDateNepal && t.Date <= endOfDayNepal)
                    .SumAsync(t => (decimal?)t.Amount) ?? 0;

                var managerRemoved = await _context.CashTransactions
                    .Where(t => t.Type == "Remove" && t.Date >= firstDateNepal && t.Date <= endOfDayNepal)
                    .SumAsync(t => (decimal?)t.Amount) ?? 0;

                var cashSales = payments.Where(p => p.Method.ToLower() == "cash").Sum(p => p.Amount);

                // Opening Cash is from the last closed session BEFORE the range started
                var lastClosingBeforeRange = await _context.CashClosings
                    .Where(c => c.Date < firstDateNepal)
                    .OrderByDescending(c => c.Date)
                    .FirstOrDefaultAsync();

                var openingCash = lastClosingBeforeRange?.CashInDrawer ?? 0m;

                var closingsInRange = await _context.CashClosings
                    .Where(c => c.Date >= firstDateNepal && c.Date <= endOfDayNepal)
                    .OrderBy(c => c.Date)
                    .ToListAsync();

                var cashExpenses = closingsInRange.Sum(c => c.CashExpenses);

                var expectedCash = openingCash + cashSales + managerAdded - managerRemoved - cashExpenses;

                var lastClosingInRange = closingsInRange.LastOrDefault();
                
                // If the selected range is entirely in the past, or if today's session is closed:
                var isClosed = (lastDateNepal < now.Date) || closingsInRange.Any(c => c.Date == lastDateNepal);
                
                var cashInDrawer = lastClosingInRange?.CashInDrawer ?? 0m;
                var difference = isClosed && lastClosingInRange != null ? (cashInDrawer - expectedCash) : 0m;

                var drawerData = new 
                {
                    cashSales,
                    managerAdded,
                    managerRemoved,
                    openingCash,
                    expectedCash,
                    cashInDrawer,
                    difference,
                    closed = isClosed
                };

                return Ok(new
                {
                    totalSales,
                    totalOrders = totalOrdersCount,
                    totalItemsSold,
                    averageOrderValue,
                    topItems,
                    busyHours,
                    salesByDay = salesChartData,
                    bookingStats,
                    paymentMethodStats,
                    categorySales,
                    orderTypeStats,
                    drawerData
                });

            }
            catch (Exception ex)
            {
                // Log error
                return StatusCode(500, new { message = "Failed to generate insights", error = ex.Message, stackTrace = ex.StackTrace });
            }
        }
    }
}

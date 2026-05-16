using cafeSystem.Data;
using cafeSystem.Models;
using cafeSystem.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CashClosingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IEmailService _emailService;

        // Nepal Standard Time (UTC+5:45)
        private static readonly TimeZoneInfo NepalTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Nepal Standard Time");

        public CashClosingController(ApplicationDbContext context, IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        private DateTime GetNepalCurrentDate()
        {
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NepalTimeZone).Date;
        }

        /// <summary>
        /// Gets the opening cash balance for a given target date using a Carry-Forward model.
        /// Logic:
        ///   Find the last closed session before the target date.
        ///   If found, Base = last closing's ActualCash (CashInDrawer).
        ///   If not found, Base = 0.
        ///   Returns Base and UnclosedSince for subsequent calculations.
        /// </summary>
        private async Task<(decimal OpeningCash, DateTime UnclosedSince)> GetOpeningCashBalance(DateTime targetDate)
        {
            var lastClosing = await _context.CashClosings
                .Where(c => c.Date < targetDate.Date)
                .OrderByDescending(c => c.Date)
                .FirstOrDefaultAsync();

            decimal baseBalance;
            DateTime unclosedSince;

            if (lastClosing != null)
            {
                baseBalance = lastClosing.CashInDrawer; // Actual cash counted on that day
                unclosedSince = lastClosing.Date.AddDays(1); // Start accumulating from the day after the last close
            }
            else
            {
                baseBalance = 0m;
                unclosedSince = DateTime.MinValue; 
            }

            return (baseBalance, unclosedSince);
        }

        // GET: api/cash-closing?date=2024-05-20
        [HttpGet]
        [Route("/api/cash-closing")]
        [Route("/api/cashier/cash-closing")]
        public async Task<IActionResult> GetReport([FromQuery] DateTime? date)
        {
            var targetDate = date?.Date ?? GetNepalCurrentDate();
            var startOfDay = targetDate.Date;
            var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

            var openingData = await GetOpeningCashBalance(targetDate);
            var openingCash = openingData.OpeningCash;
            var unclosedSince = openingData.UnclosedSince;

            DateTime transactionStartDate = (unclosedSince != DateTime.MinValue && unclosedSince < startOfDay) 
                                                ? unclosedSince : startOfDay;

            var existingClosing = await _context.CashClosings
                .FirstOrDefaultAsync(c => c.Date >= startOfDay && c.Date <= endOfDay);

            // DB-LEVEL AGGREGATION FOR PAYMENTS
            var paymentAggregates = await _context.Payments
                .Where(p => p.PaymentDate >= transactionStartDate && p.PaymentDate <= endOfDay)
                .GroupBy(p => p.Method.ToLower())
                .Select(g => new { Method = g.Key, Amount = g.Sum(p => p.Amount), Count = g.Count() })
                .ToListAsync();

            var totalSales = paymentAggregates.Sum(a => a.Amount);
            var cashSales = paymentAggregates.FirstOrDefault(a => a.Method == "cash")?.Amount ?? 0;
            var cardSales = paymentAggregates.FirstOrDefault(a => a.Method == "card")?.Amount ?? 0;
            var mobileSales = paymentAggregates.FirstOrDefault(a => a.Method == "mobile")?.Amount ?? 0;

            var cashCount = paymentAggregates.FirstOrDefault(a => a.Method == "cash")?.Count ?? 0;
            var cardCount = paymentAggregates.FirstOrDefault(a => a.Method == "card")?.Count ?? 0;
            var mobileCount = paymentAggregates.FirstOrDefault(a => a.Method == "mobile")?.Count ?? 0;
            
            // DB-LEVEL AGGREGATION FOR ORDERS (JUST COUNT)
            var totalOrders = await _context.Orders
                .Where(o => o.CreatedAt >= transactionStartDate && o.CreatedAt <= endOfDay && o.Status != "Cancelled")
                .CountAsync();

            var managerAdded = await _context.CashTransactions
                .Where(t => t.Type == "Add" && t.Date >= transactionStartDate && t.Date <= endOfDay)
                .SumAsync(t => (decimal?)t.Amount) ?? 0;

            var managerRemoved = await _context.CashTransactions
                .Where(t => t.Type == "Remove" && t.Date >= transactionStartDate && t.Date <= endOfDay)
                .SumAsync(t => (decimal?)t.Amount) ?? 0;

            
            var cashExpenses = existingClosing?.CashExpenses ?? 0;
            var cashInDrawer = existingClosing?.CashInDrawer ?? 0;

            var expectedCash = openingCash + cashSales + managerAdded - managerRemoved - cashExpenses;
            
            var difference = existingClosing != null ? (cashInDrawer - expectedCash) : 0;

            var report = new
            {
                Date = startOfDay.ToString("yyyy-MM-dd"),
                TotalSales = totalSales,
                TotalOrders = totalOrders,
                CashSales = cashSales,
                CardSales = cardSales,
                MobileSales = mobileSales,

                Closed = existingClosing != null,
                OpeningCash = openingCash,
                CashInDrawer = cashInDrawer,
                CashExpenses = cashExpenses,
                
                ManagerAdded = managerAdded,
                ManagerRemoved = managerRemoved,

                ExpectedCash = expectedCash,
                Difference = difference,

                Notes = existingClosing?.Notes,
                SubmittedByUserName = existingClosing?.SubmittedByUserName,
                
                PaymentBreakdown = new
                {
                    Cash = cashSales,
                    Card = cardSales,
                    Digital = mobileSales
                },
                CashCount = cashCount,
                CardCount = cardCount,
                MobileCount = mobileCount,
                
                DiscountsApplied = 0,
                Refunds = 0
            };

            return Ok(report);
        }

        // POST: api/cash-closing
        [HttpPost]
        [Route("/api/cash-closing")]
        [Route("/api/cashier/cash-closing")]
        [Authorize]
        public async Task<IActionResult> SubmitClosing([FromBody] CashClosingSubmission closingData)
        {
            if (closingData == null)
                return BadRequest("Invalid data.");

            var targetDate = closingData.Date?.Date ?? GetNepalCurrentDate();
            var startOfDay = targetDate;
            var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

            var openingData = await GetOpeningCashBalance(targetDate);
            var baseOpeningCash = openingData.OpeningCash;
            var unclosedSince = openingData.UnclosedSince;

            var openingCash = closingData.OpeningCash ?? baseOpeningCash;

            DateTime transactionStartDate = (unclosedSince != DateTime.MinValue && unclosedSince < startOfDay) 
                                                 ? unclosedSince : startOfDay;

            // OPTIMIZED AGGREGATION DURING SUBMISSION
            var paymentAggregates = await _context.Payments
                .Where(p => p.PaymentDate >= transactionStartDate && p.PaymentDate <= endOfDay)
                .GroupBy(p => p.Method.ToLower())
                .Select(g => new { Method = g.Key, Amount = g.Sum(p => p.Amount) })
                .ToListAsync();

            var totalSales = paymentAggregates.Sum(a => a.Amount);
            var cashSales = paymentAggregates.FirstOrDefault(a => a.Method == "cash")?.Amount ?? 0;
            var cardSales = paymentAggregates.FirstOrDefault(a => a.Method == "card")?.Amount ?? 0;
            var mobileSales = paymentAggregates.FirstOrDefault(a => a.Method == "mobile")?.Amount ?? 0;

            var orders = await _context.Orders
                 .Where(o => o.CreatedAt >= transactionStartDate && o.CreatedAt <= endOfDay && o.Status != "Cancelled")
                 .CountAsync();

            var managerAdded = await _context.CashTransactions
                .Where(t => t.Type == "Add" && t.Date >= transactionStartDate && t.Date <= endOfDay)
                .SumAsync(t => (decimal?)t.Amount) ?? 0;

            var managerRemoved = await _context.CashTransactions
                .Where(t => t.Type == "Remove" && t.Date >= transactionStartDate && t.Date <= endOfDay)
                .SumAsync(t => (decimal?)t.Amount) ?? 0;


            // Get current user info from token email
            var userEmail = User.FindFirst(ClaimTypes.Name)?.Value;
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == userEmail);

            var existing = await _context.CashClosings
                .FirstOrDefaultAsync(c => c.Date >= startOfDay && c.Date <= endOfDay);

            if (existing != null)
            {
                existing.CashInDrawer = closingData.CashInDrawer;
                existing.CashExpenses = closingData.CashExpenses ?? 0;
                existing.Notes = closingData.Notes;
                existing.ClosedAt = DateTime.UtcNow;
                existing.TotalSales = totalSales;
                existing.CashSales = cashSales;
                existing.CardSales = cardSales;
                existing.MobileSales = mobileSales;
                existing.TotalOrders = orders;
                existing.OpeningCash = openingCash;
                
                // Track submitter
                existing.SubmittedByUserId = currentUser?.Id;
                existing.SubmittedByUserName = currentUser?.Name ?? currentUser?.Email;
                
                _context.CashClosings.Update(existing);
            }
            else
            {
                var newClosing = new CashClosing
                {
                    Date = targetDate,
                    CashInDrawer = closingData.CashInDrawer,
                    CashExpenses = closingData.CashExpenses ?? 0,
                    Notes = closingData.Notes,
                    TotalSales = totalSales,
                    TotalOrders = orders,
                    CashSales = cashSales,
                    CardSales = cardSales,
                    MobileSales = mobileSales,
                    OpeningCash = openingCash,
                    
                    // Track submitter
                    SubmittedByUserId = currentUser?.Id,
                    SubmittedByUserName = currentUser?.Name ?? currentUser?.Email
                };
                _context.CashClosings.Add(newClosing);
            }

            await _context.SaveChangesAsync();

            try 
            {
                var manager = await _context.Users.FirstOrDefaultAsync(u => u.Role == "Manager");
                if (manager != null)
                {
                    var expectedCash = openingCash + cashSales + managerAdded - managerRemoved - (closingData.CashExpenses ?? 0);
                    var difference = closingData.CashInDrawer - expectedCash;

                    var reportData = new 
                    {
                        Date = targetDate,
                        TotalSales = totalSales,
                        TotalOrders = orders,
                        OpeningCash = openingCash,
                        CashInDrawer = closingData.CashInDrawer,
                        CashSales = cashSales,
                        CardSales = cardSales,
                        MobileSales = mobileSales,
                        CashExpenses = closingData.CashExpenses ?? 0,
                        ExpectedCash = expectedCash,
                        Difference = difference,
                        Notes = closingData.Notes,
                        SubmittedBy = currentUser?.Name ?? currentUser?.Email
                    };

                    await _emailService.SendCashClosingReportAsync(manager.Email, reportData);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error triggering closing email: {ex.Message}");
            }

            return Ok(new { Message = "Day closed successfully." });
        }



        public class CashClosingSubmission
        {
            public DateTime? Date { get; set; }
            public decimal CashInDrawer { get; set; }
            public decimal? CashExpenses { get; set; }
            public decimal? OpeningCash { get; set; }
            public string? Notes { get; set; }
        }
    }
}

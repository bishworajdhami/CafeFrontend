using cafeSystem.Data;
using cafeSystem.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ManagerCashController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        // Nepal Standard Time (UTC+5:45)
        private static readonly TimeZoneInfo NepalTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Nepal Standard Time");

        public ManagerCashController(ApplicationDbContext context)
        {
            _context = context;
        }

        private DateTime GetNepalCurrentDate()
        {
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NepalTimeZone);
        }

        public class CashAdjustmentRequest
        {
            public decimal Amount { get; set; }
            public string Reason { get; set; }
        }

        [HttpPost("add")]
        public async Task<IActionResult> AddCash([FromBody] CashAdjustmentRequest req)
        {
            if (req.Amount <= 0)
                return BadRequest(new { status = false, message = "Amount must be greater than zero." });

            var transaction = new CashTransaction
            {
                Amount = req.Amount,
                Type = "Add",
                Reason = req.Reason,
                Date = GetNepalCurrentDate(),
            };

            _context.CashTransactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(new { status = true, message = "Cash added successfully." });
        }

        [HttpPost("remove")]
        public async Task<IActionResult> RemoveCash([FromBody] CashAdjustmentRequest req)
        {
            if (req.Amount <= 0)
                return BadRequest(new { status = false, message = "Amount must be greater than zero." });

            var transaction = new CashTransaction
            {
                Amount = req.Amount,
                Type = "Remove",
                Reason = req.Reason,
                Date = GetNepalCurrentDate(),
            };

            _context.CashTransactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(new { status = true, message = "Cash removed successfully." });
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(DateTime? fromDate = null, DateTime? toDate = null)
        {
            var query = _context.CashTransactions.AsQueryable();

            if (fromDate.HasValue)
            {
                query = query.Where(t => t.Date >= fromDate.Value);
            }
            else
            {
                // Default to today if no date range provided
                var today = GetNepalCurrentDate().Date;
                query = query.Where(t => t.Date >= today);
            }

            if (toDate.HasValue)
            {
                // toDate usually means "up to the end of this day" if only date is provided
                var endOfToDate = toDate.Value.Date.AddDays(1);
                query = query.Where(t => t.Date < endOfToDate);
            }
            else if (!fromDate.HasValue)
            {
                // If it was default today, set the end boundary too
                var tomorrow = GetNepalCurrentDate().Date.AddDays(1);
                query = query.Where(t => t.Date < tomorrow);
            }

            var transactions = await query
                .OrderByDescending(t => t.Date)
                .Select(t => new { 
                    id = t.Id, 
                    date = t.Date, 
                    type = t.Type, 
                    amount = t.Amount, 
                    reason = t.Reason 
                })
                .ToListAsync();

            return Ok(transactions);
        }
    }
}

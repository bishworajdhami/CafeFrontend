using cafeSystem.Data;
using cafeSystem.DTOs;
using cafeSystem.Models;
using cafeSystem.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace cafeSystem.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StockController : ControllerBase
    {
        private readonly StockService _stockService;
        private readonly ApplicationDbContext _context;

        public StockController(StockService stockService, ApplicationDbContext context)
        {
            _stockService = stockService;
            _context = context;
        }

        // GET: api/stock/insights?range=daily&customStartDate=&customEndDate=
        [HttpGet("insights")]
        public async Task<IActionResult> GetStockInsights(
            [FromQuery] string range = "daily",
            [FromQuery] DateTime? customStartDate = null,
            [FromQuery] DateTime? customEndDate = null)
        {
            var now = DateTime.UtcNow;
            DateTime startDate;
            DateTime endDate = now;

            switch (range)
            {
                case "weekly":
                    startDate = now.AddDays(-6).Date;
                    break;
                case "monthly":
                    startDate = new DateTime(now.Year, now.Month, 1);
                    break;
                case "yearly":
                    startDate = new DateTime(now.Year, 1, 1);
                    break;
                case "custom" when customStartDate.HasValue && customEndDate.HasValue:
                    startDate = customStartDate.Value.ToUniversalTime().Date;
                    endDate = customEndDate.Value.ToUniversalTime().Date.AddDays(1).AddTicks(-1);
                    break;
                default: // daily
                    startDate = now.Date;
                    break;
            }

            // Load transactions in the date range
            var transactions = await _context.StockTransactions
                .Where(t => t.Date >= startDate && t.Date <= endDate)
                .ToListAsync();

            // Load batch cost lookup (BatchId → CostPerUnit) for value estimation
            var batchIds = transactions
                .Where(t => t.BatchId.HasValue)
                .Select(t => t.BatchId!.Value)
                .Distinct()
                .ToList();

            var batchCosts = await _context.StockBatches
                .Where(b => batchIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, b => b.CostPerUnit);

            decimal CostFor(StockTransaction t) =>
                t.BatchId.HasValue && batchCosts.TryGetValue(t.BatchId.Value, out var c) ? c : 0m;

            // ─── 1. Purchasing Spend (Type = "Purchase", positive Change) ────
            var purchaseTxns = transactions
                .Where(t => t.Type == "Purchase" && t.Change > 0)
                .ToList();

            IEnumerable<object> BuildPurchaseGroups(IEnumerable<IGrouping<string, StockTransaction>> groups) =>
                groups.Select(g => (object)new
                {
                    label = g.Key,
                    amount = Math.Round(g.Sum(t => t.Change * CostFor(t)), 2)
                });

            var purchaseSpend = (range switch
            {
                "yearly" => BuildPurchaseGroups(
                    purchaseTxns.GroupBy(t => t.Date.ToString("MMM"))
                        .OrderBy(g => DateTime.ParseExact(g.Key, "MMM",
                            System.Globalization.CultureInfo.InvariantCulture).Month)),
                "monthly" => BuildPurchaseGroups(
                    purchaseTxns.GroupBy(t => t.Date.Day.ToString("D2"))
                        .OrderBy(g => int.Parse(g.Key))),
                "weekly" => BuildPurchaseGroups(
                    purchaseTxns.GroupBy(t => t.Date.ToString("ddd"))
                        .OrderBy(g => (int)g.First().Date.DayOfWeek)),
                _ => BuildPurchaseGroups(
                    purchaseTxns.GroupBy(t => t.Date.ToString("HH:00"))
                        .OrderBy(g => g.Key))
            }).ToList();

            var totalPurchaseSpend = Math.Round(purchaseTxns.Sum(t => t.Change * CostFor(t)), 2);

            // ─── 2. Wastage & Shrinkage (manual removals + expired stock) ───
            var wastageTxns = transactions
                .Where(t => t.Change < 0 &&
                            (t.Type == "Adjustment" || t.Type == "Expired") &&
                            t.Reason != "Auto Daily Usage" &&
                            !string.IsNullOrEmpty(t.Reason))
                .ToList();

            var wastageByReason = wastageTxns
                .GroupBy(t => t.Type == "Expired" ? "Expired" : (t.Reason ?? "Other"))
                .Select(g => (object)new
                {
                    reason = g.Key,
                    units = Math.Round(Math.Abs(g.Sum(t => t.Change)), 2),
                    estimatedValue = Math.Round(Math.Abs(g.Sum(t => t.Change * CostFor(t))), 2)
                })
                .OrderByDescending(x => ((dynamic)x).estimatedValue)
                .ToList();

            return Ok(new
            {
                purchaseSpend,
                totalPurchaseSpend,
                wastageByReason,
                totalWastageUnits = Math.Round(Math.Abs(wastageTxns.Sum(t => t.Change)), 2),
                totalWastageValue = Math.Round(Math.Abs(wastageTxns.Sum(t => t.Change * CostFor(t))), 2)
            });
        }

        // GET: api/stock?includeArchived=false
        [HttpGet]
        public async Task<ActionResult<IEnumerable<StockItemDto>>> GetStockItems(
            [FromQuery] bool includeArchived = false)
        {
            var items = await _stockService.GetAllAsync(includeArchived);
            return Ok(items);
        }

        // GET: api/stock/summary — global KPI counts + total inventory value
        [HttpGet("summary")]
        public async Task<ActionResult<StockGlobalSummaryDto>> GetSummary()
        {
            var summary = await _stockService.GetSummaryAsync();
            return Ok(summary);
        }

        // GET: api/stock/5
        [HttpGet("{id}")]
        public async Task<ActionResult<StockItemDto>> GetStockItem(int id)
        {
            var item = await _stockService.GetByIdAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        // GET: api/stock/5/batches
        [HttpGet("{id}/batches")]
        public async Task<ActionResult<IEnumerable<StockBatchDto>>> GetBatches(int id)
        {
            var batches = await _stockService.GetBatchesAsync(id);
            return Ok(batches);
        }

        // GET: api/stock/5/history?page=1&pageSize=20
        [HttpGet("{id}/history")]
        public async Task<ActionResult<IEnumerable<StockHistoryDto>>> GetHistory(
            int id,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;
            var history = await _stockService.GetHistoryAsync(id, page, pageSize);
            return Ok(history);
        }

        // GET: api/stock/expiring?days=7
        [HttpGet("expiring")]
        public async Task<ActionResult<IEnumerable<StockItemDto>>> GetExpiring([FromQuery] int days = 7)
        {
            if (days < 1) days = 7;
            var items = await _stockService.GetExpiringAsync(days);
            return Ok(items);
        }

        // POST: api/stock
        [HttpPost]
        public async Task<ActionResult<StockItemDto>> CreateProduct(CreateStockItemDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var result = await _stockService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetStockItem), new { id = result.Id }, result);
        }

        // PUT: api/stock/5
        [HttpPut("{id}")]
        public async Task<ActionResult<StockItemDto>> UpdateProduct(int id, UpdateStockItemDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var result = await _stockService.UpdateAsync(id, dto);
            if (result == null) return NotFound();
            return Ok(result);
        }

        // DELETE: api/stock/5 — soft delete (archive)
        [HttpDelete("{id}")]
        public async Task<IActionResult> ArchiveProduct(int id)
        {
            var archived = await _stockService.ArchiveAsync(id);
            if (!archived) return NotFound();
            return NoContent();
        }

        // POST: api/stock/5/restore — un-archive a product
        [HttpPost("{id}/restore")]
        public async Task<ActionResult<StockItemDto>> RestoreProduct(int id)
        {
            var restored = await _stockService.RestoreAsync(id);
            if (!restored) return NotFound();
            var item = await _stockService.GetByIdAsync(id);
            return Ok(item);
        }

        // POST: api/stock/5/add
        [HttpPost("{id}/add")]
        public async Task<ActionResult<StockSummaryDto>> AddStock(int id, AddStockDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var performedBy = User.Identity?.Name;
            var (summary, error) = await _stockService.AddStockAsync(id, dto, performedBy);
            if (error != null) return BadRequest(new { message = error });
            return Ok(summary);
        }

        // POST: api/stock/5/adjust
        [HttpPost("{id}/adjust")]
        public async Task<ActionResult<StockSummaryDto>> AdjustStock(int id, AdjustStockDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var performedBy = User.Identity?.Name;
            var (summary, error) = await _stockService.AdjustStockAsync(id, dto, performedBy);
            if (error != null) return BadRequest(new { message = error });
            return Ok(summary);
        }

        // POST: api/stock/apply-daily-usage — apply for ALL products
        [HttpPost("apply-daily-usage")]
        public async Task<IActionResult> ApplyDailyUsage()
        {
            var breached = await _stockService.ApplyDailyUsageAsync();
            return Ok(new
            {
                message = "Daily usage applied for all products.",
                newlyBreachedCount = breached.Count,
                newlyBreached = breached.Select(p => new { p.Id, p.Name, p.DaysRemaining })
            });
        }

        // POST: api/stock/5/apply-daily-usage — apply for ONE product
        [HttpPost("{id}/apply-daily-usage")]
        public async Task<ActionResult<StockItemDto>> ApplyDailyUsageForProduct(int id)
        {
            await _stockService.ApplyDailyUsageAsync(id);
            var item = await _stockService.GetByIdAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        // POST: api/stock/expire-batches — manually trigger expiry sweep
        [HttpPost("expire-batches")]
        public async Task<IActionResult> ExpireBatches()
        {
            await _stockService.ExpireStaleBatchesAsync();
            return Ok(new { message = "Expired batches swept." });
        }
    }
}

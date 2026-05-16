using cafeSystem.Data;
using cafeSystem.DTOs;
using cafeSystem.Models;
using Microsoft.EntityFrameworkCore;

namespace cafeSystem.Services
{
    public class StockService
    {
        private readonly ApplicationDbContext _context;

        public StockService(ApplicationDbContext context)
        {
            _context = context;
        }

        // ─── READ ──────────────────────────────────────────────────────────────

        public async Task<IEnumerable<StockItemDto>> GetAllAsync(bool includeArchived = false)
        {
            var products = await _context.Products
                .Include(p => p.Batches)
                .Where(p => includeArchived || !p.IsArchived)
                .ToListAsync();

            return products.Select(MapToDto);
        }

        public async Task<StockItemDto?> GetByIdAsync(int id)
        {
            var product = await _context.Products
                .Include(p => p.Batches)
                .FirstOrDefaultAsync(p => p.Id == id);

            return product == null ? null : MapToDto(product);
        }

        public async Task<StockGlobalSummaryDto> GetSummaryAsync()
        {
            var products = await _context.Products
                .Include(p => p.Batches)
                .Where(p => !p.IsArchived)
                .ToListAsync();

            var dtos = products.Select(MapToDto).ToList();
            var now = DateTime.UtcNow.AddDays(7);

            return new StockGlobalSummaryDto
            {
                TotalProducts = dtos.Count,
                NeedsReorderCount = dtos.Count(d => d.NeedsReorder),
                OutOfStockCount = dtos.Count(d => d.OutOfStock),
                ExpiringCount = dtos.Count(d => d.ExpiringBatchCount > 0),
                TotalInventoryValue = dtos.Sum(d => d.TotalValue)
            };
        }

        public async Task<IEnumerable<StockBatchDto>> GetBatchesAsync(int productId)
        {
            var batches = await _context.StockBatches
                .Where(b => b.ProductId == productId && b.IsActive && b.Quantity > 0)
                .OrderBy(b => b.ExpiryDate)
                .ToListAsync();

            return batches.Select(MapBatchToDto);
        }

        public async Task<IEnumerable<StockHistoryDto>> GetHistoryAsync(int productId, int page, int pageSize)
        {
            return await _context.StockTransactions
                .Where(t => t.ProductId == productId)
                .OrderByDescending(t => t.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new StockHistoryDto
                {
                    Id = t.Id,
                    Date = t.Date,
                    Type = t.Type,
                    Change = t.Change,
                    Reason = t.Reason,
                    PerformedBy = t.PerformedBy
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<StockItemDto>> GetExpiringAsync(int days)
        {
            var cutoff = DateTime.UtcNow.AddDays(days);
            var products = await _context.Products
                .Include(p => p.Batches)
                .Where(p => !p.IsArchived && p.Batches.Any(b => b.IsActive && b.Quantity > 0 && b.ExpiryDate <= cutoff))
                .ToListAsync();

            return products.Select(MapToDto);
        }

        // ─── CREATE ────────────────────────────────────────────────────────────

        public async Task<StockItemDto> CreateAsync(CreateStockItemDto dto)
        {
            var product = new Product
            {
                Name = dto.Name,
                Category = dto.Category,
                Unit = dto.Unit,
                MinStockLevel = dto.MinStock,
                ShelfLifeDays = dto.EstimatedDurationDays ?? 0,
                Supplier = dto.Supplier,
                Price = dto.Price,
                DailyUsageRate = dto.DailyUsageRate,
                ReorderDays = dto.ReorderDays
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            if (dto.CurrentStock > 0)
            {
                var expiry = product.ShelfLifeDays > 0
                    ? DateTime.UtcNow.AddDays(product.ShelfLifeDays)
                    : DateTime.UtcNow.AddDays(365);

                var batch = new StockBatch
                {
                    ProductId = product.Id,
                    Quantity = dto.CurrentStock,
                    ReceivedDate = DateTime.UtcNow,
                    ExpiryDate = expiry,
                    CostPerUnit = dto.Price,
                    IsActive = true,
                    Notes = "Opening balance"
                };
                _context.StockBatches.Add(batch);
                await _context.SaveChangesAsync();

                _context.StockTransactions.Add(new StockTransaction
                {
                    ProductId = product.Id,
                    BatchId = batch.Id,
                    Change = dto.CurrentStock,
                    Type = "Opening Balance",
                    Date = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            await _context.Entry(product).Collection(p => p.Batches).LoadAsync();
            return MapToDto(product);
        }

        // ─── UPDATE ────────────────────────────────────────────────────────────

        public async Task<StockItemDto?> UpdateAsync(int id, UpdateStockItemDto dto)
        {
            var product = await _context.Products
                .Include(p => p.Batches)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null) return null;

            product.Name = dto.Name;
            product.MinStockLevel = dto.MinStock;
            product.Unit = dto.Unit;
            product.Category = dto.Category;
            product.ShelfLifeDays = dto.EstimatedDurationDays ?? product.ShelfLifeDays;
            product.Supplier = dto.Supplier;
            product.Price = dto.Price;
            product.DailyUsageRate = dto.DailyUsageRate;
            product.ReorderDays = dto.ReorderDays;

            await _context.SaveChangesAsync();
            return MapToDto(product);
        }

        // ─── SOFT DELETE (Archive) ─────────────────────────────────────────────

        public async Task<bool> ArchiveAsync(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return false;

            product.IsArchived = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreAsync(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return false;

            product.IsArchived = false;
            await _context.SaveChangesAsync();
            return true;
        }

        // ─── ADD STOCK ─────────────────────────────────────────────────────────

        public async Task<(StockSummaryDto? summary, string? error)> AddStockAsync(
            int productId, AddStockDto dto, string? performedBy)
        {
            var product = await _context.Products
                .Include(p => p.Batches)
                .FirstOrDefaultAsync(p => p.Id == productId && !p.IsArchived);

            if (product == null) return (null, "Product not found.");
            if (dto.Quantity <= 0) return (null, "Quantity must be greater than zero.");

            DateTime expiryDate;
            if (dto.ExpiryDate.HasValue)
                expiryDate = dto.ExpiryDate.Value.ToUniversalTime();
            else if (product.ShelfLifeDays > 0)
                expiryDate = DateTime.UtcNow.AddDays(product.ShelfLifeDays);
            else
                expiryDate = DateTime.UtcNow.AddDays(365);

            var batch = new StockBatch
            {
                ProductId = productId,
                Quantity = dto.Quantity,
                ReceivedDate = DateTime.UtcNow,
                ExpiryDate = expiryDate,
                CostPerUnit = dto.CostPerUnit,
                Supplier = dto.Supplier ?? product.Supplier,
                Notes = dto.Notes,
                IsActive = true
            };
            _context.StockBatches.Add(batch);
            await _context.SaveChangesAsync();

            _context.StockTransactions.Add(new StockTransaction
            {
                ProductId = productId,
                BatchId = batch.Id,
                Change = dto.Quantity,
                Type = "Purchase",
                Date = DateTime.UtcNow,
                PerformedBy = performedBy
            });
            await _context.SaveChangesAsync();

            await _context.Entry(product).Collection(p => p.Batches).LoadAsync();
            return (BuildSummary(product), null);
        }

        // ─── ADJUST STOCK ──────────────────────────────────────────────────────

        public async Task<(StockSummaryDto? summary, string? error)> AdjustStockAsync(
            int productId, AdjustStockDto dto, string? performedBy)
        {
            var product = await _context.Products
                .Include(p => p.Batches)
                .FirstOrDefaultAsync(p => p.Id == productId && !p.IsArchived);

            if (product == null) return (null, "Product not found.");

            decimal amountToRemove = -dto.Quantity;
            if (amountToRemove <= 0) return (null, "Quantity to remove must be positive.");

            string? error = null;
            List<StockTransaction> transactions = new();

            if (dto.BatchId.HasValue)
            {
                var batch = product.Batches.FirstOrDefault(b => b.Id == dto.BatchId.Value && b.IsActive && b.Quantity > 0);
                if (batch == null) return (null, "Specified batch not found or is empty.");
                if (amountToRemove > batch.Quantity) return (null, $"Insufficient stock in the specified batch. Available: {batch.Quantity} {product.Unit}, requested: {amountToRemove}.");

                batch.Quantity -= amountToRemove;
                if (batch.Quantity == 0) batch.IsActive = false;

                transactions.Add(new StockTransaction
                {
                    ProductId = product.Id,
                    BatchId = batch.Id,
                    Change = -amountToRemove,
                    Type = "Adjustment",
                    Reason = dto.Reason ?? "Manual Adjustment",
                    Date = DateTime.UtcNow,
                    PerformedBy = performedBy
                });
            }
            else
            {
                var result = DeductFifo(product, amountToRemove, dto.Reason ?? "Manual Adjustment", "Adjustment", performedBy);
                error = result.error;
                transactions = result.transactions;
            }

            if (error != null) return (null, error);

            foreach (var t in transactions) _context.StockTransactions.Add(t);
            await _context.SaveChangesAsync();

            await _context.Entry(product).Collection(p => p.Batches).LoadAsync();
            return (BuildSummary(product), null);
        }

        // ─── APPLY DAILY USAGE ─────────────────────────────────────────────────

        /// <summary>
        /// Deducts DailyUsageRate for all missed days since LastAutoDeductionDate.
        /// Idempotent — safe to call multiple times for the same day.
        /// Returns list of products that newly crossed their ReorderDays threshold.
        /// </summary>
        public async Task<List<StockItemDto>> ApplyDailyUsageAsync(int? specificProductId = null)
        {
            var query = _context.Products
                .Include(p => p.Batches)
                .Where(p => !p.IsArchived && p.DailyUsageRate > 0);

            if (specificProductId.HasValue)
                query = query.Where(p => p.Id == specificProductId.Value);

            var products = await query.ToListAsync();
            var today = DateTime.UtcNow.Date;
            var newlyBreached = new List<StockItemDto>();

            foreach (var product in products)
            {
                var lastRun = product.LastAutoDeductionDate?.Date;
                if (lastRun == today) continue;

                // Snapshot before — was it already in reorder state?
                var beforeStock = product.Batches.Where(b => b.IsActive && b.Quantity > 0).Sum(b => b.Quantity);
                var wasOk = product.DailyUsageRate > 0 && (beforeStock / product.DailyUsageRate) > product.ReorderDays;

                var startDate = lastRun.HasValue ? lastRun.Value.AddDays(1) : today;
                var daysToApply = (int)(today - startDate).TotalDays + 1;

                if (daysToApply > 0)
                {
                    var totalToDeduct = Math.Min(product.DailyUsageRate * daysToApply,
                        product.Batches.Where(b => b.IsActive && b.Quantity > 0).Sum(b => b.Quantity));

                    if (totalToDeduct > 0)
                    {
                        var reason = daysToApply == 1
                            ? "Auto Daily Usage"
                            : $"Auto Daily Usage (catch-up ×{daysToApply} days)";

                        var (err, txns) = DeductFifo(product, totalToDeduct, reason, "Auto Daily Usage", "System");
                        if (err == null) foreach (var t in txns) _context.StockTransactions.Add(t);
                    }
                }

                product.LastAutoDeductionDate = today;

                // Check if this deduction newly crossed the reorder threshold
                var afterDto = MapToDto(product);
                if (wasOk && afterDto.NeedsReorder)
                    newlyBreached.Add(afterDto);
            }

            await _context.SaveChangesAsync();
            return newlyBreached;
        }

        // ─── AUTO-EXPIRE STALE BATCHES ─────────────────────────────────────────

        /// <summary>
        /// Marks all batches past their ExpiryDate as inactive and logs "Expired" transactions.
        /// Called nightly by StockAutoDeductionService.
        /// </summary>
        public async Task ExpireStaleBatchesAsync()
        {
            var now = DateTime.UtcNow;

            var staleBatches = await _context.StockBatches
                .Include(b => b.Product)
                .Where(b => b.IsActive && b.Quantity > 0 && b.ExpiryDate < now)
                .ToListAsync();

            foreach (var batch in staleBatches)
            {
                var expiredQty = batch.Quantity;
                batch.Quantity = 0;
                batch.IsActive = false;

                _context.StockTransactions.Add(new StockTransaction
                {
                    ProductId = batch.ProductId,
                    BatchId = batch.Id,
                    Change = -expiredQty,
                    Type = "Expired",
                    Reason = $"Batch expired on {batch.ExpiryDate:d}",
                    Date = now,
                    PerformedBy = "System"
                });
            }

            if (staleBatches.Count > 0)
                await _context.SaveChangesAsync();
        }

        // ─── FIFO Helper ───────────────────────────────────────────────────────

        private (string? error, List<StockTransaction> transactions) DeductFifo(
            Product product, decimal amount, string reason, string type, string? performedBy)
        {
            var activeBatches = product.Batches
                .Where(b => b.IsActive && b.Quantity > 0)
                .OrderBy(b => b.ExpiryDate)
                .ToList();

            var totalStock = activeBatches.Sum(b => b.Quantity);
            if (amount > totalStock)
                return ($"Insufficient stock. Available: {totalStock} {product.Unit}, requested: {amount}.", new List<StockTransaction>());

            var transactions = new List<StockTransaction>();
            decimal remaining = amount;

            foreach (var batch in activeBatches)
            {
                if (remaining <= 0) break;
                decimal take = Math.Min(remaining, batch.Quantity);
                batch.Quantity -= take;
                if (batch.Quantity == 0) batch.IsActive = false;
                remaining -= take;

                transactions.Add(new StockTransaction
                {
                    ProductId = product.Id,
                    BatchId = batch.Id,
                    Change = -take,
                    Type = type,
                    Reason = reason,
                    Date = DateTime.UtcNow,
                    PerformedBy = performedBy
                });
            }

            return (null, transactions);
        }

        // ─── DTO Mapping ───────────────────────────────────────────────────────

        public StockItemDto MapToDto(Product product)
        {
            var activeBatches = product.Batches
                .Where(b => b.IsActive && b.Quantity > 0)
                .ToList();

            var currentStock = activeBatches.Sum(b => b.Quantity);
            var sevenDaysCutoff = DateTime.UtcNow.AddDays(7);

            // Financial
            var totalValue = activeBatches.Sum(b => b.Quantity * b.CostPerUnit);
            var avgCost = currentStock > 0 ? totalValue / currentStock : 0;

            decimal? daysRemaining = product.DailyUsageRate > 0
                ? Math.Round(currentStock / product.DailyUsageRate, 1)
                : null;

            return new StockItemDto
            {
                Id = product.Id,
                Name = product.Name,
                CurrentStock = currentStock,
                MinStock = product.MinStockLevel,
                Unit = product.Unit,
                Category = product.Category,
                LowStock = currentStock <= product.MinStockLevel,
                ShelfLifeDays = product.ShelfLifeDays,
                Supplier = product.Supplier,
                IsArchived = product.IsArchived,
                Price = product.Price,
                DailyUsageRate = product.DailyUsageRate,
                ReorderDays = product.ReorderDays,
                DaysRemaining = daysRemaining,
                NeedsReorder = daysRemaining.HasValue && daysRemaining <= product.ReorderDays,
                OutOfStock = currentStock == 0,
                LastAutoDeductionDate = product.LastAutoDeductionDate,
                TotalValue = totalValue,
                AverageCostPerUnit = avgCost,
                ExpiringBatchCount = activeBatches.Count(b => b.ExpiryDate <= sevenDaysCutoff),
                EarliestExpiry = activeBatches.Count > 0 ? activeBatches.Min(b => b.ExpiryDate) : null
            };
        }

        public StockSummaryDto BuildSummary(Product product)
        {
            var dto = MapToDto(product);
            return new StockSummaryDto
            {
                CurrentStock = dto.CurrentStock,
                LowStock = dto.LowStock,
                NeedsReorder = dto.NeedsReorder,
                OutOfStock = dto.OutOfStock,
                DaysRemaining = dto.DaysRemaining,
                ExpiringBatchCount = dto.ExpiringBatchCount,
                EarliestExpiry = dto.EarliestExpiry
            };
        }

        private static StockBatchDto MapBatchToDto(StockBatch b) => new()
        {
            Id = b.Id,
            Quantity = b.Quantity,
            ReceivedDate = b.ReceivedDate,
            ExpiryDate = b.ExpiryDate,
            CostPerUnit = b.CostPerUnit,
            Supplier = b.Supplier,
            Notes = b.Notes
        };
    }
}

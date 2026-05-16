namespace cafeSystem.DTOs
{
    public class StockItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal CurrentStock { get; set; }
        public decimal MinStock { get; set; }
        public string Unit { get; set; }
        public string Category { get; set; }
        public bool LowStock { get; set; }
        public int ShelfLifeDays { get; set; }
        public string? Supplier { get; set; }
        public bool IsArchived { get; set; }
        
        public decimal Price { get; set; }

        // Auto daily usage
        public decimal DailyUsageRate { get; set; }
        public int ReorderDays { get; set; }
        public decimal? DaysRemaining { get; set; }
        public bool NeedsReorder { get; set; }
        public bool OutOfStock { get; set; }
        public DateTime? LastAutoDeductionDate { get; set; }

        // Financial
        public decimal TotalValue { get; set; }           // sum(quantity * costPerUnit)
        public decimal AverageCostPerUnit { get; set; }   // TotalValue / CurrentStock

        // Expiry
        public int ExpiringBatchCount { get; set; }
        public DateTime? EarliestExpiry { get; set; }
    }

    public class CreateStockItemDto
    {
        public string Name { get; set; }
        public decimal CurrentStock { get; set; }
        public decimal MinStock { get; set; }
        public string Unit { get; set; }
        public string Category { get; set; }
        public int? EstimatedDurationDays { get; set; }
        public string? Supplier { get; set; }
        public decimal DailyUsageRate { get; set; } = 0;
        public int ReorderDays { get; set; } = 3;
        public decimal Price { get; set; }
    }

    public class UpdateStockItemDto
    {
        public string Name { get; set; }
        public decimal MinStock { get; set; }
        public string Unit { get; set; }
        public string Category { get; set; }
        public int? EstimatedDurationDays { get; set; }
        public string? Supplier { get; set; }
        public decimal DailyUsageRate { get; set; } = 0;
        public int ReorderDays { get; set; } = 3;
        public decimal Price { get; set; }
    }

    // Returned by GET /api/stock/summary
    public class StockGlobalSummaryDto
    {
        public int TotalProducts { get; set; }
        public int NeedsReorderCount { get; set; }
        public int OutOfStockCount { get; set; }
        public int ExpiringCount { get; set; }
        public decimal TotalInventoryValue { get; set; }
    }
}

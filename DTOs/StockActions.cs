namespace cafeSystem.DTOs
{
    // POST /api/stock/{id}/add
    public class AddStockDto
    {
        public decimal Quantity { get; set; }
        public DateTime? ExpiryDate { get; set; }   // From label — overrides ShelfLifeDays default
        public decimal CostPerUnit { get; set; } = 0;
        public string? Supplier { get; set; }
        public string? Notes { get; set; }
    }

    // POST /api/stock/{id}/adjust
    public class AdjustStockDto
    {
        public decimal Quantity { get; set; }  // Always negative (removal)
        public string? Reason { get; set; }
        public int? BatchId { get; set; }      // Optional: Specific batch to remove from
    }

    // Returned by /add and /adjust (lightweight — just the updated fields)
    public class StockSummaryDto
    {
        public decimal CurrentStock { get; set; }
        public bool LowStock { get; set; }
        public bool NeedsReorder { get; set; }
        public bool OutOfStock { get; set; }
        public decimal? DaysRemaining { get; set; }
        public int ExpiringBatchCount { get; set; }
        public DateTime? EarliestExpiry { get; set; }
    }

    // GET /api/stock/{id}/batches
    public class StockBatchDto
    {
        public int Id { get; set; }
        public decimal Quantity { get; set; }
        public DateTime ReceivedDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        public decimal CostPerUnit { get; set; }
        public string? Supplier { get; set; }
        public string? Notes { get; set; }
    }

    // GET /api/stock/{id}/history
    public class StockHistoryDto
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }
        public string Type { get; set; }
        public decimal Change { get; set; }
        public string? Reason { get; set; }
        public string? PerformedBy { get; set; }
    }
}

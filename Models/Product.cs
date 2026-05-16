using System.ComponentModel.DataAnnotations;

namespace cafeSystem.Models
{
    public class Product
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; }

        public string? Description { get; set; }

        [Required]
        public string Category { get; set; }

        [Required]
        public string Unit { get; set; }

        public decimal MinStockLevel { get; set; }
        public int ShelfLifeDays { get; set; }
        public string? Supplier { get; set; }
        
        // Cost
        public decimal Price { get; set; } = 0;

        // Auto daily usage
        public decimal DailyUsageRate { get; set; } = 0;
        public int ReorderDays { get; set; } = 3;
        public DateTime? LastAutoDeductionDate { get; set; }

        // Soft delete — archived products are hidden but history is preserved
        public bool IsArchived { get; set; } = false;

        // Navigation
        public ICollection<StockBatch> Batches { get; set; } = new List<StockBatch>();
    }
}

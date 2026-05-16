using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace cafeSystem.Models
{
    public class StockTransaction
    {
        public int Id { get; set; }

        public int ProductId { get; set; }

        [ForeignKey("ProductId")]
        public Product? Product { get; set; }

        public int? BatchId { get; set; } // Nullable — links to the batch if applicable

        public decimal Change { get; set; } // +50 for purchase, -5 for usage

        [Required]
        public string Type { get; set; } // "Purchase", "Opening Balance", "Spoilage", "Usage", "Damaged", "Theft", "Correction", "Adjustment"

        public string? Reason { get; set; } // Free-text reason / notes

        public string? PerformedBy { get; set; } // Username/email of who performed this action (audit trail)

        public DateTime Date { get; set; } = DateTime.UtcNow;
    }
}

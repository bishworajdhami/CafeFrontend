using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace cafeSystem.Models
{
    public class StockBatch
    {
        public int Id { get; set; }

        public int ProductId { get; set; }
        [ForeignKey("ProductId")]
        public Product Product { get; set; }

        public decimal Quantity { get; set; } // Remaining quantity in this batch

        public DateTime ReceivedDate { get; set; }

        public DateTime ExpiryDate { get; set; }

        public decimal CostPerUnit { get; set; } // Optional cost tracking

        public bool IsActive { get; set; } = true;

        public string? Supplier { get; set; } // Supplier name for this batch

        public string? Notes { get; set; } // Free-text note on this delivery
    }
}

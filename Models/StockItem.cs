using System.ComponentModel.DataAnnotations;

namespace cafeSystem.Models
{
    public class StockItem
    {
        public int Id { get; set; }
        
        [Required]
        public string Name { get; set; }
        
        public decimal CurrentStock { get; set; }
        
        public decimal MinStock { get; set; }
        
        [Required]
        public string Unit { get; set; }
        
        [Required]
        public string Category { get; set; }
        
        public bool LowStock { get; set; }

        public decimal DailyDecayRate { get; set; }

        public DateTime? LastDecayUpdate { get; set; }
    }
}

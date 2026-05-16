using cafeSystem.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace CafeSystem.Models
{
    public class Discount
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }
        [MaxLength(500)]
        public string Description { get; set; }
        [Required]
        [MaxLength(20)]
        public string DiscountType { get; set; } // "percentage" or "fixed"
        [Required]
        [MaxLength(20)]
        public string OfferType { get; set; } = "individual"; // "individual" or "combo"
        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Value { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        [Column(TypeName = "decimal(10,2)")]
        public decimal? MinPurchaseAmount { get; set; }
        [Required]
        public bool Active { get; set; } = true;
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        // Navigation property
        public virtual ICollection<DiscountMenuItem> DiscountMenuItems { get; set; } = new List<DiscountMenuItem>();
    }
    public class DiscountMenuItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int DiscountId { get; set; }
        [Required]
        public int MenuItemId { get; set; }
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        // Navigation properties
        [ForeignKey("DiscountId")]
        public virtual Discount Discount { get; set; }
        [ForeignKey("MenuItemId")]
        public virtual MenuItem MenuItem { get; set; }
    }
}
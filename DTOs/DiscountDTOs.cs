using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
namespace CafeSystem.DTOs
{
    public class CreateDiscountDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }
        [MaxLength(500)]
        public string Description { get; set; }
        [Required]
        public string DiscountType { get; set; } // "percentage" or "fixed"
        [Required]
        public string OfferType { get; set; } = "individual"; // "individual" or "combo"
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Value must be greater than 0")]
        public decimal Value { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        [Range(0, double.MaxValue, ErrorMessage = "Min purchase amount cannot be negative")]
        public decimal? MinPurchaseAmount { get; set; }
        public bool Active { get; set; } = true;
        [Required]
        public List<int> MenuItemIds { get; set; } = new List<int>();
    }
    public class UpdateDiscountDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }
        [MaxLength(500)]
        public string Description { get; set; }
        [Required]
        public string DiscountType { get; set; }
        [Required]
        public string OfferType { get; set; } = "individual"; // "individual" or "combo"
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Value must be greater than 0")]
        public decimal Value { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        [Range(0, double.MaxValue, ErrorMessage = "Min purchase amount cannot be negative")]
        public decimal? MinPurchaseAmount { get; set; }
        public bool Active { get; set; }
        [Required]
        public List<int> MenuItemIds { get; set; } = new List<int>();
    }
    public class DiscountDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string DiscountType { get; set; }
        public string OfferType { get; set; }
        public decimal Value { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? MinPurchaseAmount { get; set; }
        public bool Active { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<MenuItemDto> MenuItems { get; set; } = new List<MenuItemDto>();
    }
    public class MenuItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Price { get; set; }
        public string Category { get; set; }
    }
}
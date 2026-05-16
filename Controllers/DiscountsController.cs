using cafeSystem.Data;
using CafeSystem.DTOs;
using CafeSystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using cafeSystem.Helpers;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
namespace CafeSystem.Controllers
{
    [Authorize]
    [Route("api/manager/[controller]")]
    [ApiController]
    public class DiscountsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        public DiscountsController(ApplicationDbContext context)
        {
            _context = context;
        }
        // GET: api/manager/discounts
        [Authorize(Roles = "Manager,Cashier,Chef")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DiscountDto>>> GetDiscounts()
        {
            var discounts = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                    .ThenInclude(dm => dm.MenuItem)
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();
            var discountDtos = discounts.Select(d => new DiscountDto
            {
                Id = d.Id,
                Name = d.Name,
                Description = d.Description,
                DiscountType = d.DiscountType,
                OfferType = d.OfferType,
                Value = d.Value,
                StartDate = d.StartDate,
                EndDate = d.EndDate,
                MinPurchaseAmount = d.MinPurchaseAmount,
                Active = d.Active,
                CreatedAt = d.CreatedAt,
                MenuItems = d.DiscountMenuItems.Select(dm => new MenuItemDto
                {
                    Id = dm.MenuItem.Id,
                    Name = dm.MenuItem.Name,
                    Price = dm.MenuItem.Price,
                    Category = dm.MenuItem.Category
                }).ToList()
            }).ToList();
            return Ok(discountDtos);
        }
        // GET: api/manager/discounts/5
        [Authorize(Roles = "Manager,Cashier,Chef")]
        [HttpGet("{id}")]
        public async Task<ActionResult<DiscountDto>> GetDiscount(int id)
        {
            var discount = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                    .ThenInclude(dm => dm.MenuItem)
                .FirstOrDefaultAsync(d => d.Id == id);
            if (discount == null)
            {
                return NotFound(new { Message = "Discount not found" });
            }
            var discountDto = new DiscountDto
            {
                Id = discount.Id,
                Name = discount.Name,
                Description = discount.Description,
                DiscountType = discount.DiscountType,
                OfferType = discount.OfferType,
                Value = discount.Value,
                StartDate = discount.StartDate,
                EndDate = discount.EndDate,
                MinPurchaseAmount = discount.MinPurchaseAmount,
                Active = discount.Active,
                CreatedAt = discount.CreatedAt,
                MenuItems = discount.DiscountMenuItems.Select(dm => new MenuItemDto
                {
                    Id = dm.MenuItem.Id,
                    Name = dm.MenuItem.Name,
                    Price = dm.MenuItem.Price,
                    Category = dm.MenuItem.Category
                }).ToList()
            };
            return Ok(discountDto);
        }
        // POST: api/manager/discounts
        [Authorize(Roles = "Manager,Cashier")]
        [HttpPost]
        public async Task<ActionResult<DiscountDto>> CreateDiscount(CreateDiscountDto createDto)
        {
            if (!User.HasPermission("pos.manage_discounts")) return Forbid();
            // Validate menu items exist
            if (createDto.MenuItemIds == null || !createDto.MenuItemIds.Any())
            {
                return BadRequest(new { Message = "At least one menu item must be selected" });
            }
            // Validate combo offers have at least 2 items
            if (createDto.OfferType == "combo" && createDto.MenuItemIds.Count < 2)
            {
                return BadRequest(new { Message = "Combo offers must include at least 2 menu items" });
            }
            var menuItems = await _context.MenuItems
                .Where(m => createDto.MenuItemIds.Contains(m.Id))
                .ToListAsync();
            if (menuItems.Count != createDto.MenuItemIds.Count)
            {
                return BadRequest(new { Message = "One or more menu items not found" });
            }

            // Check for discount conflicts
            var existingDiscounts = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .Where(d => d.Active)
                .ToListAsync();

            if (createDto.OfferType == "individual")
            {
                // For individual discounts, check if any selected item already has an active individual discount
                foreach (var itemId in createDto.MenuItemIds)
                {
                    var hasIndividualDiscount = existingDiscounts.Any(d => 
                        d.OfferType == "individual" && 
                        d.DiscountMenuItems.Any(dm => dm.MenuItemId == itemId));
                    
                    if (hasIndividualDiscount)
                    {
                        var itemName = menuItems.First(m => m.Id == itemId).Name;
                        return BadRequest(new { Message = $"Item '{itemName}' already has an active individual discount. Please deactivate the existing discount first." });
                    }
                }
            }
            else if (createDto.OfferType == "combo")
            {
                // For combo offers, check if exact same combination already exists
                var sortedNewCombo = createDto.MenuItemIds.OrderBy(x => x).ToList();
                
                foreach (var existingCombo in existingDiscounts.Where(d => d.OfferType == "combo"))
                {
                    var sortedExistingCombo = existingCombo.DiscountMenuItems
                        .Select(dm => dm.MenuItemId)
                        .OrderBy(x => x)
                        .ToList();
                    
                    if (sortedNewCombo.SequenceEqual(sortedExistingCombo))
                    {
                        return BadRequest(new { Message = "A combo offer with this exact combination of items already exists. Please modify the items or deactivate the existing combo." });
                    }
                }
            }

            // Create discount
            var discount = new Discount
            {
                Name = createDto.Name,
                Description = createDto.Description,
                DiscountType = createDto.DiscountType,
                OfferType = createDto.OfferType,
                Value = createDto.Value,
                StartDate = createDto.StartDate,
                EndDate = createDto.EndDate,
                MinPurchaseAmount = createDto.MinPurchaseAmount,
                Active = createDto.Active,
                CreatedAt = DateTime.UtcNow
            };
            _context.Discounts.Add(discount);
            await _context.SaveChangesAsync();
            // Create discount-menu item relationships
            foreach (var menuItemId in createDto.MenuItemIds)
            {
                var discountMenuItem = new DiscountMenuItem
                {
                    DiscountId = discount.Id,
                    MenuItemId = menuItemId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.DiscountMenuItems.Add(discountMenuItem);
            }
            await _context.SaveChangesAsync();
            // Reload to get menu items
            var createdDiscount = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                    .ThenInclude(dm => dm.MenuItem)
                .FirstOrDefaultAsync(d => d.Id == discount.Id);
            var discountDto = new DiscountDto
            {
                Id = createdDiscount.Id,
                Name = createdDiscount.Name,
                Description = createdDiscount.Description,
                DiscountType = createdDiscount.DiscountType,
                OfferType = createdDiscount.OfferType,
                Value = createdDiscount.Value,
                StartDate = createdDiscount.StartDate,
                EndDate = createdDiscount.EndDate,
                MinPurchaseAmount = createdDiscount.MinPurchaseAmount,
                Active = createdDiscount.Active,
                CreatedAt = createdDiscount.CreatedAt,
                MenuItems = createdDiscount.DiscountMenuItems.Select(dm => new MenuItemDto
                {
                    Id = dm.MenuItem.Id,
                    Name = dm.MenuItem.Name,
                    Price = dm.MenuItem.Price,
                    Category = dm.MenuItem.Category
                }).ToList()
            };
            return CreatedAtAction(nameof(GetDiscount), new { id = discount.Id }, discountDto);
        }
        // PUT: api/manager/discounts/5
        [Authorize(Roles = "Manager,Cashier")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDiscount(int id, UpdateDiscountDto updateDto)
        {
            if (!User.HasPermission("pos.manage_discounts")) return Forbid();
            var discount = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .FirstOrDefaultAsync(d => d.Id == id);
            if (discount == null)
            {
                return NotFound(new { Message = "Discount not found" });
            }
            // Validate menu items exist
            if (updateDto.MenuItemIds == null || !updateDto.MenuItemIds.Any())
            {
                return BadRequest(new { Message = "At least one menu item must be selected" });
            }
            // Validate combo offers have at least 2 items
            if (updateDto.OfferType == "combo" && updateDto.MenuItemIds.Count < 2)
            {
                return BadRequest(new { Message = "Combo offers must include at least 2 menu items" });
            }
            var menuItems = await _context.MenuItems
                .Where(m => updateDto.MenuItemIds.Contains(m.Id))
                .ToListAsync();
            if (menuItems.Count != updateDto.MenuItemIds.Count)
            {
                return BadRequest(new { Message = "One or more menu items not found" });
            }

            // Check for discount conflicts (excluding current discount)
            var existingDiscounts = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .Where(d => d.Active && d.Id != id)
                .ToListAsync();

            if (updateDto.OfferType == "individual")
            {
                // For individual discounts, check if any selected item already has an active individual discount
                foreach (var itemId in updateDto.MenuItemIds)
                {
                    var hasIndividualDiscount = existingDiscounts.Any(d => 
                        d.OfferType == "individual" && 
                        d.DiscountMenuItems.Any(dm => dm.MenuItemId == itemId));
                    
                    if (hasIndividualDiscount)
                    {
                        var itemName = menuItems.First(m => m.Id == itemId).Name;
                        return BadRequest(new { Message = $"Item '{itemName}' already has an active individual discount. Please deactivate the existing discount first." });
                    }
                }
            }
            else if (updateDto.OfferType == "combo")
            {
                // For combo offers, check if exact same combination already exists
                var sortedNewCombo = updateDto.MenuItemIds.OrderBy(x => x).ToList();
                
                foreach (var existingCombo in existingDiscounts.Where(d => d.OfferType == "combo"))
                {
                    var sortedExistingCombo = existingCombo.DiscountMenuItems
                        .Select(dm => dm.MenuItemId)
                        .OrderBy(x => x)
                        .ToList();
                    
                    if (sortedNewCombo.SequenceEqual(sortedExistingCombo))
                    {
                        return BadRequest(new { Message = "A combo offer with this exact combination of items already exists. Please modify the items or deactivate the existing combo." });
                    }
                }
            }

            // Update discount properties
            discount.Name = updateDto.Name;
            discount.Description = updateDto.Description;
            discount.DiscountType = updateDto.DiscountType;
            discount.OfferType = updateDto.OfferType;
            discount.Value = updateDto.Value;
            discount.StartDate = updateDto.StartDate;
            discount.EndDate = updateDto.EndDate;
            discount.MinPurchaseAmount = updateDto.MinPurchaseAmount;
            discount.Active = updateDto.Active;
            discount.UpdatedAt = DateTime.UtcNow;
            // Update menu items - remove old ones and add new ones
            _context.DiscountMenuItems.RemoveRange(discount.DiscountMenuItems);
            foreach (var menuItemId in updateDto.MenuItemIds)
            {
                var discountMenuItem = new DiscountMenuItem
                {
                    DiscountId = discount.Id,
                    MenuItemId = menuItemId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.DiscountMenuItems.Add(discountMenuItem);
            }
            await _context.SaveChangesAsync();
            return Ok(new { Status = true, Message = "Discount updated successfully" });
        }
        // PUT: api/manager/discounts/5/toggle
        [Authorize(Roles = "Manager,Cashier")]
        [HttpPut("{id}/toggle")]
        public async Task<IActionResult> ToggleDiscount(int id)
        {
            if (!User.HasPermission("pos.manage_discounts")) return Forbid();
            var discount = await _context.Discounts.FindAsync(id);
            if (discount == null)
            {
                return NotFound(new { Message = "Discount not found" });
            }
            discount.Active = !discount.Active;
            discount.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { Status = true, Active = discount.Active, Message = $"Discount {(discount.Active ? "activated" : "deactivated")} successfully" });
        }
        // DELETE: api/manager/discounts/5
        [Authorize(Roles = "Manager,Cashier")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDiscount(int id)
        {
            if (!User.HasPermission("pos.manage_discounts")) return Forbid();
            var discount = await _context.Discounts
                .Include(d => d.DiscountMenuItems)
                .FirstOrDefaultAsync(d => d.Id == id);
            if (discount == null)
            {
                return NotFound(new { Message = "Discount not found" });
            }
            _context.DiscountMenuItems.RemoveRange(discount.DiscountMenuItems);
            _context.Discounts.Remove(discount);
            await _context.SaveChangesAsync();
            return Ok(new { Status = true, Message = "Discount deleted successfully" });
        }
    }
}
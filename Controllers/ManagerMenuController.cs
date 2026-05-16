using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using cafeSystem.Data;
using cafeSystem.Models;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Helpers;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/manager/menu")]
    [Authorize(Roles = "Manager,Cashier,Chef,Waiter")]

    public class ManagerMenuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ManagerMenuController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class AddMenuItemRequest
        {
            public string Name { get; set; } = string.Empty;
            public decimal Price { get; set; }
            public string? Category { get; set; }
            public bool IsAvailable { get; set; } = true;
        }

        [HttpPost]
        public async Task<IActionResult> AddMenuItem([FromBody] AddMenuItemRequest model)
        {
            if (!User.HasPermission("kitchen.manage_menu")) return Forbid();
            if (model == null || string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { Status = false, Message = "Invalid menu item data" });

            if (model.Price < 0)
                return BadRequest(new { Status = false, Message = "Price must be non-negative" });

            var menuItem = new MenuItem
            {
                Name = model.Name.Trim(),
                Price = model.Price,
                Category = string.IsNullOrWhiteSpace(model.Category) ? null : model.Category.Trim(),
                IsAvailable = model.IsAvailable
            };

            _context.MenuItems.Add(menuItem);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMenuItem), new { id = menuItem.Id }, new { Status = true, Message = "Menu item added", Item = menuItem });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMenuItem(int id)
        {
            var item = await _context.MenuItems.FindAsync(id);
            if (item == null) return NotFound(new { Status = false, Message = "Menu item not found" });
            return Ok(item);
        }

        [HttpGet]
        public IActionResult GetAll()
        {
            var items = _context.MenuItems.ToList();
            return Ok(items);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMenuItem(int id, [FromBody] AddMenuItemRequest model)
        {
            if (!User.HasPermission("kitchen.manage_menu")) return Forbid();
            if (model == null || string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { Status = false, Message = "Invalid menu item data" });

            if (model.Price < 0)
                return BadRequest(new { Status = false, Message = "Price must be non-negative" });

            var menuItem = await _context.MenuItems.FindAsync(id);
            if (menuItem == null)
                return NotFound(new { Status = false, Message = "Menu item not found" });

            menuItem.Name = model.Name.Trim();
            menuItem.Price = model.Price;
            menuItem.Category = string.IsNullOrWhiteSpace(model.Category) ? null : model.Category.Trim();
            menuItem.IsAvailable = model.IsAvailable;

            await _context.SaveChangesAsync();

            return Ok(new { Status = true, Message = "Menu item updated", Item = menuItem });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMenuItem(int id)
        {
            if (!User.HasPermission("kitchen.manage_menu")) return Forbid();
            var menuItem = await _context.MenuItems.FindAsync(id);
            if (menuItem == null)
                return NotFound(new { Status = false, Message = "Menu item not found" });

            // Soft delete: hide from active menu but keep for order history
            menuItem.IsDeleted = true;
            menuItem.IsAvailable = false; // Also mark unavailable as a fallback

            await _context.SaveChangesAsync();

            return Ok(new { Status = true, Message = "Menu item deleted successfully" });
        }
        [HttpPost("bulk")]
        public async Task<IActionResult> BulkAddMenuItems([FromBody] List<AddMenuItemRequest> models)
        {
            if (!User.HasPermission("kitchen.manage_menu")) return Forbid();
            if (models == null || !models.Any())
                return BadRequest(new { Status = false, Message = "No menu items provided" });

            var addedCount = 0;
            var errors = new List<string>();
            var addedItems = new List<MenuItem>();

            foreach (var model in models)
            {
                if (string.IsNullOrWhiteSpace(model.Name))
                {
                    errors.Add($"Item at index {models.IndexOf(model)}: Name is required");
                    continue;
                }

                if (model.Price < 0)
                {
                    errors.Add($"Item '{model.Name}': Price must be non-negative");
                    continue;
                }

                var menuItem = new MenuItem
                {
                    Name = model.Name.Trim(),
                    Price = model.Price,
                    Category = string.IsNullOrWhiteSpace(model.Category) ? null : model.Category.Trim(),
                    IsAvailable = model.IsAvailable
                };

                _context.MenuItems.Add(menuItem);
                addedItems.Add(menuItem);
                addedCount++;
            }

            if (addedCount > 0)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new 
            { 
                Status = true, 
                Message = $"Successfully added {addedCount} items", 
                AddedCount = addedCount,
                Errors = errors,
                Items = addedItems
            });
        }
    }
}

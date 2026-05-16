using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using cafeSystem.Data;
using Microsoft.EntityFrameworkCore;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/cashier/menu")]
    [Authorize(Roles = "Cashier,Waiter")]

    public class CashierMenuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CashierMenuController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMenuItems()
        {
            var items = await _context.MenuItems.ToListAsync();
            return Ok(items);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMenuItem(int id)
        {
            var item = await _context.MenuItems.FindAsync(id);
            if (item == null)
                return NotFound(new { Status = false, Message = "Menu item not found" });
            
            return Ok(item);
        }
    }
}


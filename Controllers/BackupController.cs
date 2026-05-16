using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Models;
using cafeSystem.Data;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace cafeSystem.Controllers
{
    [Route("api/backup")]
    [ApiController]
    public class BackupController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public BackupController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> ExportDatabase()
        {
            try
            {
                // Fetch all critical data
                var orders = await _context.Orders.Include(o => o.Items).ToListAsync();
                var menuItems = await _context.MenuItems.ToListAsync();
                var categories = await _context.Categories.ToListAsync(); 
                var users = await _context.Users.ToListAsync();
                var payments = await _context.Payments.ToListAsync();
                
                // Construct backup object
                var backupData = new
                {
                    ExportDate = DateTime.UtcNow,
                    Orders = orders,
                    MenuItems = menuItems,
                    Categories = categories,
                    Users = users.Select(u => new { u.Id, u.Email, u.Role }), // Exclude passwords
                    Payments = payments
                };

                return Ok(backupData);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Backup failed", error = ex.Message });
            }
        }
    }
}

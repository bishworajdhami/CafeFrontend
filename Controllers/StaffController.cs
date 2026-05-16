using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Data;
using cafeSystem.Models;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/manager/staff")]
    [Authorize(Roles = "Manager")]
    public class StaffController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IPasswordHasher<User> _passwordHasher;

        public StaffController(ApplicationDbContext context, IPasswordHasher<User> passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
        }

        // GET: api/manager/staff
        // Get all staff members
        [HttpGet]
        public async Task<IActionResult> GetStaff()
        {
            var allowedRoles = new[] { "Manager", "Cashier", "Chef", "Waiter" };
            var staff = await _context.Users
                .Where(u => allowedRoles.Contains(u.Role))
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.Role,
                    u.Name,
                    u.Permissions,
                    u.ProfilePictureUrl
                })
                .ToListAsync();

            return Ok(staff);
        }

        // GET: api/manager/staff/{id}
        // Get a specific staff member by ID
        [HttpGet("{id}")]
        public async Task<IActionResult> GetStaffMember(int id)
        {
            var allowedRoles = new[] { "Manager", "Cashier", "Chef", "Waiter" };
            var staffMember = await _context.Users
                .Where(u => allowedRoles.Contains(u.Role) && u.Id == id)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.Role,
                    u.Name,
                    u.Permissions,
                    u.ProfilePictureUrl
                })
                .FirstOrDefaultAsync();

            if (staffMember == null)
                return NotFound(new { Status = false, Message = "Staff member not found" });

            return Ok(staffMember);
        }

        // DELETE: api/manager/staff/{id}
        // Delete a staff member
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteStaffMember(int id)
        {
            var allowedRoles = new[] { "Manager", "Cashier", "Chef", "Waiter" };
            var staffMember = await _context.Users
                .Where(u => allowedRoles.Contains(u.Role) && u.Id == id)
                .FirstOrDefaultAsync();

            if (staffMember == null)
                return NotFound(new { Status = false, Message = "Staff member not found" });

            if (staffMember.Role == "Manager")
                return BadRequest(new { Status = false, Message = "Manager accounts cannot be deleted" });

            // Handle database constraints by nulling out references
            // This allows us to delete the user while preserving historical data
            
            // 1. Update Orders
            var orders = await _context.Orders.Where(o => o.UserId == id).ToListAsync();
            foreach (var order in orders) order.UserId = null;

            // 2. Update Cash Closings
            var closings = await _context.CashClosings.Where(c => c.SubmittedByUserId == id).ToListAsync();
            foreach (var closing in closings) closing.SubmittedByUserId = null;

            // 3. Update Cash Transactions
            var transactions = await _context.CashTransactions.Where(t => t.UserId == id).ToListAsync();
            foreach (var transaction in transactions) transaction.UserId = null;

            await _context.SaveChangesAsync();

            // Now remove the user
            _context.Users.Remove(staffMember);
            await _context.SaveChangesAsync();

            return Ok(new { Status = true, Message = "Staff member deleted successfully" });
        }


        public class UpdateStaffRequest
        {
            public string? Name { get; set; }
            public string? Email { get; set; }
            public string Role { get; set; }
            public string? Permissions { get; set; }
            public string? NewPassword { get; set; }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateStaffMember(int id, [FromBody] UpdateStaffRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Role))
                return BadRequest(new { Status = false, Message = "Invalid data" });

            var allowedRoles = new[] { "Manager", "Cashier", "Chef", "Waiter" };
            if (!allowedRoles.Contains(model.Role))
                return BadRequest(new { Status = false, Message = "Role must be Manager, Cashier, Chef, or Waiter" });

            var staffMember = await _context.Users
                .Where(u => allowedRoles.Contains(u.Role) && u.Id == id)
                .FirstOrDefaultAsync();

            if (staffMember == null)
                return NotFound(new { Status = false, Message = "Staff member not found" });

            // Ensure we don't accidentally downgrade the only manager to a cashier, though that's a complex check.
            // Just basic update for now.
            staffMember.Name = model.Name;
            staffMember.Role = model.Role;
            staffMember.Permissions = model.Permissions;
            
            // Handle Email Update
            if (!string.IsNullOrWhiteSpace(model.Email) && model.Email.Trim().ToLowerInvariant() != staffMember.Email)
            {
                var newEmail = model.Email.Trim().ToLowerInvariant();
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == newEmail && u.Id != id);
                if (existingUser != null)
                {
                    return Conflict(new { Status = false, Message = "Email already in use by another account" });
                }
                staffMember.Email = newEmail;
            }

            // Handle Password Update
            if (!string.IsNullOrWhiteSpace(model.NewPassword))
            {
                if (model.NewPassword.Length < 6)
                {
                    return BadRequest(new { Status = false, Message = "Password must be at least 6 characters" });
                }
                staffMember.Password = _passwordHasher.HashPassword(staffMember, model.NewPassword);
                staffMember.TemporaryPassword = null;
            }

            await _context.SaveChangesAsync();

            return Ok(new { Status = true, Message = "Staff member updated successfully" });
        }
    }
}

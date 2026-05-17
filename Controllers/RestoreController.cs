using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using cafeSystem.Models;
using cafeSystem.Data;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json.Serialization;

namespace cafeSystem.Controllers
{
    [Route("api/restore")]
    [ApiController]
    [Authorize(Roles = "Manager")]
    public class RestoreController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RestoreController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [DisableRequestSizeLimit] // Critical to allow the 60MB file
        public async Task<IActionResult> ImportDatabase([FromBody] RestoreRequest payload)
        {
            if (payload == null)
                return BadRequest(new { status = false, message = "Invalid restore data" });

            try
            {
                // Set long command timeout to prevent timeout on 220k rows
                _context.Database.SetCommandTimeout(600); // 10 minutes

                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    // Disable automatic change tracking for max speed
                    _context.ChangeTracker.AutoDetectChangesEnabled = false;

                    // 1. Clear operational & configuration tables in correct order
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM RefundItems");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Refunds");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM BillSplits");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Payments");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM OrderItems");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Orders");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM TableSeats");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM TableBookings");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM CashTransactions");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM CashClosings");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM StockTransactions");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM StockBatches");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Products");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM TableSessions");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM MenuItems");
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Categories");

                    // For Users, delete all users EXCEPT the current manager account
                    var managerEmails = new[] { "bishworajdhami@gmail.com" };
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Users WHERE Email NOT IN ('bishworajdhami@gmail.com')");

                    // Reset Settings (optional, we can keep settings, but let's clear them to restore)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Settings");

                    // 2. Perform insertions in correct relational order
                    
                    // --- Settings ---
                    if (payload.Settings != null && payload.Settings.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Settings ON");
                        await _context.Settings.AddRangeAsync(payload.Settings);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Settings OFF");
                    }

                    // --- Categories ---
                    if (payload.Categories != null && payload.Categories.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Categories ON");
                        await _context.Categories.AddRangeAsync(payload.Categories);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Categories OFF");
                    }

                    // --- MenuItems ---
                    if (payload.MenuItems != null && payload.MenuItems.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT MenuItems ON");
                        await _context.MenuItems.AddRangeAsync(payload.MenuItems);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT MenuItems OFF");
                    }

                    // --- Users (except managers already in DB) ---
                    if (payload.Users != null && payload.Users.Any())
                    {
                        var existingEmails = await _context.Users.Select(u => u.Email.ToLower()).ToListAsync();
                        var usersToInsert = payload.Users
                            .Where(u => !existingEmails.Contains(u.Email.ToLower()))
                            .ToList();

                        if (usersToInsert.Any())
                        {
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Users ON");
                            await _context.Users.AddRangeAsync(usersToInsert);
                            await _context.SaveChangesAsync();
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Users OFF");
                        }
                    }

                    // --- TableSessions ---
                    if (payload.TableSessions != null && payload.TableSessions.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableSessions ON");
                        await _context.TableSessions.AddRangeAsync(payload.TableSessions);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableSessions OFF");
                    }

                    // --- Products ---
                    if (payload.Products != null && payload.Products.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Products ON");
                        await _context.Products.AddRangeAsync(payload.Products);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Products OFF");
                    }

                    // --- StockBatches ---
                    if (payload.StockBatches != null && payload.StockBatches.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT StockBatches ON");
                        await _context.StockBatches.AddRangeAsync(payload.StockBatches);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT StockBatches OFF");
                    }

                    // --- StockTransactions ---
                    if (payload.StockTransactions != null && payload.StockTransactions.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT StockTransactions ON");
                        await _context.StockTransactions.AddRangeAsync(payload.StockTransactions);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT StockTransactions OFF");
                    }

                    // --- CashClosings ---
                    if (payload.CashClosings != null && payload.CashClosings.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT CashClosings ON");
                        await _context.CashClosings.AddRangeAsync(payload.CashClosings);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT CashClosings OFF");
                    }

                    // --- CashTransactions ---
                    if (payload.CashTransactions != null && payload.CashTransactions.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT CashTransactions ON");
                        await _context.CashTransactions.AddRangeAsync(payload.CashTransactions);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT CashTransactions OFF");
                    }

                    // --- TableBookings ---
                    if (payload.TableBookings != null && payload.TableBookings.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableBookings ON");
                        await _context.TableBookings.AddRangeAsync(payload.TableBookings);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableBookings OFF");
                    }

                    // --- TableSeats ---
                    if (payload.TableSeats != null && payload.TableSeats.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableSeats ON");
                        await _context.TableSeats.AddRangeAsync(payload.TableSeats);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT TableSeats OFF");
                    }

                    // --- Orders (70k rows, chunked to prevent memory explosion) ---
                    if (payload.Orders != null && payload.Orders.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Orders ON");
                        const int batchSize = 2500;
                        for (int i = 0; i < payload.Orders.Count; i += batchSize)
                        {
                            var batch = payload.Orders.Skip(i).Take(batchSize).ToList();
                            await _context.Orders.AddRangeAsync(batch);
                            await _context.SaveChangesAsync();
                            _context.ChangeTracker.Clear(); // Clear tracking buffer to save RAM!
                        }
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Orders OFF");
                    }

                    // --- OrderItems (156k rows, chunked) ---
                    if (payload.OrderItems != null && payload.OrderItems.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT OrderItems ON");
                        const int batchSize = 2500;
                        for (int i = 0; i < payload.OrderItems.Count; i += batchSize)
                        {
                            var batch = payload.OrderItems.Skip(i).Take(batchSize).ToList();
                            await _context.OrderItems.AddRangeAsync(batch);
                            await _context.SaveChangesAsync();
                            _context.ChangeTracker.Clear();
                        }
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT OrderItems OFF");
                    }

                    // --- Payments (70k rows, chunked) ---
                    if (payload.Payments != null && payload.Payments.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Payments ON");
                        const int batchSize = 2500;
                        for (int i = 0; i < payload.Payments.Count; i += batchSize)
                        {
                            var batch = payload.Payments.Skip(i).Take(batchSize).ToList();
                            await _context.Payments.AddRangeAsync(batch);
                            await _context.SaveChangesAsync();
                            _context.ChangeTracker.Clear();
                        }
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT Payments OFF");
                    }

                    // --- BillSplits ---
                    if (payload.BillSplits != null && payload.BillSplits.Any())
                    {
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT BillSplits ON");
                        await _context.BillSplits.AddRangeAsync(payload.BillSplits);
                        await _context.SaveChangesAsync();
                        await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT BillSplits OFF");
                    }

                    await transaction.CommitAsync();

                    return Ok(new { status = true, message = "Database restored successfully!" });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { status = false, message = "Restore failed during import", error = ex.Message, details = ex.InnerException?.Message });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = "Database connection error", error = ex.Message });
            }
        }
    }

    public class RestoreRequest
    {
        public List<Setting>? Settings { get; set; }
        public List<Category>? Categories { get; set; }
        public List<MenuItem>? MenuItems { get; set; }
        public List<User>? Users { get; set; }
        public List<TableSession>? TableSessions { get; set; }
        public List<Models.Product>? Products { get; set; }
        public List<Models.StockBatch>? StockBatches { get; set; }
        public List<Models.StockTransaction>? StockTransactions { get; set; }
        public List<CashClosing>? CashClosings { get; set; }
        public List<CashTransaction>? CashTransactions { get; set; }
        public List<TableBooking>? TableBookings { get; set; }
        public List<TableSeat>? TableSeats { get; set; }
        public List<Order>? Orders { get; set; }
        public List<OrderItem>? OrderItems { get; set; }
        public List<Payment>? Payments { get; set; }
        public List<BillSplit>? BillSplits { get; set; } // Let's check BillSplit name
    }
}

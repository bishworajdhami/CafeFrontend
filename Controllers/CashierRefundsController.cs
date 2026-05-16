using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using cafeSystem.Data;
using cafeSystem.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using cafeSystem.Helpers;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/cashier/refunds")]
    [Authorize(Roles = "Manager,Cashier")]
    public class CashierRefundsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CashierRefundsController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class ProcessRefundRequest
        {
            public int OrderId { get; set; }
            public string RefundType { get; set; } // "full" or "partial"
            public string Reason { get; set; }
            public decimal RefundAmount { get; set; }
            public List<RefundItemRequest>? Items { get; set; }
        }

        public class RefundItemRequest
        {
            public int ItemId { get; set; } // This is OrderItemId
            public int Quantity { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> ProcessRefund([FromBody] ProcessRefundRequest request)
        {
            if (!User.HasPermission("pos.process_refunds")) return Forbid();

            if (request == null)
                return BadRequest(new { Status = false, Message = "Invalid refund data" });

            // Find the order with items
            var order = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == request.OrderId);

            if (order == null)
                return NotFound(new { Status = false, Message = "Order not found" });

            // 1. Time Limit Check: Only allow refunds for orders created today (UTC)
            if (order.CreatedAt.Date != DateTime.UtcNow.Date)
            {
                return BadRequest(new { Status = false, Message = "Refunds are only allowed for orders placed on the same business day" });
            }

            // 2. Status Check & Refund Limits
            bool isFullRefund = request.RefundType == "full";
            decimal maxRefundPercentage = 0;

            switch (order.Status.ToLower())
            {
                case "pending":
                    maxRefundPercentage = 100;
                    break;
                case "preparing":
                    maxRefundPercentage = 50;
                    break;
                case "ready":
                case "completed":
                    // If the user REALLY wants to force delete a completed order, we block it here as per previous logic.
                    // But usually full refund/void is on Pending.
                    return BadRequest(new { Status = false, Message = "Refunds are not allowed for orders that are Ready or Completed" });
                default:
                    return BadRequest(new { Status = false, Message = $"Cannot process refund for order with status '{order.Status}'" });
            }

            // 3. Validate Refund Value
            if (isFullRefund)
            {
                if (maxRefundPercentage < 100)
                {
                     return BadRequest(new { Status = false, Message = $"Full refund is not allowed for orders in '{order.Status}' status. Max allowed is {maxRefundPercentage}%" });
                }
                
                // === FULL REFUND / DELETE LOGIC ===
                // If it's a full refund (allowed only for Pending currently), we DELETE the order entirely.
                // This removes it from OrderQueue and Sales records.

                // 1. Delete associated Payments
                var associatedPayments = await _context.Payments
                    .Where(p => p.OrderId == request.OrderId)
                    .ToListAsync();
                
                if (associatedPayments.Any())
                {
                    _context.Payments.RemoveRange(associatedPayments);
                }

                // 2. Delete Order (EF Core should cascade delete Items, but we delete order directly)
                _context.Orders.Remove(order);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Status = true,
                    Message = "Order fully refunded and deleted successfully.",
                    RefundId = 0 // No refund record created as order is wiped
                });
            }
            else
            {
                // Validate partial amount against max percentage
                decimal maxAmount = order.Total * (maxRefundPercentage / 100m);
                if (request.RefundAmount > maxAmount)
                {
                    return BadRequest(new { Status = false, Message = $"Refund amount exceeds the limit. Max allowed for '{order.Status}' status is {maxRefundPercentage}% (NRP {maxAmount:F2})" });
                }
            }

            // Basic validation for Partial Refund
            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest(new { Status = false, Message = "Refund reason is required" });

            if (request.RefundAmount <= 0)
                 return BadRequest(new { Status = false, Message = "Refund amount must be greater than zero" });

            // Check if already fully refunded (shouldn't happen if we delete, but for legacy records)
            var existingFullRefund = await _context.Refunds
                .AnyAsync(r => r.OrderId == request.OrderId && r.RefundType == "full");
            
            if (existingFullRefund)
                return BadRequest(new { Status = false, Message = "This order has already been fully refunded" });

            // Create Refund Entity (Only for Partial)
            var refund = new Refund
            {
                OrderId = request.OrderId,
                RefundType = request.RefundType,
                Reason = request.Reason,
                TotalAmount = request.RefundAmount,
                RefundDate = DateTime.UtcNow
            };

            _context.Refunds.Add(refund);
            
            // Handle Items for Partial Refund
            if (request.RefundType == "partial" && request.Items != null && request.Items.Any())
            {
                foreach (var itemReq in request.Items)
                {
                    var orderItem = order.Items.FirstOrDefault(i => i.Id == itemReq.ItemId);
                    if (orderItem == null)
                    {
                        return BadRequest(new { Status = false, Message = $"Item with ID {itemReq.ItemId} not found in this order" });
                    }

                    if (itemReq.Quantity > orderItem.Quantity)
                    {
                        return BadRequest(new { Status = false, Message = $"Refund quantity for {orderItem.Name} cannot exceed order quantity" });
                    }

                    var refundItem = new RefundItem
                    {
                        RefundId = refund.Id, 
                        OrderItemId = orderItem.Id,
                        Name = orderItem.Name ?? "Unknown Item",
                        Quantity = itemReq.Quantity,
                        Amount = orderItem.Price * itemReq.Quantity 
                    };
                    
                    refund.RefundItems.Add(refundItem);
                }
            }

            // For Partial Refund, we don't change status usually, unless implemented specifically.
            // Leaving status as is.

            await _context.SaveChangesAsync();
            
            return Ok(new
            {
                Status = true,
                Message = "Refund processed successfully",
                RefundId = refund.Id
            });
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetRefundHistory()
        {
            if (!User.HasPermission("pos.process_refunds")) return Forbid();

            var refunds = await _context.Refunds
                .OrderByDescending(r => r.RefundDate)
                .Take(50)
                .ToListAsync();

            return Ok(refunds);
        }
    }
}

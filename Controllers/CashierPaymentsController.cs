using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/cashier/payments")]
    [Authorize(Roles = "Cashier,Waiter")]

    public class CashierPaymentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<OrderHub> _hub;

        public CashierPaymentsController(ApplicationDbContext context, IHubContext<OrderHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        public class ProcessPaymentRequest
        {
            public int? OrderId { get; set; }
            public int? SessionId { get; set; }
            public string PaymentMethod { get; set; } // "cash", "card", "mobile"
            public string? MobilePaymentApp { get; set; } // "esewa", "khalti", "imepay", etc.
            public bool SplitBill { get; set; }
            public int SplitCount { get; set; }
            public decimal TotalAmount { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> ProcessPayment([FromBody] ProcessPaymentRequest request)
        {
            if (request == null)
                return BadRequest(new { Status = false, Message = "Invalid payment data" });

            if (!request.OrderId.HasValue && !request.SessionId.HasValue)
                return BadRequest(new { Status = false, Message = "OrderId or SessionId is required" });

            Order? order = null;
            TableSession? session = null;

            if (request.SessionId.HasValue)
            {
                session = await _context.TableSessions.FirstOrDefaultAsync(s => s.Id == request.SessionId.Value);
                if (session == null) return NotFound(new { Status = false, Message = "Session not found" });

                // Prefer current unpaid order within the session if present.
                order = session.CurrentOrderId.HasValue
                    ? await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == session.CurrentOrderId.Value)
                    : await _context.Orders.Include(o => o.Items)
                        .OrderByDescending(o => o.CreatedAt)
                        .FirstOrDefaultAsync(o => o.TableSessionId == session.Id && o.PaymentStatus != "paid" && o.Status != "Cancelled");
            }
            else if (request.OrderId.HasValue)
            {
                order = await _context.Orders
                    .Include(o => o.Items)
                    .FirstOrDefaultAsync(o => o.Id == request.OrderId.Value);
                if (order != null && order.TableSessionId.HasValue)
                    session = await _context.TableSessions.FirstOrDefaultAsync(s => s.Id == order.TableSessionId.Value);
            }

            if (order == null && session == null)
                return NotFound(new { Status = false, Message = "Order/session not found" });

            if (order != null && order.PaymentStatus == "paid")
                return BadRequest(new { Status = false, Message = "Order has already been paid" });

            // Validate payment method
            if (request.PaymentMethod != "cash" && request.PaymentMethod != "card" && request.PaymentMethod != "mobile")
                return BadRequest(new { Status = false, Message = "Invalid payment method" });

            // Validate mobile payment app if mobile method is selected
            if (request.PaymentMethod == "mobile" && string.IsNullOrWhiteSpace(request.MobilePaymentApp))
                return BadRequest(new { Status = false, Message = "Mobile payment app is required for mobile payments" });

            // Validate split bill
            if (request.SplitBill && request.SplitCount < 2)
                return BadRequest(new { Status = false, Message = "Split count must be at least 2" });



            var expectedTotal = order?.Total ?? 0;
            if (session != null)
            {
                expectedTotal += await _context.TableSessionCharges
                    .Where(c => c.TableSessionId == session.Id && c.Status == "Unpaid")
                    .SumAsync(c => c.Amount);
            }
            expectedTotal = decimal.Round(expectedTotal, 2);

            // Create payment record
            var payment = new Payment
            {
                OrderId = order?.Id,
                TableSessionId = session?.Id,
                Amount = expectedTotal,
                Method = request.PaymentMethod,
                MobilePaymentApp = request.PaymentMethod == "mobile" ? request.MobilePaymentApp : null,
                IsSplit = request.SplitBill,
                SplitCount = request.SplitBill ? request.SplitCount : null,
                PaymentDate = DateTime.UtcNow
            };

            _context.Payments.Add(payment);

            // Update order payment status (if paying an order)
            if (order != null)
            {
                order.PaymentStatus = "paid";
                order.UpdatedAt = DateTime.UtcNow;
            }

            // Mark session charges as paid if session payment
            if (session != null)
            {
                var unpaidCharges = await _context.TableSessionCharges
                    .Where(c => c.TableSessionId == session.Id && c.Status == "Unpaid")
                    .ToListAsync();
                foreach (var c in unpaidCharges)
                {
                    c.Status = "Paid";
                    c.PaidAt = DateTime.UtcNow;
                }

                // If no remaining unpaid order and no unpaid charges, we can close the session (soft close)
                var hasUnpaidOrder = await _context.Orders.AnyAsync(o => o.TableSessionId == session.Id && o.PaymentStatus != "paid" && o.Status != "Cancelled");
                var hasUnpaidCharges = await _context.TableSessionCharges.AnyAsync(c => c.TableSessionId == session.Id && c.Status == "Unpaid");
                if (!hasUnpaidOrder && !hasUnpaidCharges)
                {
                    session.Status = "Closed";
                    session.ClosedAt = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            // Create bill split records if needed
            if (request.SplitBill && request.SplitCount > 1)
            {
                var amountPerPerson = request.TotalAmount / request.SplitCount;
                
                for (int i = 0; i < request.SplitCount; i++)
                {
                    var splitAmount = i == request.SplitCount - 1
                        ? request.TotalAmount - (amountPerPerson * (request.SplitCount - 1)) // Last person gets remainder
                        : amountPerPerson;

                    var billSplit = new BillSplit
                    {
                        PaymentId = payment.Id,
                        Amount = splitAmount,
                        Payer = $"Person {i + 1}"
                    };

                    _context.BillSplits.Add(billSplit);
                }

                await _context.SaveChangesAsync();
            }

            // Notify clients that a payment was made — triggers refresh
            if (order != null)
            {
                await _hub.Clients.All.SendAsync("PaymentUpdate", order.Id);
                await _hub.Clients.All.SendAsync("OrderUpdated", order.Id);
                await _hub.Clients.All.SendAsync("order.statusChanged", new { orderId = order.Id, status = order.Status });
            }
            if (session != null)
            {
                await _hub.Clients.All.SendAsync("session.updated", new { sessionId = session.Id, updatedAt = session.UpdatedAt });
                await _hub.Clients.All.SendAsync("table.stateChanged", new { floorName = session.FloorName, tableNumber = session.TableNumber });
            }

            return Ok(new
            {
                Status = true,
                Message = "Payment processed successfully",
                Payment = new
                {
                    payment.Id,
                    payment.OrderId,
                    payment.TableSessionId,
                    payment.Amount,
                    payment.Method,
                    payment.MobilePaymentApp,
                    payment.IsSplit,
                    payment.SplitCount,
                    payment.PaymentDate
                }
            });
        }



        [HttpGet]
        public async Task<IActionResult> GetPayments()
        {
            var payments = await _context.Payments
                .OrderByDescending(p => p.PaymentDate)
                .Take(50)
                .ToListAsync();

            return Ok(payments);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetPaymentHistory([FromQuery] string range = "today", [FromQuery] string? customStartDate = null, [FromQuery] string? customEndDate = null)
        {
            DateTime startDate;
            DateTime endDate = DateTime.UtcNow;

            switch (range)
            {
                case "yesterday":
                    startDate = DateTime.UtcNow.Date.AddDays(-1);
                    endDate = DateTime.UtcNow.Date;
                    break;
                case "week":
                    startDate = DateTime.UtcNow.Date.AddDays(-7);
                    break;
                case "month":
                    startDate = DateTime.UtcNow.Date.AddDays(-30);
                    break;
                case "all":
                    startDate = DateTime.MinValue;
                    break;
                case "custom":
                    if (!DateTime.TryParse(customStartDate, out startDate))
                        startDate = DateTime.UtcNow.Date;
                    if (DateTime.TryParse(customEndDate, out DateTime parsedEnd))
                        endDate = parsedEnd.AddDays(1); // Include full end day
                    break;
                default: // today
                    startDate = DateTime.UtcNow.Date;
                    break;
            }

            var paidOrders = await _context.Orders
                .Include(o => o.Items)
                .Where(o => o.PaymentStatus == "paid" && o.CreatedAt >= startDate && o.CreatedAt <= endDate)
                .OrderByDescending(o => o.CreatedAt)
                .Take(100)
                .ToListAsync();

            // Load payments and seat mappings for these orders
            var orderIds = paidOrders.Select(o => o.Id).ToList();
            var payments = await _context.Payments
                .Where(p => p.OrderId.HasValue && orderIds.Contains(p.OrderId.Value))
                .ToListAsync();

            var seatMappings = await _context.TableSeats
                .Where(s => s.OrderId != null && orderIds.Contains(s.OrderId.Value))
                .ToListAsync();

            var paymentMap = payments
                .Where(p => p.OrderId.HasValue)
                .GroupBy(p => p.OrderId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.PaymentDate).First());

            var result = paidOrders.Select(order => {
                paymentMap.TryGetValue(order.Id, out var payment);
                var seatNumbers = seatMappings
                    .Where(s => s.OrderId == order.Id)
                    .Select(s => s.SeatNumber)
                    .OrderBy(n => n)
                    .ToList();

                return new {
                    order.Id,
                    order.OrderType,
                    order.TableNumber,
                    order.FloorName,
                    SeatNumbers = seatNumbers,
                    order.Subtotal,
                    order.Tax,
                    order.ServiceCharge,
                    order.BookingCharge,
                    order.Total,
                    order.CreatedAt,
                    order.PaymentStatus,
                    Items = order.Items.Select(i => new {
                        i.Name,
                        i.Quantity,
                        i.Price,
                        i.SpecialRequest
                    }),
                    PaymentMethod = payment?.Method ?? "cash",
                    MobilePaymentApp = payment?.MobilePaymentApp,
                    IsSplit = payment?.IsSplit ?? false,
                    SplitCount = payment?.SplitCount ?? 1,
                    PaymentDate = payment?.PaymentDate
                };
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPayment(int id)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == id);

            if (payment == null)
                return NotFound(new { Status = false, Message = "Payment not found" });

            return Ok(payment);
        }
    }
}

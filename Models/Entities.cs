namespace cafeSystem.Models
{
    public class User
    {
        public int Id { get; set; }
        public required string Email { get; set; }
        public required string Password { get; set; }
        public required string Role { get; set; } // Cashier, Manager, Chef, Barista
        public string? Name { get; set; } // Optional user profile name
        public bool EmailVerified { get; set; } = false;
        public string? OTP { get; set; }
        public DateTime? OTPExpiry { get; set; }
        public bool IsFirstLogin { get; set; } = true; // True for staff created by manager, false after first login
        public string? TemporaryPassword { get; set; } // Store temporary password for staff (hashed)
        public string? ProfilePictureUrl { get; set; }
        public string? Permissions { get; set; } // Comma-separated list of permissions
    }

    public class MenuItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string? Category { get; set; }
        public bool IsAvailable { get; set; }
        public bool IsVatExempt { get; set; } = false; // VAT exemption for individual items
        public bool IsDeleted { get; set; } = false; // Soft delete flag
    }

    public class InventoryItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }

    public class Order
    {
        public int Id { get; set; }
        public int? UserId { get; set; } // Cashier who created the order
        public int? TableSessionId { get; set; } // Links orders to a single table visit/session
        public string OrderType { get; set; } = string.Empty; // "dine-in" or "takeaway"
        public string? TableNumber { get; set; } // For dine-in orders
        public List<OrderItem> Items { get; set; } = new List<OrderItem>();
        public string Status { get; set; } = "Pending"; // Pending, Preparing, Ready, Completed, Cancelled
        public decimal Subtotal { get; set; }
        public decimal Tax { get; set; }
        public decimal ServiceCharge { get; set; } = 0;
        public decimal BookingCharge { get; set; } = 0;
        public decimal Total { get; set; }
        public string? PaymentStatus { get; set; } // "paid" or "unpaid"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadyAt { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        // Table Booking and Seat Management
        public int? BookingId { get; set; }
        public string? FloorName { get; set; }
        public int? SeatNumber { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public List<int> SeatNumbers { get; set; } = new List<int>();

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public decimal UnpaidSessionCharges { get; set; } = 0;

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool IsOpenEndedBooking { get; set; } = false;
    }

    public class OrderItem
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public int MenuItemId { get; set; }
        public string? Name { get; set; } // Store menu item name for reference
        public int Quantity { get; set; }
        public decimal Price { get; set; } // Price at time of order
        public string? SpecialRequest { get; set; } // Customer special requests
    }

    public class Payment
    {
        public int Id { get; set; }
        public int? OrderId { get; set; }
        public int? TableSessionId { get; set; }
        public decimal Amount { get; set; }
        public string Method { get; set; } = string.Empty; // Cash, Card, Mobile
        public string? MobilePaymentApp { get; set; } // eSewa, Khalti, IME Pay, etc.
        public bool IsSplit { get; set; }
        public int? SplitCount { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    }

    public class TableSession
    {
        public int Id { get; set; }
        public string FloorName { get; set; } = string.Empty;
        public string TableNumber { get; set; } = string.Empty;
        public string Status { get; set; } = "Open"; // Open, Closing, Closed, Cancelled
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public int? BookingId { get; set; }
        public int? CurrentOrderId { get; set; }
        public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ClosedAt { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class TableSessionCharge
    {
        public int Id { get; set; }
        public int TableSessionId { get; set; }
        public string Type { get; set; } = "BookingCharge"; // BookingCharge, Adjustment, Other
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Unpaid"; // Unpaid, Paid, Voided
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? PaidAt { get; set; }
    }

    public class BillSplit
    {
        public int Id { get; set; }
        public int PaymentId { get; set; }
        public decimal Amount { get; set; }
        public string Payer { get; set; } = string.Empty;
    }

    public class Report
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty; // Sales, Inventory, etc.
        public DateTime GeneratedAt { get; set; }
        public string Data { get; set; } = string.Empty;
    }

    public class Setting
    {
        public int Id { get; set; }
        public string Key { get; set; } = string.Empty;
        public string? Value { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Category
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Refund
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public decimal TotalAmount { get; set; }
        public string RefundType { get; set; } = string.Empty; // "full", "partial"
        public string Reason { get; set; } = string.Empty;
        public DateTime RefundDate { get; set; } = DateTime.UtcNow;
        public List<RefundItem> RefundItems { get; set; } = new List<RefundItem>();
    }

    public class RefundItem
    {
        public int Id { get; set; }
        public int RefundId { get; set; }
        public int OrderItemId { get; set; } // References OrderItem.Id
        public string Name { get; set; } = string.Empty; // Snapshot of name
        public int Quantity { get; set; }
        public decimal Amount { get; set; } // Amount refunded for this line item
    }

    public class CashClosing
    {
        public int Id { get; set; }
        public DateTime Date { get; set; } // The date of the closing (usually just the date part)
        public decimal TotalSales { get; set; } // Snapshot of system calculated sales
        public int TotalOrders { get; set; }
        public decimal CashInDrawer { get; set; } // Actual cash counted by cashier
        public decimal OpeningCash { get; set; } // Opening float at start of day
        public decimal CashExpenses { get; set; } = 0; // Cash paid out from drawer (vendor payments, withdrawals, etc.)
        public string? Notes { get; set; }
        public DateTime ClosedAt { get; set; } = DateTime.UtcNow;
        // Breakdowns for record keeping
        public decimal CashSales { get; set; }
        public decimal CardSales { get; set; }
        public decimal MobileSales { get; set; }
        
        // Tracking submitter identity
        public int? SubmittedByUserId { get; set; }
        public string? SubmittedByUserName { get; set; }
    }

    public class TableBooking
    {
        public int Id { get; set; }
        public string FloorName { get; set; } = string.Empty;
        public string TableNumber { get; set; } = string.Empty;
        public int SeatNumber { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int? DurationMinutes { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool IsOpenEnded { get; set; } = false;

        public string Status { get; set; } = "Active"; // Active, Completed, Cancelled
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? OrderId { get; set; } // Links to order when placed
    }

    public class TableSeat
    {
        public int Id { get; set; }
        public string FloorName { get; set; } = string.Empty;
        public string TableNumber { get; set; } = string.Empty;
        public int SeatNumber { get; set; }
        public string Status { get; set; } = "Available"; // Available, Reserved, Occupied
        public int? OrderId { get; set; }
        public int? BookingId { get; set; }
        public DateTime? OccupiedAt { get; set; }
        public DateTime? ReadyAt { get; set; } // When order status changed to Ready
        public DateTime? AutoReleaseAt { get; set; } // ReadyAt + 30 minutes
    }

    public class CashTransaction
    {
        public int Id { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string Type { get; set; } = string.Empty; // "Add" or "Remove"
        public decimal Amount { get; set; }
        public string? Reason { get; set; }
        public int? UserId { get; set; }
    }
}

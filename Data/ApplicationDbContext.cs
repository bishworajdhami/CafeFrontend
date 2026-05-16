using cafeSystem.Models;
using CafeSystem.Models;
using Microsoft.EntityFrameworkCore;

namespace cafeSystem.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<MenuItem> MenuItems { get; set; }
        public DbSet<InventoryItem> InventoryItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<TableSession> TableSessions { get; set; }
        public DbSet<TableSessionCharge> TableSessionCharges { get; set; }
        public DbSet<BillSplit> BillSplits { get; set; }
        public DbSet<Report> Reports { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Refund> Refunds { get; set; }
        public DbSet<RefundItem> RefundItems { get; set; }
        public DbSet<Setting> Settings { get; set; }
        public DbSet<Discount> Discounts { get; set; }
        public DbSet<DiscountMenuItem> DiscountMenuItems { get; set; }
        public DbSet<Models.Product> Products { get; set; }
        public DbSet<Models.StockBatch> StockBatches { get; set; }
        public DbSet<Models.StockTransaction> StockTransactions { get; set; }
        
        // public DbSet<Models.StockItem> StockItems { get; set; } // Deprecated
        public DbSet<CashClosing> CashClosings { get; set; }
        public DbSet<TableBooking> TableBookings { get; set; }
        public DbSet<TableSeat> TableSeats { get; set; }
        public DbSet<CashTransaction> CashTransactions { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure MenuItem to automatically filter out soft-deleted items
            modelBuilder.Entity<MenuItem>().HasQueryFilter(m => !m.IsDeleted);

            // Configure Order entity to explicitly map column names
            modelBuilder.Entity<Order>(entity =>
            {
                entity.ToTable("Orders");
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.UserId).HasColumnName("UserId");
                entity.Property(e => e.TableSessionId).HasColumnName("TableSessionId");
                entity.Property(e => e.OrderType).HasColumnName("OrderType");
                entity.Property(e => e.TableNumber).HasColumnName("TableNumber");
                entity.Property(e => e.Status).HasColumnName("Status");
                entity.Property(e => e.Subtotal).HasColumnName("Subtotal");
                entity.Property(e => e.Tax).HasColumnName("Tax");
                entity.Property(e => e.Total).HasColumnName("Total");
                entity.Property(e => e.PaymentStatus).HasColumnName("PaymentStatus");
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.ReadyAt).HasColumnName("ReadyAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
                entity.Property(e => e.BookingId).HasColumnName("BookingId");
                entity.Property(e => e.FloorName).HasColumnName("FloorName");
                entity.Property(e => e.SeatNumber).HasColumnName("SeatNumber");
                
                // Configure relationship with OrderItems
                entity.HasMany(e => e.Items)
                    .WithOne()
                    .HasForeignKey(oi => oi.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure OrderItem entity to explicitly map column names
            modelBuilder.Entity<OrderItem>(entity =>
            {
                entity.ToTable("OrderItems");
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.OrderId).HasColumnName("OrderId");
                entity.Property(e => e.MenuItemId).HasColumnName("MenuItemId");
                entity.Property(e => e.Name).HasColumnName("Name");
                entity.Property(e => e.Quantity).HasColumnName("Quantity");
                entity.Property(e => e.Price).HasColumnName("Price");
                entity.Property(e => e.SpecialRequest).HasColumnName("SpecialRequest");
            });

            modelBuilder.Entity<TableSession>(entity =>
            {
                entity.ToTable("TableSessions");
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.FloorName).HasColumnName("FloorName");
                entity.Property(e => e.TableNumber).HasColumnName("TableNumber");
                entity.Property(e => e.Status).HasColumnName("Status");
                entity.Property(e => e.CustomerName).HasColumnName("CustomerName");
                entity.Property(e => e.CustomerPhone).HasColumnName("CustomerPhone");
                entity.Property(e => e.BookingId).HasColumnName("BookingId");
                entity.Property(e => e.CurrentOrderId).HasColumnName("CurrentOrderId");
                entity.Property(e => e.OpenedAt).HasColumnName("OpenedAt");
                entity.Property(e => e.ClosedAt).HasColumnName("ClosedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");

                entity.HasIndex(e => new { e.FloorName, e.TableNumber, e.Status });
            });

            modelBuilder.Entity<TableSessionCharge>(entity =>
            {
                entity.ToTable("TableSessionCharges");
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.TableSessionId).HasColumnName("TableSessionId");
                entity.Property(e => e.Type).HasColumnName("Type");
                entity.Property(e => e.Amount).HasColumnName("Amount");
                entity.Property(e => e.Status).HasColumnName("Status");
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.PaidAt).HasColumnName("PaidAt");
            });
        }
    }
}
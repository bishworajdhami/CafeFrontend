using cafeSystem.Data;
using cafeSystem.Hubs;
using cafeSystem.Models;
using cafeSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Configure JSON serialization to use camelCase naming
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Allow frontend at http://localhost and live Vercel production site
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",          // Standard React local port
                "http://localhost:5173",          // Vite local port
                "https://cafepos-kappa.vercel.app"  // Your live production Vercel site
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Retained so SignalR hubs work seamlessly
    });
});

// SignalR (WebSocket hub)
builder.Services.AddSignalR();

// Configure DbContext (SQL Server)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure JWT settings
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
var key = Encoding.UTF8.GetBytes(jwtSettings.SecretKey);

// Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };

    // SignalR sends the token in the query string 'access_token' for WebSockets/SSE
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// Password hasher for users
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Email service registration so controllers can resolve IEmailService
builder.Services.AddSingleton<IEmailService, EmailService>();

// Azure Blob Storage service for image uploads
builder.Services.AddSingleton<BlobStorageService>();

// Stock service — encapsulates all inventory business logic
builder.Services.AddScoped<StockService>();

// Background workers
builder.Services.AddHostedService<StockAutoDeductionService>();

var app = builder.Build();

// MANUAL DATABASE FIX: Add Permissions column if missing
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try {
        context.Database.ExecuteSqlRaw(@"
            IF COL_LENGTH('Users', 'Permissions') IS NULL 
            BEGIN
                ALTER TABLE Users ADD Permissions nvarchar(max) NULL;
                PRINT 'Added Permissions column to Users table.';
            END

            IF NOT EXISTS (SELECT * FROM __EFMigrationsHistory WHERE MigrationId = '20260408181721_AddUserPermissions')
            BEGIN
                INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) 
                VALUES ('20260408181721_AddUserPermissions', '9.0.0');
                PRINT 'Registered Permissions migration.';
            END
        ");
        Console.WriteLine("[DB FIX] Permissions column and migration history ensured.");
    } catch (Exception ex) {
        Console.WriteLine($"[DB FIX] Error or already exists: {ex.Message}");
    }
}

// MANUAL DATABASE FIX: Add SubmittedBy columns to CashClosings if missing
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try {
        context.Database.ExecuteSqlRaw(@"
            IF COL_LENGTH('CashClosings', 'SubmittedByUserId') IS NULL
            BEGIN
                ALTER TABLE CashClosings ADD SubmittedByUserId int NULL;
                PRINT 'Added SubmittedByUserId column to CashClosings table.';
            END

            IF COL_LENGTH('CashClosings', 'SubmittedByUserName') IS NULL
            BEGIN
                ALTER TABLE CashClosings ADD SubmittedByUserName nvarchar(max) NULL;
                PRINT 'Added SubmittedByUserName column to CashClosings table.';
            END
        ");
        Console.WriteLine("[DB FIX] CashClosings SubmittedBy columns ensured.");
    } catch (Exception ex) {
        Console.WriteLine($"[DB FIX] CashClosings column error: {ex.Message}");
    }
}

// MANUAL DATABASE FIX: Repair missing permissions for existing accounts
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try {
        // Backfill Cashiers — only when Permissions has never been set (IS NULL).
        // An empty string means the manager deliberately disabled ALL permissions
        // for that account, so we must NOT reset it here.
        context.Database.ExecuteSqlRaw(@"
            UPDATE Users 
            SET Permissions = 'pos.toggle_availability,pos.process_refunds,pos.manage_discounts' 
            WHERE Role = 'Cashier' 
            AND Permissions IS NULL;
        ");

        // Backfill Chefs — same rule as above.
        context.Database.ExecuteSqlRaw(@"
            UPDATE Users 
            SET Permissions = 'kitchen.manage_menu,kitchen.toggle_availability' 
            WHERE Role = 'Chef' 
            AND Permissions IS NULL;
        ");
        Console.WriteLine("[DB FIX] Existing account permissions repaired.");
    } catch (Exception ex) {
        Console.WriteLine($"[DB FIX] Permission repair error: {ex.Message}");
    }
}

// MANUAL DATABASE FIX: TableSession + session charge support
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        context.Database.ExecuteSqlRaw(@"
            -- Orders: add TableSessionId + UpdatedAt if missing
            IF COL_LENGTH('Orders', 'TableSessionId') IS NULL
            BEGIN
                ALTER TABLE Orders ADD TableSessionId int NULL;
                PRINT 'Added TableSessionId to Orders.';
            END

            IF COL_LENGTH('Orders', 'UpdatedAt') IS NULL
            BEGIN
                ALTER TABLE Orders ADD UpdatedAt datetime2 NULL;
                EXEC('UPDATE Orders SET UpdatedAt = ISNULL(UpdatedAt, CreatedAt);');
                PRINT 'Added UpdatedAt to Orders.';
            END

            -- Payments: allow booking-only payments by making OrderId nullable and adding TableSessionId
            IF COL_LENGTH('Payments', 'TableSessionId') IS NULL
            BEGIN
                ALTER TABLE Payments ADD TableSessionId int NULL;
                PRINT 'Added TableSessionId to Payments.';
            END

            -- Make OrderId nullable if currently NOT NULL
            IF EXISTS (
                SELECT 1
                FROM sys.columns c
                JOIN sys.objects o ON c.object_id = o.object_id
                WHERE o.name = 'Payments' AND c.name = 'OrderId' AND c.is_nullable = 0
            )
            BEGIN
                ALTER TABLE Payments ALTER COLUMN OrderId int NULL;
                PRINT 'Altered Payments.OrderId to NULL.';
            END

            -- Create TableSessions if missing
            IF OBJECT_ID('TableSessions') IS NULL
            BEGIN
                CREATE TABLE TableSessions (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    FloorName nvarchar(max) NOT NULL,
                    TableNumber nvarchar(max) NOT NULL,
                    Status nvarchar(max) NOT NULL,
                    CustomerName nvarchar(max) NULL,
                    CustomerPhone nvarchar(max) NULL,
                    BookingId int NULL,
                    CurrentOrderId int NULL,
                    OpenedAt datetime2 NOT NULL,
                    ClosedAt datetime2 NULL,
                    UpdatedAt datetime2 NOT NULL
                );
                PRINT 'Created TableSessions.';
            END

            -- Create TableSessionCharges if missing
            IF OBJECT_ID('TableSessionCharges') IS NULL
            BEGIN
                CREATE TABLE TableSessionCharges (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    TableSessionId int NOT NULL,
                    Type nvarchar(max) NOT NULL,
                    Amount decimal(18,2) NOT NULL,
                    Status nvarchar(max) NOT NULL,
                    CreatedAt datetime2 NOT NULL,
                    PaidAt datetime2 NULL
                );
                PRINT 'Created TableSessionCharges.';
            END
        ");

        Console.WriteLine("[DB FIX] TableSession tables/columns ensured.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB FIX] TableSession ensure error: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles(); // Serve images and other static content
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Apply CORS policy (must be before Authentication/Authorization)
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.UseWebSockets(); // Explicitly enable WebSockets support
app.MapHub<OrderHub>("/hubs/orders"); // WebSocket hub

app.Run();

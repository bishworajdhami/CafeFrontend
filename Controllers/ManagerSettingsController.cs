using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using cafeSystem.Data;
using cafeSystem.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json; // Added for JSON serialization
using System.Text.Json.Serialization;
using cafeSystem.Services;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/manager")]
    [Authorize]
    public class ManagerSettingsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly BlobStorageService _blobService;

        public ManagerSettingsController(ApplicationDbContext context, IPasswordHasher<User> passwordHasher, BlobStorageService blobService)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _blobService = blobService;
        }

        //System Settings Endpoints
        [AllowAnonymous]
        [HttpGet("settings/public")]
        public async Task<IActionResult> GetPublicSettings()
        {
            var cafeName = await _context.Settings.FirstOrDefaultAsync(s => s.Key == "CafeName");
            var cafeLogo = await _context.Settings.FirstOrDefaultAsync(s => s.Key == "CafeLogo");
            
            return Ok(new
            {
                CafeName = cafeName?.Value ?? "Cafe System",
                CafeLogo = cafeLogo?.Value
            });
        }

        // Dynamic PWA Manifest — returns real cafe name from DB so Android shows correct app name
        [AllowAnonymous]
        [HttpGet("settings/manifest.json")]
        public async Task<IActionResult> GetManifest()
        {
            var cafeName = await _context.Settings.FirstOrDefaultAsync(s => s.Key == "CafeName");
            var name = cafeName?.Value ?? "KTM Roast & Brew";
            var shortName = name.Length > 12 ? name.Split(' ')[0] : name;

            var manifest = new
            {
                short_name = shortName,
                name = name,
                icons = new[]
                {
                    new { src = "/favicon.ico", sizes = "64x64 32x32 24x24 16x16", type = "image/x-icon" },
                    new { src = "/logo192.png", type = "image/png", sizes = "192x192" },
                    new { src = "/logo512.png", type = "image/png", sizes = "512x512" }
                },
                start_url = "/",
                display = "standalone",
                theme_color = "#1a0f0a",
                background_color = "#1a0f0a"
            };

            return new JsonResult(manifest) { ContentType = "application/manifest+json" };
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings([FromQuery] bool includePaymentMethods = false)
        {
            // Optimize: Load all LIGHTWEIGHT settings in ONE query
            // CRITICAL: Exclude "PaymentMethods" because it contains large Base64 images that slow down the query
            var allSettings = await _context.Settings
                .Where(s => s.Key != "PaymentMethods")
                .ToListAsync();

            string? GetVal(string key) => allSettings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase))?.Value;
            Models.Setting? GetSetting(string key) => allSettings.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase));

            Models.Setting? paymentMethodsSetting = null;
            if (includePaymentMethods)
            {
                // Only load the heavy payment methods if explicitly requested
                paymentMethodsSetting = await _context.Settings.FirstOrDefaultAsync(s => s.Key == "PaymentMethods");
            }

            var cashDrawerOpeningBalanceSetting = GetSetting("CashDrawerOpeningBalance");
            decimal baseBalance = 200m;
            if (cashDrawerOpeningBalanceSetting != null)
                decimal.TryParse(cashDrawerOpeningBalanceSetting.Value ?? "200", out baseBalance);

            var settings = new
            {
                vatPercentage = decimal.Parse(GetVal("VatPercentage") ?? "13"),
                vatIncluded = bool.Parse(GetVal("VatIncluded") ?? "false"),
                serviceChargePercentage = decimal.Parse(GetVal("ServiceChargePercentage") ?? "0"),
                serviceChargeIncluded = bool.Parse(GetVal("ServiceChargeIncluded") ?? "false"),
                showRefundTab = bool.Parse(GetVal("ShowRefundTab") ?? "true"),
                payFirst = bool.Parse(GetVal("PayFirst") ?? "false"),
                cashDrawerOpeningBalance = baseBalance,
                tableConfiguration = GetVal("TableConfiguration"),
                enableManualTableSelection = bool.Parse(GetVal("enableManualTableSelection") ?? "true"),
                enableTableBooking = bool.Parse(GetVal("enableTableBooking") ?? "true"),
                tableBookingCharge = decimal.Parse(GetVal("tableBookingCharge") ?? "100"),
                tableBookingChargeType = GetVal("tableBookingChargeType") ?? "flat",
                cafeName = GetVal("CafeName") ?? "Cafe",
                cafeOutletAddress = GetVal("CafeAddress") ?? "",
                cafeContactPhone = GetVal("CafePhone") ?? "",
                cafePan = GetVal("CafePan") ?? "",
                paymentMethods = paymentMethodsSetting != null ? paymentMethodsSetting.Value : null,
                cafeLogo = GetVal("CafeLogo")
            };

            return Ok(settings);
        }

        [HttpPut("settings")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsRequest model)
        {
            if (model == null)
                return BadRequest(new { status = false, message = "Invalid settings data" });

            // Save or update settings in database
            await SaveOrUpdateSetting("VatPercentage", model.VatPercentage.ToString());
            await SaveOrUpdateSetting("VatIncluded", model.VatIncluded.ToString());
            await SaveOrUpdateSetting("ServiceChargePercentage", model.ServiceChargePercentage.ToString());
            await SaveOrUpdateSetting("ServiceChargeIncluded", model.ServiceChargeIncluded.ToString());
            
            // New Settings
            await SaveOrUpdateSetting("ShowRefundTab", model.ShowRefundTab.ToString());
            await SaveOrUpdateSetting("PayFirst", model.PayFirst.ToString());
            await SaveOrUpdateSetting("enableManualTableSelection", model.EnableManualTableSelection.ToString());
            await SaveOrUpdateSetting("enableTableBooking", model.EnableTableBooking.ToString());
            await SaveOrUpdateSetting("tableBookingCharge", model.TableBookingCharge.ToString());
            await SaveOrUpdateSetting("tableBookingChargeType", model.TableBookingChargeType);
            await SaveOrUpdateSetting("CafeName", model.CafeName ?? "Cafe");
            await SaveOrUpdateSetting("CafeAddress", model.CafeOutletAddress ?? "");
            await SaveOrUpdateSetting("CafePhone", model.CafeContactPhone ?? "");
            await SaveOrUpdateSetting("CafePan", model.CafePan ?? "");
            await SaveOrUpdateSetting("CafeLogo", model.CafeLogo ?? "");

            // Handle Table Configuration (save as raw JSON string)
            if (model.TableConfiguration != null)
            {
                // Ensure we save a string representation of the JSON object
                string configJson = JsonSerializer.Serialize(model.TableConfiguration);
                await SaveOrUpdateSetting("TableConfiguration", configJson);
            }

            // Handle Payment Methods with validation
            if (model.PaymentMethods != null)
            {
                // Validate payment methods
                string validationError = ValidatePaymentMethods(model.PaymentMethods);
                if (validationError != null)
                {
                    return BadRequest(new { status = false, message = validationError });
                }

                string paymentMethodsJson = JsonSerializer.Serialize(model.PaymentMethods);
                await SaveOrUpdateSetting("PaymentMethods", paymentMethodsJson);
            }

            await _context.SaveChangesAsync();
            
            return Ok(new { 
                status = true, 
                message = "Settings updated successfully",
                settings = new
                {
                    vatPercentage = model.VatPercentage,
                    vatIncluded = model.VatIncluded,
                    serviceChargePercentage = model.ServiceChargePercentage,
                    serviceChargeIncluded = model.ServiceChargeIncluded,
                    showRefundTab = model.ShowRefundTab,
                    tableConfiguration = model.TableConfiguration,
                    enableManualTableSelection = model.EnableManualTableSelection,
                    enableTableBooking = model.EnableTableBooking,
                    tableBookingCharge = model.TableBookingCharge,
                    tableBookingChargeType = model.TableBookingChargeType,
                    cafeName = model.CafeName ?? "Cafe",
                    paymentMethods = model.PaymentMethods,
                    cafeLogo = model.CafeLogo
                }
            });
        }

        [HttpPost("settings/upload-qr")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> UploadPaymentQr(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { status = false, message = "No file uploaded." });

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg" };
            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest(new { status = false, message = "Invalid file type. Only JPG and PNG are allowed." });

            if (file.Length > 2 * 1024 * 1024)
                return BadRequest(new { status = false, message = "File size exceeds 2MB limit." });

            var url = await _blobService.UploadAsync(file, "qr");
            return Ok(new { status = true, url });
        }

        [HttpPost("settings/upload-logo")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> UploadLogo(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { status = false, message = "No file uploaded." });

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg" };
            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest(new { status = false, message = "Invalid file type. Only JPG and PNG are allowed." });

            if (file.Length > 2 * 1024 * 1024)
                return BadRequest(new { status = false, message = "File size exceeds 2MB limit." });

            var url = await _blobService.UploadAsync(file, "branding");
            return Ok(new { status = true, url });
        }

        private string? ValidatePaymentMethods(object paymentMethodsObj)
        {
            try
            {
                // Serialize and deserialize to validate structure
                string json = JsonSerializer.Serialize(paymentMethodsObj);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var methods = JsonSerializer.Deserialize<List<PaymentMethod>>(json, options);

                if (methods == null) return null;

                foreach (var method in methods)
                {
                    // Validate QR code image if present
                    if (!string.IsNullOrEmpty(method.QrCodeImage))
                    {
                        // Check if it's already a valid file URL (local or cloud)
                        if (method.QrCodeImage.StartsWith("/uploads/qr/") || 
                            method.QrCodeImage.StartsWith("http://") || 
                            method.QrCodeImage.StartsWith("https://"))
                        {
                            continue; // Valid file URL
                        }

                        // Check if it's a valid base64 data URL (for backwards compatibility before saving)
                        if (!method.QrCodeImage.StartsWith("data:image/"))
                        {
                            return $"Invalid QR code format for {method.Name}. Must be a file URL or data URL.";
                        }

                        // Extract base64 part and validate size (max 2MB)
                        var base64Data = method.QrCodeImage.Split(',').Length > 1 
                            ? method.QrCodeImage.Split(',')[1] 
                            : method.QrCodeImage;

                        try
                        {
                            byte[] imageBytes = Convert.FromBase64String(base64Data);
                            double sizeInMB = imageBytes.Length / (1024.0 * 1024.0);

                            if (sizeInMB > 2.0)
                            {
                                return $"QR code image for {method.Name} exceeds 2MB limit ({sizeInMB:F2}MB).";
                            }
                        }
                        catch
                        {
                            return $"Invalid base64 encoding for {method.Name} QR code.";
                        }
                    }
                }

                return null; // Validation passed
            }
            catch (Exception ex)
            {
                return $"Invalid payment methods format: {ex.Message}";
            }
        }

        private async Task SaveOrUpdateSetting(string key, string value)
        {
            var setting = await _context.Settings.FirstOrDefaultAsync(s => s.Key == key);
            if (setting == null)
            {
                setting = new Setting
                {
                    Key = key,
                    Value = value,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(setting);
            }
            else
            {
                setting.Value = value;
                setting.UpdatedAt = DateTime.UtcNow;
            }
        }

        public class UpdateSettingsRequest
        {
            public decimal VatPercentage { get; set; }
            public bool VatIncluded { get; set; }
            public decimal ServiceChargePercentage { get; set; }
            public bool ServiceChargeIncluded { get; set; }
            public bool ShowRefundTab { get; set; }
            public bool PayFirst { get; set; } = false;
            public object? TableConfiguration { get; set; } // Accept any JSON object structure
            public bool EnableManualTableSelection { get; set; } = true;
            public bool EnableTableBooking { get; set; } = true;
            public decimal TableBookingCharge { get; set; } = 100;
            public string TableBookingChargeType { get; set; } = "flat";
            [JsonPropertyName("cafeName")]
            public string? CafeName { get; set; } = "Cafe";
            [JsonPropertyName("cafeOutletAddress")]
            public string? CafeOutletAddress { get; set; } = "";
            [JsonPropertyName("cafeContactPhone")]
            public string? CafeContactPhone { get; set; } = "";
            [JsonPropertyName("cafePan")]
            public string? CafePan { get; set; } = "";
            public object? PaymentMethods { get; set; } // Payment methods configuration
            public string? CafeLogo { get; set; } // Base64 logo data
        }

        public class PaymentMethod
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public bool Enabled { get; set; }
            public string? QrCodeImage { get; set; } // Base64 data URL
        }

        // Category Management Endpoints
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            // Get categories from Categories table
            var categories = await _context.Categories
                .OrderBy(c => c.Name)
                .Select(c => new { id = c.Id, name = c.Name })
                .ToListAsync();

            return Ok(categories);
        }

        [HttpPost("categories")]
        [Authorize(Roles = "Manager,Chef")]
        public async Task<IActionResult> AddCategory([FromBody] AddCategoryRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { status = false, message = "Category name is required" });

            var categoryName = model.Name.Trim();
            
            // Check if category already exists
            var exists = await _context.Categories
                .AnyAsync(c => c.Name.ToLower() == categoryName.ToLower());

            if (exists)
                return Conflict(new { status = false, message = "Category already exists" });

            // Create new category
            var category = new Category
            {
                Name = categoryName,
                CreatedAt = DateTime.UtcNow
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(new { 
                status = true, 
                message = "Category added successfully",
                category = new { id = category.Id, name = category.Name }
            });
        }

        [HttpPut("categories/{id}")]
        [Authorize(Roles = "Manager,Chef")]
        public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { status = false, message = "Category name is required" });

            var newCategoryName = model.Name.Trim();
            
            // Find the category
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
                return NotFound(new { status = false, message = "Category not found" });

            // Check if new name already exists (excluding current category)
            var nameExists = await _context.Categories
                .AnyAsync(c => c.Name.ToLower() == newCategoryName.ToLower() && c.Id != id);

            if (nameExists)
                return Conflict(new { status = false, message = "A category with this name already exists" });

            var oldCategoryName = category.Name;

            // Update category name
            category.Name = newCategoryName;

            // Update all menu items with this category
            var menuItems = await _context.MenuItems
                .Where(m => m.Category == oldCategoryName)
                .ToListAsync();

            foreach (var item in menuItems)
            {
                item.Category = newCategoryName;
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                status = true, 
                message = "Category updated successfully",
                category = new { id = category.Id, name = category.Name }
            });
        }

        [HttpDelete("categories/{id}")]
        [Authorize(Roles = "Manager,Chef")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);

            if (category == null)
                return NotFound(new { status = false, message = "Category not found" });

            // Block deletion if any menu items still belong to this category
            var itemCount = await _context.MenuItems
                .CountAsync(m => m.Category == category.Name);

            if (itemCount > 0)
                return BadRequest(new
                {
                    status = false,
                    message = $"Cannot delete \"{category.Name}\" — it still has {itemCount} menu item{(itemCount == 1 ? "" : "s")}. Reassign or delete those items first."
                });

            // Safe to delete
            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            return Ok(new { status = true, message = "Category deleted successfully" });
        }

        public class AddCategoryRequest
        {
            public string Name { get; set; }
        }

        public class UpdateCategoryRequest
        {
            public string Name { get; set; }
        }

        // Data Management Endpoints
        /// <summary>
        /// Clears all operational/transactional data while preserving accounts and settings
        /// </summary>
        [HttpPost("clear-operational-data")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> ClearOperationalData()
        {
            try
            {
                // Start a transaction to ensure all-or-nothing deletion
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Delete in order to respect foreign key constraints
                    // 1. Delete RefundItems first (depends on Refunds)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM RefundItems");

                    // 2. Delete Refunds
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Refunds");

                    // 3. Delete BillSplits (depends on Payments)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM BillSplits");

                    // 4. Delete Payments
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Payments");

                    // 5. Delete OrderItems first (depends on Orders)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM OrderItems");

                    // 6. Delete Orders
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Orders");

                    // 7. Delete TableSeats (depends on TableBookings)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM TableSeats");

                    // 8. Delete TableBookings
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM TableBookings");

                    // 9. Delete Reports (if they exist)
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM Reports");

                    // 10. Delete CashClosings
                    await _context.Database.ExecuteSqlRawAsync("DELETE FROM CashClosings");

                    // Commit transaction
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        status = true,
                        message = "All operational data has been cleared successfully. Accounts, menu items, and settings have been preserved."
                    });
                }
                catch (Exception ex)
                {
                    // Rollback transaction on error
                    await transaction.RollbackAsync();
                    return StatusCode(500, new
                    {
                        status = false,
                        message = $"Failed to clear operational data: {ex.Message}"
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    status = false,
                    message = $"Transaction error: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Deletes ALL user accounts from the system
        /// WARNING: This is an extremely dangerous operation!
        /// </summary>
        [HttpPost("delete-all-accounts")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> DeleteAllAccounts()
        {
            try
            {
                // Get the current user's ID to optionally preserve their account
                var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                // Delete all users
                // Option 1: Delete ALL accounts (uncomment the line below and comment the foreach loop)
                // await _context.Database.ExecuteSqlRawAsync("DELETE FROM Users");

                // Option 2: Delete all accounts except the current manager (safer option)
                var allUsers = await _context.Users.ToListAsync();
                
                // Delete all users
                foreach (var user in allUsers)
                {
                    _context.Users.Remove(user);
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    status = true,
                    message = $"All user accounts have been deleted successfully. {allUsers.Count} account(s) removed."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    status = false,
                    message = $"Failed to delete accounts: {ex.Message}"
                });
            }
        }
    }
}


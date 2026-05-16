using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;
using System.Text;
using cafeSystem.Models;
using cafeSystem.Data;
using cafeSystem.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Identity;
using System.Linq;

namespace cafeSystem.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class LoginController : ControllerBase
    {
        private readonly JwtSettings _jwtSettings;
        private readonly ApplicationDbContext _context;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly BlobStorageService _blobService;

        private static readonly string[] AllowedRoles = new[] { "Manager", "Cashier", "Chef", "Waiter" };


        public LoginController(ApplicationDbContext context, IOptions<JwtSettings> jwtSettings, IPasswordHasher<User> passwordHasher, IEmailService emailService, IConfiguration configuration, BlobStorageService blobService)
        {
            _context = context;
            _jwtSettings = jwtSettings.Value;
            _passwordHasher = passwordHasher;
            _emailService = emailService;
            _configuration = configuration;
            _blobService = blobService;
        }

        // DTOs for requests


        public class LoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
            public string? Role { get; set; } // optional – role is determined server-side from DB
        }



        public class CreateStaffRequest
        {
            public string Email { get; set; }
            public string Role { get; set; }
            public string? Name { get; set; }
        }

        public class FirstLoginOTPRequest
        {
            public string Email { get; set; }
            public string OTP { get; set; }
        }

        public class SetNewPasswordRequest
        {
            public string Email { get; set; }
            public string NewPassword { get; set; }
        }

        public class ForgotPasswordRequest
        {
            public string Email { get; set; }
        }

        public class VerifyPasswordResetOTPRequest
        {
            public string Email { get; set; }
            public string OTP { get; set; }
        }

        public class ResetPasswordRequest
        {
            public string Email { get; set; }
            public string OTP { get; set; }
            public string NewPassword { get; set; }
        }

        public class UpdateProfileRequest
        {
            public string Name { get; set; }
        }


        private string GenerateOTP()
        {
            var random = new Random();
            return random.Next(100000, 999999).ToString();
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
                return BadRequest(new { status = false, message = "Invalid login data" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(x => x.Email == emailNormalized);
            if (user == null)
                return Unauthorized(new { status = false, message = "Invalid credentials" });

            // Check if email is verified (for regular registration, not first login)
            if (!user.EmailVerified && !user.IsFirstLogin)
                return Unauthorized(new { status = false, message = "Please verify your email before logging in. Check your email for the OTP code." });

            // Check password - for first login, check against temporary password
            PasswordVerificationResult verify;
            if (user.IsFirstLogin && !string.IsNullOrEmpty(user.TemporaryPassword))
            {
                // Check against temporary password
                verify = _passwordHasher.VerifyHashedPassword(user, user.TemporaryPassword, model.Password);
            }
            else
            {
                // Check against regular password
                verify = _passwordHasher.VerifyHashedPassword(user, user.Password, model.Password);
            }

            if (verify == PasswordVerificationResult.Failed)
                return Unauthorized(new { status = false, message = "Invalid credentials" });

            // If first login, return flag to trigger OTP flow
            if (user.IsFirstLogin)
            {
                // Generate and send OTP for first login
                var otp = GenerateOTP();
                user.OTP = otp;
                user.OTPExpiry = DateTime.UtcNow.AddMinutes(10);
                await _context.SaveChangesAsync();

                try
                {
                    await _emailService.SendOTPEmailAsync(user.Email, otp);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[FIRST LOGIN] Failed to send OTP: {ex.Message}");
                }

                var skipSending = _configuration["EmailSettings:SkipSending"] ?? "true";
                return Ok(new { 
                    status = true, 
                    message = "First login detected. Please verify your email with OTP.",
                    requiresFirstLoginOTP = true,
                    email = user.Email,
                    otp = bool.Parse(skipSending) ? otp : null, // Only in dev mode
                    developmentMode = bool.Parse(skipSending)
                });
            }

            // Regular login - generate token
            var token = GenerateToken(user);
            return Ok(new { status = true, message = "Login Successful", token = token, role = user.Role, name = user.Name, email = user.Email, profilePictureUrl = user.ProfilePictureUrl, permissions = user.Permissions });
        }

        private string GenerateToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };
            if (!string.IsNullOrEmpty(user.Permissions))
            {
                var perms = user.Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries);
                foreach (var p in perms)
                {
                    claims.Add(new Claim("Permissions", p.Trim()));
                }
            }
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiryMinutes),
                Issuer = _jwtSettings.Issuer,
                Audience = _jwtSettings.Audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        private string GenerateTemporaryPassword()
        {
            // Generate a secure temporary password (12 characters: letters, numbers, special chars)
            var random = new Random();
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
            return new string(Enumerable.Repeat(chars, 12)
                .Select(s => s[random.Next(s.Length)]).ToArray());
        }

        [HttpPost("create-staff")]
        public async Task<IActionResult> CreateStaff([FromBody] CreateStaffRequest model)
        {
            // This endpoint is for managers to create staff accounts easily
            // No OTP required - just generate temp password and send email
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Role))
                return BadRequest(new { status = false, message = "Email and role are required" });

            if (!AllowedRoles.Contains(model.Role))
                return BadRequest(new { status = false, message = $"Role must be one of: {string.Join(", ", AllowedRoles)}" });

            // Only allow Cashier and Chef to be created this way
            if (model.Role == "Manager")
                return BadRequest(new { status = false, message = "Manager accounts must be registered through the registration page" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var existing = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            if (existing != null)
                return Conflict(new { status = false, message = "User with this email already exists" });

            // Generate temporary password
            var temporaryPassword = GenerateTemporaryPassword();
            
            // Create temp user for password hashing
            var tempUser = new User
            {
                Email = emailNormalized,
                Role = model.Role,
                Password = string.Empty
            };

            var hashedPassword = _passwordHasher.HashPassword(tempUser, temporaryPassword);
            var hashedTempPassword = _passwordHasher.HashPassword(tempUser, temporaryPassword);

            // Assign default permissions based on role
            string defaultPermissions = "";
            if (model.Role == "Cashier")
            {
                defaultPermissions = "pos.toggle_availability,pos.process_refunds,pos.manage_discounts";
            }
            else if (model.Role == "Chef")
            {
                defaultPermissions = "kitchen.manage_menu,kitchen.toggle_availability";
            }
            else if (model.Role == "Waiter")
            {
                defaultPermissions = "waiter.take_orders,waiter.view_tables";
            }


            // Create user with first login flag
            var user = new User
            {
                Email = emailNormalized,
                Role = model.Role,
                Name = model.Name,
                Password = hashedPassword,
                TemporaryPassword = hashedTempPassword, // Store hashed temp password
                Permissions = defaultPermissions,
                EmailVerified = false, // Will be verified during first login
                IsFirstLogin = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            try
            {
                // Send temporary password email
                await _emailService.SendTemporaryPasswordEmailAsync(user.Email, temporaryPassword, user.Role);
                
                var skipSending = _configuration["EmailSettings:SkipSending"] ?? "true";
                if (bool.Parse(skipSending))
                {
                    // Development mode: Return temp password in response
                    return Ok(new { 
                        status = true, 
                        message = "Staff account created successfully. Temporary password sent (check backend console).",
                        id = user.Id,
                        email = user.Email,
                        role = user.Role,
                        name = user.Name,
                        temporaryPassword = temporaryPassword, // Only in dev mode
                        developmentMode = true
                    });
                }
                else
                {
                    return Ok(new { 
                        status = true, 
                        message = "Staff account created successfully. Temporary password has been sent to the staff member's email.",
                        id = user.Id,
                        email = user.Email,
                        role = user.Role,
                        name = user.Name
                    });
                }
            }
            catch (Exception ex)
            {
                // If email fails, still return success but log the error
                Console.WriteLine($"[STAFF CREATION] Failed to send email: {ex.Message}");
                return Ok(new { 
                    status = true, 
                    message = "Staff account created, but failed to send email. Temporary password: " + temporaryPassword,
                    id = user.Id,
                    email = user.Email,
                    role = user.Role,
                    name = user.Name,
                    temporaryPassword = temporaryPassword // Include in case email failed
                });
            }
        }

        [HttpPost("verify-first-login-otp")]
        public async Task<IActionResult> VerifyFirstLoginOTP([FromBody] FirstLoginOTPRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.OTP))
                return BadRequest(new { status = false, message = "Email and OTP are required" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            if (!user.IsFirstLogin)
                return BadRequest(new { status = false, message = "This is not a first login" });

            if (string.IsNullOrEmpty(user.OTP))
                return BadRequest(new { status = false, message = "No OTP found. Please try logging in again." });

            if (user.OTPExpiry == null || user.OTPExpiry < DateTime.UtcNow)
                return BadRequest(new { status = false, message = "OTP has expired. Please try logging in again." });

            if (user.OTP != model.OTP)
                return BadRequest(new { status = false, message = "Invalid OTP" });

            // OTP verified - clear OTP, mark email as verified, but keep IsFirstLogin until password is changed
            user.OTP = null;
            user.OTPExpiry = null;
            user.EmailVerified = true;
            await _context.SaveChangesAsync();

            return Ok(new { status = true, message = "OTP verified. Please set your new password.", email = user.Email });
        }

        [HttpPost("set-new-password")]
        public async Task<IActionResult> SetNewPassword([FromBody] SetNewPasswordRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.NewPassword))
                return BadRequest(new { status = false, message = "Email and new password are required" });

            if (model.NewPassword.Length < 6)
                return BadRequest(new { status = false, message = "Password must be at least 6 characters long" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            if (!user.IsFirstLogin)
                return BadRequest(new { status = false, message = "This is not a first login" });

            if (!user.EmailVerified)
                return BadRequest(new { status = false, message = "Email must be verified first" });

            // Hash new password
            var tempUser = new User
            {
                Email = emailNormalized,
                Role = user.Role,
                Password = string.Empty
            };
            var hashedNewPassword = _passwordHasher.HashPassword(tempUser, model.NewPassword);

            // Update password and clear first login flag
            user.Password = hashedNewPassword;
            user.TemporaryPassword = null; // Clear temporary password
            user.IsFirstLogin = false; // Mark as no longer first login

            // Backfill default permissions if account has none (handles accounts created before automatic permission assignment)
            if (string.IsNullOrWhiteSpace(user.Permissions))
            {
                if (user.Role == "Cashier")
                    user.Permissions = "pos.toggle_availability,pos.process_refunds,pos.manage_discounts";
                else if (user.Role == "Chef")
                    user.Permissions = "kitchen.manage_menu,kitchen.toggle_availability";
                else if (user.Role == "Waiter")
                    user.Permissions = "waiter.take_orders,waiter.view_tables";
            }


            await _context.SaveChangesAsync();

            // Generate token for immediate login
            var token = GenerateToken(user);
            return Ok(new { 
                status = true, 
                message = "Password set successfully. You are now logged in.",
                token = token,
                role = user.Role,
                email = user.Email,
                name = user.Name,
                profilePictureUrl = user.ProfilePictureUrl,
                permissions = user.Permissions
            });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email))
                return BadRequest(new { status = false, message = "Email is required" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            // For security, don't reveal if user exists or not
            if (user == null)
            {
                // Still return success to prevent email enumeration
                return Ok(new { 
                    status = true, 
                    message = "If an account with that email exists, a password reset OTP has been sent." 
                });
            }

            // Generate OTP for password reset
            var otp = GenerateOTP();
            user.OTP = otp;
            user.OTPExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();

            try
            {
                await _emailService.SendPasswordResetOTPEmailAsync(user.Email, otp);
                
                var skipSending = _configuration["EmailSettings:SkipSending"] ?? "true";
                if (bool.Parse(skipSending))
                {
                    // Development mode: Return OTP in response
                    return Ok(new { 
                        status = true, 
                        message = "Password reset OTP sent (check backend console).",
                        email = user.Email,
                        otp = otp, // Only in dev mode
                        developmentMode = true
                    });
                }
                else
                {
                    return Ok(new { 
                        status = true, 
                        message = "If an account with that email exists, a password reset OTP has been sent to your email."
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FORGOT PASSWORD] Failed to send OTP: {ex.Message}");
                // Still return success to prevent email enumeration
                return Ok(new { 
                    status = true, 
                    message = "If an account with that email exists, a password reset OTP has been sent.",
                    otp = bool.Parse(_configuration["EmailSettings:SkipSending"] ?? "true") ? otp : null // Only in dev mode
                });
            }
        }

        [HttpPost("verify-password-reset-otp")]
        public async Task<IActionResult> VerifyPasswordResetOTP([FromBody] VerifyPasswordResetOTPRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.OTP))
                return BadRequest(new { status = false, message = "Email and OTP are required" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            if (string.IsNullOrEmpty(user.OTP))
                return BadRequest(new { status = false, message = "No OTP found. Please request a new password reset." });

            if (user.OTPExpiry == null || user.OTPExpiry < DateTime.UtcNow)
                return BadRequest(new { status = false, message = "OTP has expired. Please request a new password reset." });

            if (user.OTP != model.OTP)
                return BadRequest(new { status = false, message = "Invalid OTP" });

            // OTP verified - keep OTP valid for password reset step
            // Don't clear OTP yet, it will be cleared when password is reset
            return Ok(new { 
                status = true, 
                message = "OTP verified. Please enter your new password.",
                email = user.Email
            });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || 
                string.IsNullOrWhiteSpace(model.OTP) || string.IsNullOrWhiteSpace(model.NewPassword))
                return BadRequest(new { status = false, message = "Email, OTP, and new password are required" });

            if (model.NewPassword.Length < 6)
                return BadRequest(new { status = false, message = "Password must be at least 6 characters long" });

            var emailNormalized = model.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            if (string.IsNullOrEmpty(user.OTP))
                return BadRequest(new { status = false, message = "No OTP found. Please request a new password reset." });

            if (user.OTPExpiry == null || user.OTPExpiry < DateTime.UtcNow)
                return BadRequest(new { status = false, message = "OTP has expired. Please request a new password reset." });

            if (user.OTP != model.OTP)
                return BadRequest(new { status = false, message = "Invalid OTP" });

            // Hash new password
            var tempUser = new User
            {
                Email = emailNormalized,
                Role = user.Role,
                Password = string.Empty
            };
            var hashedNewPassword = _passwordHasher.HashPassword(tempUser, model.NewPassword);

            // Update password and clear OTP
            user.Password = hashedNewPassword;
            user.OTP = null;
            user.OTPExpiry = null;
            // Clear temporary password if it exists (in case of first login that was interrupted)
            if (!string.IsNullOrEmpty(user.TemporaryPassword))
            {
                user.TemporaryPassword = null;
            }
            await _context.SaveChangesAsync();

            return Ok(new { 
                status = true, 
                message = "Password reset successfully. Please login with your new password."
            });
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.CurrentPassword) || 
                string.IsNullOrWhiteSpace(model.NewPassword))
                return BadRequest(new { status = false, message = "Current password and new password are required" });

            if (model.NewPassword.Length < 6)
                return BadRequest(new { status = false, message = "Password must be at least 6 characters long" });

            // Get current user from JWT token
            var email = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { status = false, message = "User not authenticated" });

            var emailNormalized = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            // Verify current password
            var verify = _passwordHasher.VerifyHashedPassword(user, user.Password, model.CurrentPassword);
            if (verify == PasswordVerificationResult.Failed)
                return BadRequest(new { status = false, message = "Current password is incorrect" });

            // Hash new password
            var tempUser = new User
            {
                Email = emailNormalized,
                Role = user.Role,
                Password = string.Empty
            };
            var hashedNewPassword = _passwordHasher.HashPassword(tempUser, model.NewPassword);

            // Update password
            user.Password = hashedNewPassword;
            await _context.SaveChangesAsync();

            return Ok(new { 
                status = true, 
                message = "Password changed successfully"
            });
        }

        public class ChangePasswordRequest
        {
            public string CurrentPassword { get; set; }
            public string NewPassword { get; set; }
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest model)
        {
            if (model == null)
                return BadRequest(new { status = false, message = "Invalid data" });

            var email = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { status = false, message = "User not authenticated" });

            var emailNormalized = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);
            
            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            user.Name = model.Name;
            await _context.SaveChangesAsync();

            return Ok(new { status = true, message = "Profile updated successfully", name = user.Name });
        }

        [HttpPost("upload-profile-picture")]
        [Authorize]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadProfilePicture(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { status = false, message = "No file uploaded" });

            if (file.Length > 2 * 1024 * 1024)
                return BadRequest(new { status = false, message = "File size exceeds 2MB limit" });

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg" };
            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest(new { status = false, message = "Only JPEG and PNG images are allowed" });

            var email = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { status = false, message = "User not authenticated" });

            var emailNormalized = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);

            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            try
            {
                string blobUrl = await _blobService.UploadAsync(file, "users");
                user.ProfilePictureUrl = blobUrl;
                await _context.SaveChangesAsync();
                return Ok(new { status = true, message = "Profile picture updated successfully", url = blobUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = false, message = $"Failed to upload: {ex.Message}" });
            }
        }

        [HttpDelete("delete-profile-picture")]
        [Authorize]
        public async Task<IActionResult> DeleteProfilePicture()
        {
            var email = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { status = false, message = "User not authenticated" });

            var emailNormalized = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);

            if (user == null)
                return NotFound(new { status = false, message = "User not found" });

            user.ProfilePictureUrl = null;
            await _context.SaveChangesAsync();
            return Ok(new { status = true, message = "Profile picture deleted successfully" });
        }
    }
}

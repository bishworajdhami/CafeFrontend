using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using System;
using System.Text; // For StringBuilder
using System.Threading.Tasks;
using Microsoft.CSharp.RuntimeBinder; // For dynamic support explicit if needed

namespace cafeSystem.Services
{
    public interface IEmailService
    {
        Task SendOTPEmailAsync(string toEmail, string otp);
        Task SendTemporaryPasswordEmailAsync(string toEmail, string temporaryPassword, string role);
        Task SendPasswordResetOTPEmailAsync(string toEmail, string otp);
        Task SendCashClosingReportAsync(string toEmail, dynamic reportData);
        Task SendStockAlertAsync(string toEmail, string subject, string body);
    }

    public class EmailService : IEmailService
    {
        private readonly string _smtpServer;
        private readonly int _smtpPort;
        private readonly string _senderEmail;
        private readonly string _senderPassword;

        private readonly bool _skipEmailSending;

        public EmailService(IConfiguration configuration)
        {
            // Try to read from configuration first, fallback to hardcoded values
            _smtpServer = configuration["EmailSettings:SmtpServer"] ?? "smtp.gmail.com";
            _smtpPort = int.Parse(configuration["EmailSettings:SmtpPort"] ?? "587");
            _senderEmail = configuration["EmailSettings:SenderEmail"] ?? "systemcafe03@gmail.com";
            _senderPassword = configuration["EmailSettings:SenderPassword"] ?? "2025C@fesystem";
            
            // Development mode: Skip actual email sending and just log OTP to console
            // Set "EmailSettings:SkipSending" to "true" in appsettings.json to enable
            _skipEmailSending = bool.Parse(configuration["EmailSettings:SkipSending"] ?? "true");
        }

        public async Task SendOTPEmailAsync(string toEmail, string otp)
        {
            // Development mode: Skip email sending and just log OTP to console
            if (_skipEmailSending)
            {
                Console.WriteLine("========================================");
                Console.WriteLine("📧 EMAIL VERIFICATION (DEVELOPMENT MODE)");
                Console.WriteLine("========================================");
                Console.WriteLine($"To: {toEmail}");
                Console.WriteLine($"OTP Code: {otp}");
                Console.WriteLine($"Expires in: 10 minutes");
                Console.WriteLine("========================================");
                Console.WriteLine("NOTE: Email sending is disabled in development mode.");
                Console.WriteLine("Use the OTP code shown above to verify your email.");
                Console.WriteLine("========================================");
                await Task.CompletedTask; // Return completed task
                return;
            }

            // Production mode: Actually send email
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cafe System", _senderEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Email Verification - OTP Code";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <html>
                        <body style='font-family: Arial, sans-serif; padding: 20px;'>
                            <h2 style='color: #2563eb;'>Email Verification</h2>
                            <p>Thank you for registering with Cafe System!</p>
                            <p>Your One-Time Password (OTP) for email verification is:</p>
                            <div style='background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;'>
                                <h1 style='color: #2563eb; font-size: 32px; letter-spacing: 5px; margin: 0;'>{otp}</h1>
                            </div>
                            <p>This OTP will expire in 10 minutes.</p>
                            <p>If you did not request this verification, please ignore this email.</p>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;' />
                            <p style='color: #6b7280; font-size: 12px;'>This is an automated message. Please do not reply.</p>
                        </body>
                        </html>",
                    TextBody = $"Your OTP for email verification is: {otp}. This OTP will expire in 10 minutes."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using (var client = new SmtpClient())
                {
                    // Set timeout to avoid hanging
                    client.Timeout = 30000; // 30 seconds
                    
                    await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                    
                    // Authenticate with Gmail
                    // Note: Gmail requires App Password, not regular password
                    // Go to: https://myaccount.google.com/apppasswords
                    await client.AuthenticateAsync(_senderEmail, _senderPassword);
                    
                    await client.SendAsync(message);
                    await client.DisconnectAsync(true);
                }
            }
            catch (Exception ex)
            {
                // Log the full error details for debugging
                Console.WriteLine($"=== EMAIL SEND ERROR ===");
                Console.WriteLine($"Type: {ex.GetType().Name}");
                Console.WriteLine($"Message: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner Exception: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                }
                Console.WriteLine($"========================");
                
                // Provide more specific error message
                var errorMessage = "Failed to send verification email. ";
                var exMessage = ex.Message.ToLower();
                
                if (exMessage.Contains("authentication") || exMessage.Contains("535") || exMessage.Contains("534") || 
                    exMessage.Contains("invalid") || exMessage.Contains("username") || exMessage.Contains("password"))
                {
                    errorMessage += "Gmail authentication failed. You need to use a Gmail App Password instead of your regular password. " +
                                   "Steps: 1) Enable 2-Step Verification on your Google account, " +
                                   "2) Go to https://myaccount.google.com/apppasswords, " +
                                   "3) Generate an App Password for 'Mail', " +
                                   "4) Update the _senderPassword in EmailService.cs with the 16-character App Password.";
                }
                else if (exMessage.Contains("timeout") || exMessage.Contains("connection") || exMessage.Contains("network"))
                {
                    errorMessage += "Connection to email server failed. Please check your internet connection and firewall settings.";
                }
                else if (exMessage.Contains("ssl") || exMessage.Contains("tls") || exMessage.Contains("certificate"))
                {
                    errorMessage += "SSL/TLS connection error. Please check network security settings.";
                }
                else
                {
                    errorMessage += $"Error: {ex.Message}";
                }
                
                throw new Exception(errorMessage);
            }
        }

        public async Task SendTemporaryPasswordEmailAsync(string toEmail, string temporaryPassword, string role)
        {
            // Development mode: Skip email sending and just log to console
            if (_skipEmailSending)
            {
                Console.WriteLine("========================================");
                Console.WriteLine("📧 TEMPORARY PASSWORD (DEVELOPMENT MODE)");
                Console.WriteLine("========================================");
                Console.WriteLine($"To: {toEmail}");
                Console.WriteLine($"Role: {role}");
                Console.WriteLine($"Temporary Password: {temporaryPassword}");
                Console.WriteLine("========================================");
                Console.WriteLine("NOTE: Email sending is disabled in development mode.");
                Console.WriteLine("Use the temporary password shown above for first login.");
                Console.WriteLine("========================================");
                await Task.CompletedTask;
                return;
            }

            // Production mode: Actually send email
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cafe System", _senderEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = $"Welcome to Cafe System - Your {role} Account";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <html>
                        <body style='font-family: Arial, sans-serif; padding: 20px;'>
                            <h2 style='color: #2563eb;'>Welcome to Cafe System!</h2>
                            <p>Your {role} account has been created successfully.</p>
                            <p><strong>Your temporary login credentials are:</strong></p>
                            <div style='background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                                <p style='margin: 10px 0;'><strong>Email:</strong> {toEmail}</p>
                                <p style='margin: 10px 0;'><strong>Temporary Password:</strong></p>
                                <div style='background-color: #ffffff; padding: 15px; border-radius: 6px; text-align: center; margin: 10px 0; border: 2px solid #2563eb;'>
                                    <span style='color: #2563eb; font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;'>{temporaryPassword}</span>
                                </div>
                            </div>
                            <div style='background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;'>
                                <p style='margin: 0; color: #92400e;'><strong>⚠️ Important:</strong></p>
                                <ul style='margin: 10px 0; padding-left: 20px; color: #92400e;'>
                                    <li>Use these credentials to log in for the first time</li>
                                    <li>You will be asked to verify your email with an OTP code</li>
                                    <li>After verification, you must set a new password</li>
                                    <li>This temporary password will no longer work after you set your new password</li>
                                </ul>
                            </div>
                            <p style='margin-top: 20px;'>If you did not expect this email, please contact your manager.</p>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;' />
                            <p style='color: #6b7280; font-size: 12px;'>This is an automated message. Please do not reply.</p>
                        </body>
                        </html>",
                    TextBody = $@"Welcome to Cafe System!

Your {role} account has been created.

Your temporary login credentials:
Email: {toEmail}
Temporary Password: {temporaryPassword}

IMPORTANT:
- Use these credentials to log in for the first time
- You will be asked to verify your email with an OTP code
- After verification, you must set a new password
- This temporary password will no longer work after you set your new password

If you did not expect this email, please contact your manager."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using (var client = new SmtpClient())
                {
                    client.Timeout = 30000;
                    await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                    await client.AuthenticateAsync(_senderEmail, _senderPassword);
                    await client.SendAsync(message);
                    await client.DisconnectAsync(true);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== TEMP PASSWORD EMAIL ERROR ===");
                Console.WriteLine($"Type: {ex.GetType().Name}");
                Console.WriteLine($"Message: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner Exception: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                }
                Console.WriteLine($"================================");
                throw new Exception($"Failed to send temporary password email: {ex.Message}");
            }
        }

        public async Task SendPasswordResetOTPEmailAsync(string toEmail, string otp)
        {
            // Development mode: Skip email sending and just log to console
            if (_skipEmailSending)
            {
                Console.WriteLine("========================================");
                Console.WriteLine("📧 PASSWORD RESET OTP (DEVELOPMENT MODE)");
                Console.WriteLine("========================================");
                Console.WriteLine($"To: {toEmail}");
                Console.WriteLine($"OTP Code: {otp}");
                Console.WriteLine($"Expires in: 10 minutes");
                Console.WriteLine("========================================");
                Console.WriteLine("NOTE: Email sending is disabled in development mode.");
                Console.WriteLine("Use the OTP code shown above to reset your password.");
                Console.WriteLine("========================================");
                await Task.CompletedTask;
                return;
            }

            // Production mode: Actually send email
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cafe System", _senderEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Password Reset - OTP Code";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <html>
                        <body style='font-family: Arial, sans-serif; padding: 20px;'>
                            <h2 style='color: #dc2626;'>Password Reset Request</h2>
                            <p>You have requested to reset your password for your Cafe System account.</p>
                            <p>Your One-Time Password (OTP) for password reset is:</p>
                            <div style='background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;'>
                                <h1 style='color: #dc2626; font-size: 32px; letter-spacing: 5px; margin: 0;'>{otp}</h1>
                            </div>
                            <p>This OTP will expire in 10 minutes.</p>
                            <div style='background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;'>
                                <p style='margin: 0; color: #92400e;'><strong>⚠️ Security Notice:</strong></p>
                                <p style='margin: 5px 0 0 0; color: #92400e;'>If you did not request this password reset, please ignore this email. Your account remains secure.</p>
                            </div>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;' />
                            <p style='color: #6b7280; font-size: 12px;'>This is an automated message. Please do not reply.</p>
                        </body>
                        </html>",
                    TextBody = $"Your OTP for password reset is: {otp}. This OTP will expire in 10 minutes. If you did not request this, please ignore this email."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using (var client = new SmtpClient())
                {
                    client.Timeout = 30000;
                    await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                    await client.AuthenticateAsync(_senderEmail, _senderPassword);
                    await client.SendAsync(message);
                    await client.DisconnectAsync(true);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== PASSWORD RESET EMAIL ERROR ===");
                Console.WriteLine($"Type: {ex.GetType().Name}");
                Console.WriteLine($"Message: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner Exception: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                }
                Console.WriteLine($"================================");
                throw new Exception($"Failed to send password reset email: {ex.Message}");
            }
        }
        
        public async Task SendStockAlertAsync(string toEmail, string subject, string body)
        {
            if (_skipEmailSending)
            {
                Console.WriteLine("=== STOCK ALERT EMAIL (DEV) ===");
                Console.WriteLine($"To: {toEmail}");
                Console.WriteLine($"Subject: {subject}");
                Console.WriteLine(body);
                Console.WriteLine("================================");
                return;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cafe System", _senderEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder
                {
                    TextBody = body,
                    HtmlBody = $"<html><body style='font-family:Arial,sans-serif;padding:20px;'><pre style='font-size:14px;'>{body}</pre></body></html>"
                };
                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.Timeout = 30000;
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_senderEmail, _senderPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Stock alert email failed: {ex.Message}");
                // Don't throw — a failed alert shouldn't crash the background job
            }
        }

        public async Task SendCashClosingReportAsync(string toEmail, dynamic reportData)
        {
            if (_skipEmailSending)
            {
                Console.WriteLine("=== CASH CLOSING REPORT EMAIL (DEV) ===");
                Console.WriteLine($"To: {toEmail}");
                Console.WriteLine("Report Data Sent (Suppressed)");
                return;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cafe System", _senderEmail));
                message.To.Add(new MailboxAddress("Manager", toEmail));
                
                // Safe casting from dynamic
                DateTime date = (DateTime)reportData.Date;
                decimal totalSales = (decimal)reportData.TotalSales;
                int totalOrders = (int)reportData.TotalOrders;
                decimal cashInDrawer = (decimal)reportData.CashInDrawer;
                decimal cashSales = (decimal)reportData.CashSales;
                decimal cardSales = (decimal)reportData.CardSales;
                decimal mobileSales = (decimal)reportData.MobileSales;
                string notes = (string)reportData.Notes;
                
                // New fields
                decimal openingCash = (decimal)reportData.OpeningCash;
                decimal cashExpenses = (decimal)reportData.CashExpenses;
                decimal expectedCash = (decimal)reportData.ExpectedCash;
                decimal difference = (decimal)reportData.Difference;

                string differenceColor = difference == 0 ? "#15803d" : (difference > 0 ? "#f59e0b" : "#dc2626");
                string differenceLabel = difference == 0 ? "Perfect Match" : (difference > 0 ? "Overage" : "Shortage");

                var sb = new StringBuilder();
                sb.AppendLine("<html>");
                sb.AppendLine("<body style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>");
                
                sb.AppendLine("<h2 style='color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;'>Daily Cash Closing Report</h2>");
                sb.AppendLine($"<p><strong>Date:</strong> {date:yyyy-MM-dd}</p>");
                sb.AppendLine($"<p><strong>Submitted By:</strong> {reportData.SubmittedBy}</p>");
                
                // Summary Section
                sb.AppendLine("<div style='background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;'>");
                sb.AppendLine("<h3 style='margin-top:0;'>Summary</h3>");
                sb.AppendLine("<table style='width: 100%; border-collapse: collapse;'>");
                
                sb.AppendLine("<tr><td style='padding: 8px 0;'>Total Sales:</td>");
                sb.AppendLine($"<td style='text-align: right; font-weight: bold;'>NRP {totalSales:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 8px 0;'>Total Orders:</td>");
                sb.AppendLine($"<td style='text-align: right; font-weight: bold;'>{totalOrders}</td></tr>");
                
                sb.AppendLine("</table></div>");

                // Payment Breakdown
                sb.AppendLine("<div style='margin: 20px 0;'>");
                sb.AppendLine("<h3>Payment Breakdown</h3>");
                sb.AppendLine("<table style='width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;'>");
                sb.AppendLine("<tr style='background: #f1f5f9;'><th style='padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;'>Method</th><th style='padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;'>Amount</th></tr>");
                
                sb.AppendLine("<tr><td style='padding: 10px; border-bottom: 1px solid #e2e8f0;'>Cash</td>");
                sb.AppendLine($"<td style='padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;'>NRP {cashSales:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 10px; border-bottom: 1px solid #e2e8f0;'>Card</td>");
                sb.AppendLine($"<td style='padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;'>NRP {cardSales:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 10px; border-bottom: 1px solid #e2e8f0;'>Mobile/Digital</td>");
                sb.AppendLine($"<td style='padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;'>NRP {mobileSales:N2}</td></tr>");
                
                sb.AppendLine("</table></div>");

                // Cash Reconciliation
                sb.AppendLine("<div style='background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin: 20px 0;'>");
                sb.AppendLine("<h3 style='color: #15803d; margin-top:0;'>Cash Reconciliation</h3>");
                sb.AppendLine("<table style='width: 100%; border-collapse: collapse;'>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0;'>Opening Balance:</td>");
                sb.AppendLine($"<td style='text-align: right;'>NRP {openingCash:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0;'>+ Cash Sales:</td>");
                sb.AppendLine($"<td style='text-align: right;'>NRP {cashSales:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0;'>- Expenses / Paid Outs:</td>");
                sb.AppendLine($"<td style='text-align: right; color: #b91c1c;'>NRP {cashExpenses:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0; border-top: 1px solid #bbf7d0;'><strong>= Expected Cash:</strong></td>");
                sb.AppendLine($"<td style='text-align: right; border-top: 1px solid #bbf7d0; font-weight: bold;'>NRP {expectedCash:N2}</td></tr>");
                
                sb.AppendLine("<tr><td colspan='2' style='height: 10px;'></td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0;'><strong>Actual Cash in Drawer:</strong></td>");
                sb.AppendLine($"<td style='text-align: right; font-weight: bold; font-size: 1.1em;'>NRP {cashInDrawer:N2}</td></tr>");
                
                sb.AppendLine("<tr><td style='padding: 5px 0; border-top: 1px dashed #bbf7d0;'>Difference:</td>");
                sb.AppendLine($"<td style='text-align: right; border-top: 1px dashed #bbf7d0; color: {differenceColor}; font-weight: bold;'>NRP {difference:N2} ({differenceLabel})</td></tr>");
                
                sb.AppendLine("</table></div>");
                
                // Notes
                if (!string.IsNullOrEmpty(notes))
                {
                    sb.AppendLine("<div style='margin: 20px 0; padding: 15px; background: #fff7ed; border-left: 4px solid #f97316;'>");
                    sb.AppendLine("<strong>Notes:</strong><br/>");
                    sb.AppendLine($"<p style='margin: 5px 0 0 0; font-style: italic;'>{notes}</p>");
                    sb.AppendLine("</div>");
                }

                sb.AppendLine("<p style='color: #6b7280; font-size: 12px; margin-top: 40px;'>This report was automatically generated upon cashier submission.</p>");
                sb.AppendLine("</body></html>");

                message.Subject = $"Daily Cash Closing Report - {date:yyyy-MM-dd}";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = sb.ToString(),
                    TextBody = $"Daily Cash Report {date:yyyy-MM-dd}\nTotal Sales: NRP {totalSales:N2}\n\nActual Cash: NRP {cashInDrawer:N2}"
                };

                message.Body = bodyBuilder.ToMessageBody();

                using (var client = new SmtpClient())
                {
                    client.Timeout = 30000;
                    await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                    await client.AuthenticateAsync(_senderEmail, _senderPassword);
                    await client.SendAsync(message);
                    await client.DisconnectAsync(true);
                }
            }
            catch (Exception ex)
            {
                 Console.WriteLine($"Error sending report email: {ex.Message}");
                 // Don't throw, just log. We don't want to fail the closing because email failed.
            }
        }
    }
}

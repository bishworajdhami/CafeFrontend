using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using cafeSystem.Data;
using cafeSystem.Models;

var config = new ConfigurationBuilder().AddJsonFile("appsettings.json").Build();
var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer(config.GetConnectionString("DefaultConnection")).Options;
var db = new ApplicationDbContext(options);

var NepalTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Nepal Standard Time");
var targetDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NepalTimeZone).Date;

Console.WriteLine($"Target Date: {targetDate:yyyy-MM-dd}");

var lastClosing = db.CashClosings
    .Where(c => c.Date < targetDate)
    .OrderByDescending(c => c.Date)
    .FirstOrDefault();

decimal baseBalance;
DateTime adjustmentsAfter;

if (lastClosing != null)
{
    baseBalance = lastClosing.CashInDrawer;
    adjustmentsAfter = lastClosing.ClosedAt != DateTime.MinValue
        ? lastClosing.ClosedAt
        : lastClosing.Date.AddHours(23).AddMinutes(59);
    Console.WriteLine($"Last Closing found: {lastClosing.Date:yyyy-MM-dd}, CashInDrawer: {baseBalance}, ClosedAt: {adjustmentsAfter:yyyy-MM-dd HH:mm:ss}");
}
else
{
    var setting = db.Settings.FirstOrDefault(s => s.Key == "CashDrawerOpeningBalance");
    baseBalance = 200m;
    if (setting != null)
        decimal.TryParse(setting.Value, out baseBalance);

    adjustmentsAfter = DateTime.MinValue;
    Console.WriteLine($"No last closing found. Using setting base: {baseBalance}");
}

var adjustmentSum = db.OpeningBalanceAdjustments
    .Where(a => a.CreatedAt > adjustmentsAfter && a.CreatedAt < targetDate.AddDays(1))
    .Sum(a => (decimal?)a.Amount) ?? 0m;

Console.WriteLine($"Adjustments Sum: {adjustmentSum}");
Console.WriteLine($"Final Opening Balance: {baseBalance + adjustmentSum}");

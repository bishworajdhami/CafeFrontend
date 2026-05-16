using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;


namespace cafeSystem.Services
{
    /// <summary>
    /// Nightly background job. Runs at the configured UTC hour to:
    /// 1. Mark expired batches as inactive ("Expired" transactions)
    /// 2. Deduct daily usage from all products with DailyUsageRate > 0
    /// 3. Send email alerts for products that newly crossed their reorder threshold
    /// On startup: applies catch-up for any missed days.
    /// </summary>
    public class StockAutoDeductionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<StockAutoDeductionService> _logger;
        private readonly int _runAtHour;
        private readonly string? _alertEmail;

        public StockAutoDeductionService(
            IServiceScopeFactory scopeFactory,
            ILogger<StockAutoDeductionService> logger,
            IConfiguration configuration)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _runAtHour = configuration.GetValue<int>("StockAutoDeduction:RunAtHour", 23);
            _alertEmail = configuration.GetValue<string?>("StockAutoDeduction:AlertEmail", null);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("StockAutoDeductionService started. Runs daily at {Hour}:00 UTC.", _runAtHour);

            // Run on startup — catches up any missed days AND expires stale batches
            await RunNightlyJobAsync("startup");

            while (!stoppingToken.IsCancellationRequested)
            {
                var nextRun = GetNextRunTime();
                var delay = nextRun - DateTime.UtcNow;
                if (delay > TimeSpan.Zero)
                    await Task.Delay(delay, stoppingToken);

                if (!stoppingToken.IsCancellationRequested)
                    await RunNightlyJobAsync("scheduled");
            }
        }

        private async Task RunNightlyJobAsync(string trigger)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var stockService = scope.ServiceProvider.GetRequiredService<StockService>();

                // Step 1: expire stale batches FIRST (so they don't count toward daily deduction)
                await stockService.ExpireStaleBatchesAsync();
                _logger.LogInformation("Expired stale batches ({Trigger}).", trigger);

                // Step 2: apply daily usage deductions
                var breachedProducts = await stockService.ApplyDailyUsageAsync();
                _logger.LogInformation("Daily usage applied ({Trigger}). {Count} product(s) newly below reorder threshold.", trigger, breachedProducts.Count);

                // Step 3: send email alerts for newly breached products
                if (breachedProducts.Count > 0 && !string.IsNullOrEmpty(_alertEmail))
                {
                    var emailService = scope.ServiceProvider.GetService<IEmailService>();
                    if (emailService != null)
                    {
                        var body = "The following products need reordering:\n\n" +
                            string.Join("\n", breachedProducts.Select(p =>
                                $"- {p.Name}: {p.CurrentStock} {p.Unit} remaining (~{p.DaysRemaining?.ToString("F1") ?? "?"} days)"));

                        await emailService.SendStockAlertAsync(
                            _alertEmail,
                            "⚠ Stock Reorder Alert",
                            body);

                        _logger.LogInformation("Reorder alert sent to {Email}.", _alertEmail);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Nightly stock job failed ({Trigger}).", trigger);
            }
        }

        private DateTime GetNextRunTime()
        {
            var now = DateTime.UtcNow;
            var todayRun = new DateTime(now.Year, now.Month, now.Day, _runAtHour, 0, 0, DateTimeKind.Utc);
            return now < todayRun ? todayRun : todayRun.AddDays(1);
        }
    }
}

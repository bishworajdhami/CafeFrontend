using Microsoft.AspNetCore.SignalR;

namespace cafeSystem.Hubs
{
    /// <summary>
    /// SignalR hub that broadcasts real-time order/payment events to all connected clients.
    /// Frontend listens for: "OrderUpdated", "NewOrder", "PaymentUpdate"
    /// </summary>
    public class OrderHub : Hub
    {
        // Clients subscribe automatically on connection — no explicit methods needed
        // because the server pushes from IHubContext<OrderHub> in controllers.

        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}

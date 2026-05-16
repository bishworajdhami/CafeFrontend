using System.Security.Claims;
using System.Linq;

namespace cafeSystem.Helpers
{
    public static class ClaimsPrincipalExtensions
    {
        public static bool HasPermission(this ClaimsPrincipal user, string permission)
        {
            if (user == null) return false;

            // Managers inherently have all permissions for their modules
            if (user.IsInRole("Manager")) return true;

            // Check if the user has the exact permission in their claims
            return user.Claims.Any(c => c.Type == "Permissions" && c.Value == permission);
        }
    }
}

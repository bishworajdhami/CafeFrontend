using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace cafeSystem.Services;

public class BlobStorageService
{
    private readonly BlobContainerClient _containerClient;

    public BlobStorageService(IConfiguration configuration)
    {
        var connectionString = configuration["AzureStorage:ConnectionString"];
        var containerName = configuration["AzureStorage:ContainerName"];

        if (string.IsNullOrWhiteSpace(connectionString) || connectionString == "YOUR_AZURE_STORAGE_CONNECTION_STRING")
        {
            throw new InvalidOperationException("🚨 ACTION REQUIRED: Please replace 'YOUR_AZURE_STORAGE_CONNECTION_STRING' in appsettings.json with your actual Azure Blob Storage connection string.");
        }

        if (string.IsNullOrWhiteSpace(containerName) || containerName == "cafe-images")
        {
            // Just optionally validate if you need to, but it's fine if container is cafe-images.
            if (string.IsNullOrWhiteSpace(containerName))
               throw new InvalidOperationException("Azure Storage container name is not configured.");
        }

        var blobServiceClient = new BlobServiceClient(connectionString);
        _containerClient = blobServiceClient.GetBlobContainerClient(containerName);

        // Ensure container exists with public blob access
        try
        {
            _containerClient.CreateIfNotExists(PublicAccessType.Blob);
        }
        catch (Azure.RequestFailedException ex) when (ex.ErrorCode == "PublicAccessNotPermitted")
        {
            throw new InvalidOperationException(
                "🚨 AZURE PORTAL FIX REQUIRED: Your Azure Storage Account is blocking public access. " +
                "To fix this: 1) Go to Azure Portal -> your Storage Account. 2) Click 'Configuration' on the left menu. " +
                "3) Set 'Allow Blob public access' to 'Enabled'. 4) Click Save. Then restart this app.", ex);
        }
    }

    /// <summary>
    /// Uploads an IFormFile to Azure Blob Storage under a given folder prefix.
    /// Returns the full public URL of the uploaded blob.
    /// </summary>
    public async Task<string> UploadAsync(IFormFile file, string folderPrefix)
    {
        var fileExtension = Path.GetExtension(file.FileName);
        var blobName = $"{folderPrefix}/{Guid.NewGuid()}{fileExtension}";

        var blobClient = _containerClient.GetBlobClient(blobName);

        var blobHttpHeaders = new BlobHttpHeaders
        {
            ContentType = file.ContentType
        };

        using var stream = file.OpenReadStream();
        await blobClient.UploadAsync(stream, new BlobUploadOptions
        {
            HttpHeaders = blobHttpHeaders
        });

        return blobClient.Uri.ToString();
    }

    /// <summary>
    /// Deletes a blob by its full URL (best effort - ignores 404s).
    /// </summary>
    public async Task DeleteAsync(string blobUrl)
    {
        if (string.IsNullOrWhiteSpace(blobUrl)) return;

        try
        {
            var uri = new Uri(blobUrl);
            var blobName = string.Join("", uri.Segments.Skip(2)); // skip / and container/
            var blobClient = _containerClient.GetBlobClient(blobName);
            await blobClient.DeleteIfExistsAsync();
        }
        catch
        {
            // Best effort — don't fail the request if cleanup fails
        }
    }
}

using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace cafeSystem.Services;

public class BlobStorageService
{
    private readonly BlobContainerClient? _containerClient;
    private readonly IWebHostEnvironment _env;

    public BlobStorageService(IConfiguration configuration, IWebHostEnvironment env)
    {
        _env = env;
        var connectionString = configuration["AzureStorage:ConnectionString"];
        var containerName = configuration["AzureStorage:ContainerName"];

        if (string.IsNullOrWhiteSpace(connectionString) || connectionString == "YOUR_AZURE_STORAGE_CONNECTION_STRING" || string.IsNullOrWhiteSpace(containerName) || containerName == "YOUR_CONTAINER_NAME")
        {
            Console.WriteLine("⚠️ WARNING: Azure Storage is not configured. Falling back to local disk storage (wwwroot/images).");
            _containerClient = null;
            return;
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
        var fileName = $"{Guid.NewGuid()}{fileExtension}";

        if (_containerClient == null)
        {
            // Fallback to local wwwroot/images folder
            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsFolder = Path.Combine(webRoot, "images", folderPrefix);
            Directory.CreateDirectory(uploadsFolder);
            
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }
            
            return $"/images/{folderPrefix}/{fileName}";
        }

        var blobName = $"{folderPrefix}/{fileName}";

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

        if (_containerClient == null)
        {
            // Delete from local filesystem
            try 
            {
                if (blobUrl.StartsWith("/images/"))
                {
                    var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    var localPath = Path.Combine(webRoot, blobUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                    if (File.Exists(localPath))
                    {
                        File.Delete(localPath);
                    }
                }
            }
            catch { }
            return;
        }

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

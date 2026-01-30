import * as S3 from "@aws-sdk/client-s3";

const s3Client = new S3.S3Client({
  endpoint: `http://${process.env.S3_ENDPOINT || "localhost"}:${process.env.S3_PORT || "9000"}`,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "mobifaktura_s3_internal",
    secretAccessKey: process.env.S3_SECRET_KEY || "mobifaktura_s3_secret_key_2026",
  },
  forcePathStyle: true,
  tls: process.env.S3_USE_SSL === "true",
});

const BUCKET_NAME = process.env.S3_BUCKET || "invoices";

// Ensure bucket exists
async function ensureBucket(): Promise<void> {
  try {
    await s3Client.send(new S3.HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (error) {
    // Bucket doesn't exist, create it
    await s3Client.send(new S3.CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

// Upload file to S3
export async function uploadFile(
  buffer: Buffer,
  objectName: string,
  contentType: string
): Promise<string> {
  await ensureBucket();
  
  const command = new S3.PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectName,
    Body: buffer,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  return objectName;
}

// Note: Presigned URLs were intentionally removed in favor of the authenticated proxy at /api/image
// If existing code still calls this, use `getSecureImageUrl()` (returns `/api/image?key=...`) instead.

// Get secure image URL through authenticated proxy
export function getSecureImageUrl(objectName: string): string {
  // Use relative URL for same-origin requests (works in both dev and prod)
  return `/api/image?key=${encodeURIComponent(objectName)}`;
}

// Get file from S3 (for server-side use)
export async function getFile(objectName: string): Promise<Buffer> {
  const command = new S3.GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectName,
  });
  
  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error("File not found");
  }
  
  const chunks: Uint8Array[] = [];
  const stream = response.Body as any;
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

// Delete file from S3
export async function deleteFile(objectName: string): Promise<void> {
  const command = new S3.DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectName,
  });
  
  await s3Client.send(command);
}

// Get total storage usage in bytes
export async function getStorageUsage(): Promise<number> {
  await ensureBucket();
  let totalSize = 0;
  let fileCount = 0;
  
  const command = new S3.ListObjectsV2Command({
    Bucket: BUCKET_NAME,
  });
  
  try {
    let isTruncated = true;
    let continuationToken: string | undefined;
    
    while (isTruncated) {
      const response = await s3Client.send(
        new S3.ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          ContinuationToken: continuationToken,
        })
      );
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Size) {
            totalSize += obj.Size;
            fileCount++;
          }
        }
      }
      
      isTruncated = response.IsTruncated ?? false;
      continuationToken = response.NextContinuationToken;
    }
    
    console.log(`[Storage] Found ${fileCount} files, total size: ${totalSize} bytes (${(totalSize / 1024 / 1024 / 1024).toFixed(3)} GB)`);
  } catch (error) {
    console.error("Error getting storage usage:", error);
    throw error;
  }
  
  return totalSize;
}

export { s3Client, BUCKET_NAME };

import * as Minio from "minio";

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "",
  secretKey: process.env.MINIO_SECRET_KEY || "",
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "invoices";

// Ensure bucket exists
async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
  }
}

// Upload file to MinIO
export async function uploadFile(
  buffer: Buffer,
  objectName: string,
  contentType: string
): Promise<string> {
  await ensureBucket();
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return objectName;
}

// Get presigned URL for viewing (valid for 1 hour)
export async function getPresignedUrl(objectName: string): Promise<string> {
  return minioClient.presignedGetObject(BUCKET_NAME, objectName, 3600);
}

// Delete file from MinIO
export async function deleteFile(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, objectName);
}

// Get total storage usage in bytes
export async function getStorageUsage(): Promise<number> {
  await ensureBucket();
  let totalSize = 0;
  
  return new Promise((resolve, reject) => {
    const stream = minioClient.listObjectsV2(BUCKET_NAME, '', true);
    
    stream.on('data', (obj) => {
      if (obj.size) {
        totalSize += obj.size;
      }
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
    
    stream.on('end', () => {
      resolve(totalSize);
    });
  });
}

export { minioClient, BUCKET_NAME };

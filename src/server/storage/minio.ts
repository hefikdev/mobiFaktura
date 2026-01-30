import * as Minio from "minio";
import { logStorage } from "@/lib/logger";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000");
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
// Fall back to either explicit MINIO_ACCESS_KEY / MINIO_SECRET_KEY or MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "mobifaktura_minio";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "mobifaktura_minio_secret";

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "invoices";

// Ensure bucket exists
async function ensureBucket(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      logStorage("create_bucket", BUCKET_NAME, undefined, { endpoint: `${MINIO_ENDPOINT}:${MINIO_PORT}` });
      await minioClient.makeBucket(BUCKET_NAME);
    }
  } catch (error) {
    logStorage("error", BUCKET_NAME, undefined, { message: (error as Error).message });
    throw new Error(`Failed to ensure MinIO bucket '${BUCKET_NAME}': ${(error as Error).message}`);
  }
}

// Upload file to MinIO
export async function uploadFile(
  buffer: Buffer,
  objectName: string,
  contentType: string
): Promise<string> {
  try {
    await ensureBucket();
    await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
      "Content-Type": contentType,
    });
    logStorage("upload", BUCKET_NAME, objectName);
    return objectName;
  } catch (error) {
    logStorage("error", BUCKET_NAME, objectName, { message: (error as Error).message });
    throw new Error(`Failed to upload object to MinIO: ${(error as Error).message}`);
  }
}

// Get presigned URL for viewing (valid for 1 hour)
export async function getPresignedUrl(objectName: string): Promise<string> {
  try {
    return minioClient.presignedGetObject(BUCKET_NAME, objectName, 3600);
  } catch (error) {
    logStorage("error", BUCKET_NAME, objectName, { message: (error as Error).message });
    throw new Error(`Failed to get presigned URL: ${(error as Error).message}`);
  }
}

// Delete file from MinIO
export async function deleteFile(objectName: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET_NAME, objectName);
    logStorage("delete", BUCKET_NAME, objectName);
  } catch (error) {
    logStorage("error", BUCKET_NAME, objectName, { message: (error as Error).message });
    throw new Error(`Failed to delete object from MinIO: ${(error as Error).message}`);
  }
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
      logStorage("error", BUCKET_NAME, undefined, { message: (err as Error).message });
      reject(err);
    });
    
    stream.on('end', () => {
      resolve(totalSize);
    });
  });
}

export { minioClient, BUCKET_NAME };

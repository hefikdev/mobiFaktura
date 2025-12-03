import "server-only";
import sharp from "sharp";

/**
 * Compress image to JPEG with 80% quality
 * Resizes images larger than 2000px width while maintaining aspect ratio
 * Skips compression for already small images (< 500KB) - just converts to JPEG
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const sizeKB = buffer.length / 1024;
  
  // If image is already small (< 500KB) and dimensions are reasonable (< 2000px)
  // Just convert to JPEG without quality reduction
  if (sizeKB < 500 && metadata.width && metadata.width <= 2000) {
    return await sharp(buffer)
      .jpeg({
        quality: 95, // Higher quality for small images
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();
  }
  
  // For larger images, apply compression
  return await sharp(buffer)
    .resize(2000, null, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Convert data URL (base64) to Buffer
 */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  // Remove data:image/...;base64, prefix
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

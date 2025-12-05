import "server-only";
import sharp from "sharp";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate and sanitize image data URL
 * Throws error if invalid format or suspicious content
 */
export function validateImageDataUrl(dataUrl: string): void {
  // Check if it's a valid data URL format
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image format - must be a data URL");
  }

  // Allow modern image formats including Apple formats (HEIC/HEIF), AVIF, and traditional formats
  const allowedTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
    "image/avif", "image/tiff", "image/bmp", "image/gif"
  ];
  const typeMatch = dataUrl.match(/^data:(image\/[a-z-]+);base64,/);
  
  if (!typeMatch || !allowedTypes.includes(typeMatch[1])) {
    throw new Error("Invalid image type - supported formats: JPEG, PNG, WebP, HEIC, HEIF, AVIF, TIFF, BMP, GIF");
  }

  // Extract base64 data
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  
  // Validate base64 format
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new Error("Invalid base64 encoding");
  }

  // Check file size
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large - maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (buffer.length < 100) {
    throw new Error("File too small - possible corrupted image");
  }
}

/**
 * Compress image to JPEG with 80% quality
 * Resizes images larger than 2000px width while maintaining aspect ratio
 * Skips compression for already small images (< 500KB) - just converts to JPEG
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  // Validate that the buffer is actually a valid image
  try {
    const metadata = await sharp(buffer).metadata();
    
    // Verify it's a supported image format
    // Sharp supports: jpeg, png, webp, gif, svg, tiff, avif, heif and more
    const supportedFormats = ["jpeg", "jpg", "png", "webp", "heic", "heif", "avif", "tiff", "bmp", "gif"];
    if (!metadata.format || !supportedFormats.includes(metadata.format)) {
      throw new Error("Unsupported image format");
    }

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
  } catch (error) {
    throw new Error("Invalid or corrupted image file");
  }
}

/**
 * Convert data URL (base64) to Buffer with validation
 */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  // Validate before processing
  validateImageDataUrl(dataUrl);
  
  // Remove data:image/...;base64, prefix
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

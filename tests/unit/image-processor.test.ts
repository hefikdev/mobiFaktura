import { describe, it, expect, vi } from 'vitest';

// Mock server-only to work in test environment
vi.mock('server-only', () => ({}));

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn(),
}));

import { validateImageDataUrl } from '@/server/storage/image-processor';

describe('Image Processor', () => {
  describe('validateImageDataUrl', () => {
    it('should accept valid JPEG data URL', () => {
      // Create a small valid JPEG data URL
      const validJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(200);
      
      expect(() => validateImageDataUrl(validJpeg)).not.toThrow();
    });

    it('should accept valid PNG data URL', () => {
      const validPng = 'data:image/png;base64,' + 'B'.repeat(200);
      
      expect(() => validateImageDataUrl(validPng)).not.toThrow();
    });

    it('should accept valid WebP data URL', () => {
      const validWebp = 'data:image/webp;base64,' + 'C'.repeat(200);
      
      expect(() => validateImageDataUrl(validWebp)).not.toThrow();
    });

    it('should accept valid HEIC data URL', () => {
      const validHeic = 'data:image/heic;base64,' + 'D'.repeat(200);
      
      expect(() => validateImageDataUrl(validHeic)).not.toThrow();
    });

    it('should accept valid HEIF data URL', () => {
      const validHeif = 'data:image/heif;base64,' + 'E'.repeat(200);
      
      expect(() => validateImageDataUrl(validHeif)).not.toThrow();
    });

    it('should accept valid AVIF data URL', () => {
      const validAvif = 'data:image/avif;base64,' + 'F'.repeat(200);
      
      expect(() => validateImageDataUrl(validAvif)).not.toThrow();
    });

    it('should reject non-image data URLs', () => {
      const invalidUrl = 'data:text/plain;base64,aGVsbG8=';
      
      expect(() => validateImageDataUrl(invalidUrl)).toThrow('Invalid image format');
    });

    it('should reject URLs without data prefix', () => {
      const invalidUrl = 'image/jpeg;base64,AAAA';
      
      expect(() => validateImageDataUrl(invalidUrl)).toThrow('Invalid image format');
    });

    it('should reject unsupported image types', () => {
      const invalidUrl = 'data:image/svg+xml;base64,' + 'A'.repeat(200);
      
      expect(() => validateImageDataUrl(invalidUrl)).toThrow('Invalid image type');
    });

    it('should reject invalid base64 encoding', () => {
      const invalidUrl = 'data:image/jpeg;base64,!!!invalid!!!';
      
      expect(() => validateImageDataUrl(invalidUrl)).toThrow('Invalid base64 encoding');
    });

    it('should reject files that are too small', () => {
      const tooSmall = 'data:image/jpeg;base64,AAA=';
      
      expect(() => validateImageDataUrl(tooSmall)).toThrow('File too small');
    });

    it('should reject files that are too large', () => {
      // Create a string larger than 10MB when decoded
      // Base64 encoding increases size by ~33%, so we need ~13.3MB of base64
      const largeBase64 = 'A'.repeat(14 * 1024 * 1024);
      const tooLarge = 'data:image/jpeg;base64,' + largeBase64;
      
      expect(() => validateImageDataUrl(tooLarge)).toThrow('File too large');
    });

    it('should handle JPEG with jpg extension', () => {
      const validJpg = 'data:image/jpg;base64,' + 'G'.repeat(200);
      
      expect(() => validateImageDataUrl(validJpg)).not.toThrow();
    });

    it('should accept TIFF images', () => {
      const validTiff = 'data:image/tiff;base64,' + 'H'.repeat(200);
      
      expect(() => validateImageDataUrl(validTiff)).not.toThrow();
    });

    it('should accept BMP images', () => {
      const validBmp = 'data:image/bmp;base64,' + 'I'.repeat(200);
      
      expect(() => validateImageDataUrl(validBmp)).not.toThrow();
    });

    it('should accept GIF images', () => {
      const validGif = 'data:image/gif;base64,' + 'J'.repeat(200);
      
      expect(() => validateImageDataUrl(validGif)).not.toThrow();
    });

    it('should reject empty data URL', () => {
      expect(() => validateImageDataUrl('')).toThrow();
    });

    it('should reject data URL without base64 data', () => {
      const invalidUrl = 'data:image/jpeg;base64,';
      
      expect(() => validateImageDataUrl(invalidUrl)).toThrow();
    });

    it('should handle maximum allowed file size', () => {
      // Create a file just under 10MB
      // Base64 expands by 4/3, so we need about 7.5MB of base64
      const maxSizeBase64 = 'A'.repeat(7.5 * 1024 * 1024);
      const maxSizeUrl = 'data:image/jpeg;base64,' + maxSizeBase64;
      
      expect(() => validateImageDataUrl(maxSizeUrl)).not.toThrow();
    });

    it('should validate base64 padding correctly', () => {
      const withPadding = 'data:image/jpeg;base64,' + 'ABC'.repeat(100) + '=';
      
      expect(() => validateImageDataUrl(withPadding)).not.toThrow();
    });

    it('should reject malformed MIME type', () => {
      const malformed = 'data:image;base64,' + 'A'.repeat(200);
      
      expect(() => validateImageDataUrl(malformed)).toThrow();
    });

    it('should handle base64 with slashes', () => {
      const withSlash = 'data:image/jpeg;base64,' + 'ABC/DEF+GHI'.repeat(30);
      
      expect(() => validateImageDataUrl(withSlash)).not.toThrow();
    });

    it('should reject XSS attempts in data URL', () => {
      const xssAttempt = 'data:image/jpeg;base64,<script>alert("xss")</script>';
      
      expect(() => validateImageDataUrl(xssAttempt)).toThrow('Invalid base64 encoding');
    });

    it('should reject null bytes in base64', () => {
      const withNull = 'data:image/jpeg;base64,ABC\0DEF' + 'A'.repeat(200);
      
      expect(() => validateImageDataUrl(withNull)).toThrow('Invalid base64 encoding');
    });

    it('should handle minimum valid file size', () => {
      const minSize = 'data:image/jpeg;base64,' + 'A'.repeat(140);
      
      expect(() => validateImageDataUrl(minSize)).not.toThrow();
    });
  });
});

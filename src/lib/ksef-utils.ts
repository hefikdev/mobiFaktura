/**
 * KSeF Utility Functions
 * Handles QR code parsing, KSeF number validation, and data extraction
 */

export interface KsefQRData {
  ksefNumber?: string;
  nip?: string;
  date?: string;
  hash?: string;
  url: string;
  type: 'invoice' | 'certificate' | 'unknown';
}

/**
 * Parse KSeF QR code data
 * Format: https://qr.ksef.mf.gov.pl/invoice/{NIP}/{DD-MM-YYYY}/{hash}
 * Format: https://qr-test.ksef.mf.gov.pl/invoice/{NIP}/{DD-MM-YYYY}/{hash}
 * Format: https://qr-demo.ksef.mf.gov.pl/invoice/{NIP}/{DD-MM-YYYY}/{hash}
 * 
 * @param qrText - The decoded QR code text
 * @returns Parsed QR data or null if invalid
 */
export function parseKsefQRCode(qrText: string): KsefQRData | null {
  if (!qrText) return null;

  try {
    const url = new URL(qrText);
    
    // Check if it's a KSeF QR code
    if (!url.hostname.includes('ksef.mf.gov.pl')) {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Parse invoice QR code: /invoice/{NIP}/{DD-MM-YYYY}/{hash}
    if (pathParts[0] === 'invoice' && pathParts.length === 4) {
      return {
        type: 'invoice',
        nip: pathParts[1],
        date: pathParts[2],
        hash: pathParts[3],
        url: qrText,
      };
    }

    // Parse certificate QR code: /certificate/{type}/{context}/{nip}/{serial}/{hash}/{signature}
    if (pathParts[0] === 'certificate') {
      return {
        type: 'certificate',
        url: qrText,
      };
    }

    return {
      type: 'unknown',
      url: qrText,
    };
  } catch (error) {
    console.error('Failed to parse QR code:', error);
    return null;
  }
}

/**
 * Extract KSeF number from invoice data fetched from KSeF API
 * The KSeF number is returned in the response headers or metadata
 * 
 * @param invoiceData - The invoice data from KSeF API
 * @returns KSeF number or null
 */
export function extractKsefNumber(invoiceData: unknown): string | null {
  // The KSeF number is typically in the ElementReferenceNumber field
  try {
    if (typeof invoiceData === 'object' && invoiceData !== null && 'Faktura' in invoiceData) {
      const data = invoiceData as {
        KsefReferenceNumber?: string;
        ElementReferenceNumber?: string;
        Faktura?: {
          KsefReferenceNumber?: string;
        };
      };
      // Try to find KSeF number in various possible locations
      const ksefNum = 
        data.KsefReferenceNumber ||
        data.ElementReferenceNumber ||
        data.Faktura?.KsefReferenceNumber;
      
      if (ksefNum && typeof ksefNum === 'string') {
        return ksefNum;
      }
    }
  } catch (error) {
    console.error('Failed to extract KSeF number:', error);
  }
  return null;
}

/**
 * Validate KSeF number format
 * KSeF numbers are 18-36 characters, alphanumeric with dashes
 * 
 * @param ksefNumber - The KSeF number to validate
 * @returns True if valid
 */
export function isValidKsefNumber(ksefNumber: string): boolean {
  if (!ksefNumber) return false;
  
  // KSeF number format: 18-36 characters, uppercase alphanumeric and dashes
  const ksefRegex = /^[A-Z0-9\-]{18,36}$/;
  return ksefRegex.test(ksefNumber);
}

/**
 * Format date from KSeF format (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 * 
 * @param ksefDate - Date in DD-MM-YYYY format
 * @returns ISO date string or null
 */
export function formatKsefDate(ksefDate: string): string | null {
  if (!ksefDate) return null;
  
  try {
    const parts = ksefDate.split('-');
    if (parts.length !== 3) return null;
    
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

/**
 * Get KSeF API base URL based on environment
 * 
 * @param environment - 'production', 'demo', or 'test'
 * @returns API base URL
 */
export function getKsefApiUrl(environment: 'production' | 'demo' | 'test' = 'production'): string {
  switch (environment) {
    case 'test':
      return 'https://api-test.ksef.mf.gov.pl';
    case 'demo':
      return 'https://api-demo.ksef.mf.gov.pl';
    case 'production':
    default:
      return 'https://api.ksef.mf.gov.pl';
  }
}

/**
 * Get QR verification URL based on environment
 * 
 * @param environment - 'production', 'demo', or 'test'
 * @returns QR base URL
 */
export function getKsefQrUrl(environment: 'production' | 'demo' | 'test' = 'production'): string {
  switch (environment) {
    case 'test':
      return 'https://qr-test.ksef.mf.gov.pl';
    case 'demo':
      return 'https://qr-demo.ksef.mf.gov.pl';
    case 'production':
    default:
      return 'https://qr.ksef.mf.gov.pl';
  }
}

/**
 * Detect KSeF environment from QR code URL
 * 
 * @param url - The QR code URL
 * @returns Environment type
 */
export function detectKsefEnvironment(url: string): 'production' | 'demo' | 'test' {
  if (url.includes('qr-test.ksef') || url.includes('api-test.ksef')) {
    return 'test';
  }
  if (url.includes('qr-demo.ksef') || url.includes('api-demo.ksef')) {
    return 'demo';
  }
  return 'production';
}

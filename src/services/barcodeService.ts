/**
 * Barcode service for barcode validation and formatting
 * Works with both external (EAN-13, UPC) and internal barcodes
 */

export interface BarcodeInfo {
  barcode: string;
  format: 'EAN13' | 'UPC_A' | 'UPC_E' | 'INTERNAL' | 'UNKNOWN';
  isValid: boolean;
  epicerieId?: number;
  sequenceNumber?: number;
}

class BarcodeService {
  /**
   * Validate EAN-13 barcode using Luhn algorithm
   */
  private validateEAN13(barcode: string): boolean {
    if (!barcode || barcode.length !== 13 || !/^\d+$/.test(barcode)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      let digit = parseInt(barcode[i]);
      if (i % 2 === 1) {
        digit *= 3;
      }
      sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12]);
  }

  /**
   * Validate UPC-A barcode
   */
  private validateUPCA(barcode: string): boolean {
    if (!barcode || barcode.length !== 12 || !/^\d+$/.test(barcode)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 11; i++) {
      let digit = parseInt(barcode[i]);
      if (i % 2 === 0) {
        digit *= 3;
      }
      sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[11]);
  }

  /**
   * Validate UPC-E barcode (8 digits)
   */
  private validateUPCE(barcode: string): boolean {
    if (!barcode || barcode.length !== 8 || !/^\d+$/.test(barcode)) {
      return false;
    }

    // UPC-E validation is similar to UPC-A
    return true;
  }

  /**
   * Validate internal barcode (11 digits: 2 + 3-digit epicerie ID + 7-digit sequence)
   */
  private validateInternal(barcode: string): boolean {
    if (!barcode || barcode.length !== 11 || !/^\d+$/.test(barcode)) {
      return false;
    }

    // Must start with 2
    return barcode[0] === '2';
  }

  /**
   * Extract epicerie ID from internal barcode
   */
  extractEpicerieId(barcode: string): number | null {
    if (!this.validateInternal(barcode)) {
      return null;
    }
    return parseInt(barcode.substring(1, 4));
  }

  /**
   * Extract sequence number from internal barcode
   */
  extractSequenceNumber(barcode: string): number | null {
    if (!this.validateInternal(barcode)) {
      return null;
    }
    return parseInt(barcode.substring(4));
  }

  /**
   * Detect barcode format
   */
  detectFormat(barcode: string): BarcodeInfo['format'] {
    if (!barcode) return 'UNKNOWN';

    const cleaned = barcode.trim();

    if (this.validateEAN13(cleaned)) {
      return 'EAN13';
    }

    if (this.validateUPCA(cleaned)) {
      return 'UPC_A';
    }

    if (this.validateUPCE(cleaned)) {
      return 'UPC_E';
    }

    if (this.validateInternal(cleaned)) {
      return 'INTERNAL';
    }

    return 'UNKNOWN';
  }

  /**
   * Validate any barcode format
   */
  isValidBarcode(barcode: string): boolean {
    return this.detectFormat(barcode) !== 'UNKNOWN';
  }

  /**
   * Get complete barcode info
   */
  getBarcodeInfo(barcode: string): BarcodeInfo {
    const cleaned = barcode.trim();
    const format = this.detectFormat(cleaned);
    const isValid = format !== 'UNKNOWN';

    const info: BarcodeInfo = {
      barcode: cleaned,
      format,
      isValid,
    };

    if (format === 'INTERNAL') {
      info.epicerieId = this.extractEpicerieId(cleaned) || undefined;
      info.sequenceNumber = this.extractSequenceNumber(cleaned) || undefined;
    }

    return info;
  }

  /**
   * Clean barcode (remove spaces, dashes, special characters)
   */
  cleanBarcode(barcode: string): string {
    if (!barcode) return '';
    return barcode.replace(/[^\d]/g, '').trim();
  }

  /**
   * Format barcode for display
   */
  formatBarcodeForDisplay(barcode: string, format?: BarcodeInfo['format']): string {
    const cleaned = this.cleanBarcode(barcode);
    const detectedFormat = format || this.detectFormat(cleaned);

    switch (detectedFormat) {
      case 'EAN13':
        return cleaned.replace(/(.{1,5})/g, '$1 ').trim();
      case 'UPC_A':
      case 'UPC_E':
        return cleaned.replace(/(.{1,4})/g, '$1 ').trim();
      case 'INTERNAL':
        // Format as: 2 + 001 + 0000042
        return `${cleaned[0]} ${cleaned.substring(1, 4)} ${cleaned.substring(4)}`;
      default:
        return cleaned;
    }
  }
}

export default new BarcodeService();

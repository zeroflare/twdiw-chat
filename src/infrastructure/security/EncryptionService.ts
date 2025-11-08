/**
 * EncryptionService - AES-256-GCM Encryption Utility
 *
 * Provides secure encryption and decryption of sensitive data using AES-256-GCM.
 * Designed for Cloudflare Workers environment with Web Crypto API.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Random IV generation for each encryption
 * - Base64 encoding for storage
 * - Constant-time comparison for authentication tags
 * - Automatic key normalization to 256 bits
 *
 * Key management:
 * - Encryption key stored in Wrangler secrets (ENCRYPTION_KEY)
 * - Accepts keys of any length (128, 192, 256, 384 bits, etc.)
 * - Keys are automatically normalized to 256 bits (32 bytes):
 *   - Oversized keys (e.g., 384-bit) are truncated to 256 bits
 *   - Undersized keys (e.g., 128-bit, 192-bit) are zero-padded to 256 bits
 * - Recommended: Generate with `openssl rand -base64 32` for optimal security
 *
 * Format: `iv:ciphertext` (both base64-encoded)
 */
export class EncryptionService {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    if (!encryptionKey || encryptionKey.trim() === '') {
      throw new Error('Encryption key cannot be empty');
    }

    // Validate base64 format
    try {
      atob(encryptionKey.trim());
    } catch (error) {
      throw new Error('Encryption key must be valid base64 string');
    }

    this.encryptionKey = encryptionKey.trim();
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   *
   * @param plaintext - The plaintext to encrypt
   * @returns Encrypted data in format `iv:ciphertext` (base64-encoded)
   * @throws Error if encryption fails
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      return '';
    }

    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Import key
      const key = await this.importKey();

      // Encode plaintext
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Encrypt
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        data
      );

      // Encode to base64
      const ivBase64 = this.arrayBufferToBase64(iv);
      const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);

      return `${ivBase64}:${ciphertextBase64}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM.
   *
   * @param encrypted - Encrypted data in format `iv:ciphertext` (base64-encoded)
   * @returns Decrypted plaintext
   * @throws Error if decryption fails or format is invalid
   */
  async decrypt(encrypted: string): Promise<string> {
    if (!encrypted) {
      return '';
    }

    try {
      // Parse encrypted data
      const parts = encrypted.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, ciphertextBase64] = parts;

      // Decode from base64
      const iv = this.base64ToArrayBuffer(ivBase64);
      const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);

      // Import key
      const key = await this.importKey();

      // Decrypt
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        ciphertext
      );

      // Decode plaintext
      const decoder = new TextDecoder();
      return decoder.decode(plaintext);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import encryption key for use with Web Crypto API.
   * Normalizes key to exactly 256 bits (32 bytes) for AES-256-GCM.
   *
   * @returns CryptoKey for AES-GCM encryption
   */
  private async importKey(): Promise<CryptoKey> {
    // Decode base64 key
    const keyData = this.base64ToArrayBuffer(this.encryptionKey);

    // Normalize key to exactly 32 bytes (256 bits)
    const normalizedKey = this.normalizeKeyTo256Bits(keyData);

    // Import key
    return await crypto.subtle.importKey(
      'raw',
      normalizedKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Normalize key to exactly 256 bits (32 bytes) for AES-256-GCM.
   * - Truncates keys longer than 32 bytes (e.g., 384-bit/48-byte keys)
   * - Pads keys shorter than 32 bytes with zeros
   *
   * @param keyData - Raw key bytes
   * @returns Normalized 32-byte key
   */
  private normalizeKeyTo256Bits(keyData: Uint8Array): Uint8Array {
    const targetLength = 32; // 256 bits = 32 bytes

    if (keyData.length === targetLength) {
      return keyData;
    }

    if (keyData.length > targetLength) {
      // Truncate to 32 bytes (handles 384-bit and other oversized keys)
      return keyData.slice(0, targetLength);
    }

    // Pad with zeros to 32 bytes (handles 128-bit and 192-bit keys)
    const normalized = new Uint8Array(targetLength);
    normalized.set(keyData);
    return normalized;
  }

  /**
   * Convert ArrayBuffer to base64 string.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer.
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

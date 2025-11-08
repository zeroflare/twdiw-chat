/**
 * EncryptedPersonalInfo Value Object
 *
 * Domain-Driven Design Value Object that encapsulates sensitive personal information
 * with AES-256-GCM encryption for data at rest.
 *
 * Security Features:
 * - AES-256-GCM encryption for gender and interests fields
 * - Unique IV (Initialization Vector) for each encryption
 * - Authentication tag for data integrity verification
 * - Immutable value object pattern
 *
 * Fields:
 * - nickname: Plain text (not sensitive, used for display)
 * - gender: Encrypted at rest (sensitive PII)
 * - interests: Encrypted at rest (sensitive PII)
 */

/**
 * Plain data structure for creating EncryptedPersonalInfo
 */
export interface PersonalInfoData {
  nickname: string;
  gender?: string;
  interests?: string[];
}

/**
 * Encrypted persistence format for database storage
 */
export interface EncryptedPersonalInfoPersistence {
  nickname: string;
  gender?: string; // Base64-encoded encrypted data
  interests?: string; // Base64-encoded encrypted data
}

/**
 * EncryptedPersonalInfo Value Object
 * Implements immutability and encryption for sensitive personal data
 */
export class EncryptedPersonalInfo {
  private readonly nickname: string;
  private readonly gender?: string;
  private readonly interests?: string[];
  private readonly encryptionKey: string; // Stored for convenience methods

  /**
   * Private constructor to enforce factory method pattern
   */
  private constructor(
    nickname: string,
    encryptionKey: string,
    gender?: string,
    interests?: string[]
  ) {
    this.nickname = nickname;
    this.encryptionKey = encryptionKey;
    this.gender = gender;
    this.interests = interests ? [...interests] : undefined; // Defensive copy
  }

  /**
   * Factory method to create EncryptedPersonalInfo from plain data
   * Encrypts sensitive fields (gender, interests) before storage
   *
   * @param data - Plain personal information
   * @param encryptionKey - Encryption key (32 bytes for AES-256)
   * @returns Promise<EncryptedPersonalInfo>
   */
  static async create(
    data: PersonalInfoData,
    encryptionKey: string
  ): Promise<EncryptedPersonalInfo> {
    // Validation
    if (!data.nickname || data.nickname.trim() === '') {
      throw new Error('nickname cannot be empty');
    }

    if (!encryptionKey || encryptionKey.trim() === '') {
      throw new Error('encryption key cannot be empty');
    }

    // Create instance (no encryption in memory, only for persistence)
    return new EncryptedPersonalInfo(
      data.nickname,
      encryptionKey,
      data.gender,
      data.interests
    );
  }

  /**
   * Factory method to reconstitute EncryptedPersonalInfo from encrypted database storage
   * Decrypts sensitive fields during reconstitution
   *
   * @param persistence - Encrypted persistence data from database
   * @param encryptionKey - Decryption key
   * @returns Promise<EncryptedPersonalInfo>
   */
  static async fromEncryptedPersistence(
    persistence: EncryptedPersonalInfoPersistence,
    encryptionKey: string
  ): Promise<EncryptedPersonalInfo> {
    if (!encryptionKey || encryptionKey.trim() === '') {
      throw new Error('encryption key cannot be empty');
    }

    // Decrypt gender if present
    const gender = persistence.gender
      ? await this.decrypt(persistence.gender, encryptionKey)
      : undefined;

    // Decrypt interests if present
    const interests = persistence.interests
      ? JSON.parse(await this.decrypt(persistence.interests, encryptionKey))
      : undefined;

    return new EncryptedPersonalInfo(
      persistence.nickname,
      encryptionKey,
      gender,
      interests
    );
  }

  /**
   * Convert to encrypted persistence format for database storage
   * Encrypts sensitive fields (gender, interests)
   *
   * @returns Promise<EncryptedPersonalInfoPersistence>
   */
  async toEncryptedPersistence(): Promise<EncryptedPersonalInfoPersistence> {
    // Encrypt gender if present
    const encryptedGender = this.gender
      ? await EncryptedPersonalInfo.encrypt(this.gender, this.encryptionKey)
      : undefined;

    // Encrypt interests if present
    const encryptedInterests = this.interests
      ? await EncryptedPersonalInfo.encrypt(JSON.stringify(this.interests), this.encryptionKey)
      : undefined;

    return {
      nickname: this.nickname,
      gender: encryptedGender,
      interests: encryptedInterests,
    };
  }

  // Getters (defensive copies for arrays)

  getNickname(): string {
    return this.nickname;
  }

  getGender(): string | undefined {
    return this.gender;
  }

  getInterests(): string[] | undefined {
    return this.interests ? [...this.interests] : undefined;
  }

  /**
   * Value Object equality comparison
   * Two EncryptedPersonalInfo instances are equal if all their fields are equal
   */
  equals(other: EncryptedPersonalInfo): boolean {
    if (this.nickname !== other.nickname) return false;
    if (this.gender !== other.gender) return false;

    // Deep comparison for interests array
    if (this.interests === undefined && other.interests === undefined) return true;
    if (this.interests === undefined || other.interests === undefined) return false;
    if (this.interests.length !== other.interests.length) return false;

    return this.interests.every((interest, index) => interest === other.interests![index]);
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   *
   * @param plaintext - Data to encrypt
   * @param encryptionKey - Encryption key (32 bytes for AES-256)
   * @returns Promise<string> - Base64-encoded encrypted data (IV + ciphertext + auth tag)
   */
  private static async encrypt(plaintext: string, encryptionKey: string): Promise<string> {
    // Generate a random 12-byte IV (recommended for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive CryptoKey from the encryption key string
    const key = await this.deriveKey(encryptionKey);

    // Encode plaintext to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt using AES-256-GCM
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      data
    );

    // Combine IV + encrypted data (ciphertext + auth tag)
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Return base64-encoded result
    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   *
   * @param encryptedData - Base64-encoded encrypted data (IV + ciphertext + auth tag)
   * @param encryptionKey - Decryption key
   * @returns Promise<string> - Decrypted plaintext
   */
  private static async decrypt(encryptedData: string, encryptionKey: string): Promise<string> {
    // Decode base64 to bytes
    const combined = this.base64ToArrayBuffer(encryptedData);

    // Extract IV (first 12 bytes) and ciphertext (remaining bytes)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Derive CryptoKey from the encryption key string
    const key = await this.deriveKey(encryptionKey);

    // Decrypt using AES-256-GCM
    try {
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128,
        },
        key,
        ciphertext
      );

      // Decode bytes to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      throw new Error('Decryption failed: invalid key or tampered data');
    }
  }

  /**
   * Derive a CryptoKey from a string encryption key using PBKDF2
   *
   * @param encryptionKey - String encryption key
   * @returns Promise<CryptoKey>
   */
  private static async deriveKey(encryptionKey: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(encryptionKey);

    // Import the key material
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-256-GCM key using PBKDF2
    // Note: In production, use a proper salt stored with the encrypted data
    const salt = encoder.encode('twdiw-salt-v1'); // Static salt for simplicity

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      importedKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private static arrayBufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Convert Base64 string to Uint8Array
   */
  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

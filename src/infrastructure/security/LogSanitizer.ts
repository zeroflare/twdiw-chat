/**
 * Log Sanitization Utility
 * Implements secure-by-default logging with environment-aware PII masking
 * Follows SECURE_PROMPT.md guidelines for PII protection
 *
 * Key Features:
 * - Environment-aware masking (development vs production)
 * - PII field detection and masking
 * - Security audit trail preservation
 * - Configurable masking patterns
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SECURITY = 'security'
}

export interface SanitizationConfig {
  isDevelopment: boolean;
  enableDebugLogs: boolean;
  preserveSecurityAudit: boolean;
}

/**
 * PII-sensitive field names to mask in logs
 */
const PII_FIELDS = new Set([
  // Personal identifiers
  'email',
  'oidcSubjectId',
  'memberId',
  'did',
  'linkedVcDid',
  'extractedDid',

  // Authentication data
  'token',
  'sessionToken',
  'authToken',
  'accessToken',
  'refreshToken',
  'idToken',
  'id_token',
  'code',
  'codeVerifier',
  'state',

  // Personal data
  'nickname',
  'name',
  'gender',
  'interests',

  // Sensitive identifiers
  'sub',
  'payloadSub',
  'userOidcSubjectId',
  'userMemberId',

  // VC Claims
  'verifiableCredential',
  'verifiablePresentation',
  'claims'
]);

/**
 * Security audit fields that should be preserved even in production
 * These are necessary for security monitoring and compliance
 */
const SECURITY_AUDIT_FIELDS = new Set([
  'status',
  'error',
  'errorCode',
  'transactionId',
  'rank',
  'derivedRank',
  'extractedRank',
  'memberStatus',
  'hasData',
  'verifyResult',
  'resultDescription'
]);

export class LogSanitizer {
  private config: SanitizationConfig;

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = {
      isDevelopment: config.isDevelopment ?? false,
      enableDebugLogs: config.enableDebugLogs ?? false,
      preserveSecurityAudit: config.preserveSecurityAudit ?? true
    };
  }

  /**
   * Sanitize a log message with PII masking
   * @param level Log level
   * @param message Log message
   * @param data Optional data object to sanitize
   * @returns Sanitized log data ready for output
   */
  sanitize(level: LogLevel, message: string, data?: Record<string, any>): {
    message: string;
    data?: Record<string, any>;
    shouldLog: boolean;
  } {
    // In production, suppress debug logs unless explicitly enabled
    if (!this.config.isDevelopment && !this.config.enableDebugLogs && level === LogLevel.DEBUG) {
      return { message, shouldLog: false };
    }

    // Sanitize data object if provided
    const sanitizedData = data ? this.sanitizeObject(data) : undefined;

    return {
      message,
      data: sanitizedData,
      shouldLog: true
    };
  }

  /**
   * Recursively sanitize an object by masking PII fields
   * @param obj Object to sanitize
   * @returns Sanitized object
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if field should be masked
      if (this.shouldMaskField(lowerKey)) {
        sanitized[key] = this.maskValue(value, key);
      }
      // Preserve security audit fields
      else if (SECURITY_AUDIT_FIELDS.has(key) || SECURITY_AUDIT_FIELDS.has(lowerKey)) {
        sanitized[key] = value;
      }
      // Recursively sanitize nested objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      // Sanitize arrays
      else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          item && typeof item === 'object' ? this.sanitizeObject(item) : item
        );
      }
      // Keep non-sensitive primitive values
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Determine if a field should be masked based on field name
   * @param fieldName Field name (lowercase)
   * @returns True if field should be masked
   */
  private shouldMaskField(fieldName: string): boolean {
    // In development mode, only mask authentication tokens
    if (this.config.isDevelopment) {
      return fieldName.includes('token') ||
             fieldName.includes('code') ||
             fieldName.includes('verifier') ||
             fieldName === 'state';
    }

    // In production, mask all PII fields
    if (PII_FIELDS.has(fieldName)) {
      return true;
    }

    // Check for common PII patterns
    const piiPatterns = [
      'email',
      'password',
      'secret',
      'key',
      'token',
      'credential',
      'subject',
      'nickname',
      'name'
    ];

    return piiPatterns.some(pattern => fieldName.includes(pattern));
  }

  /**
   * Mask a value appropriately based on type and context
   * @param value Value to mask
   * @param fieldName Field name for context
   * @returns Masked value
   */
  private maskValue(value: any, fieldName: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    const valueStr = String(value);

    // For boolean flags, just return the boolean
    if (typeof value === 'boolean') {
      return value;
    }

    // For short tokens/codes, show partial value in development
    if (this.config.isDevelopment) {
      if (valueStr.length <= 10) {
        return '[MASKED]';
      }

      // Show first few characters for debugging
      if (fieldName.toLowerCase().includes('state') ||
          fieldName.toLowerCase().includes('transaction')) {
        return `${valueStr.substring(0, 8)}...[MASKED]`;
      }
    }

    // Production: full masking
    if (valueStr.length > 0) {
      return '[REDACTED]';
    }

    return value;
  }

  /**
   * Create a sanitized logger function
   * @param level Log level
   * @returns Logger function
   */
  createLogger(level: LogLevel) {
    return (message: string, data?: Record<string, any>) => {
      const result = this.sanitize(level, message, data);

      if (!result.shouldLog) {
        return;
      }

      const logFn = this.getConsoleMethod(level);
      if (result.data) {
        logFn(message, result.data);
      } else {
        logFn(message);
      }
    };
  }

  /**
   * Get appropriate console method for log level
   * @param level Log level
   * @returns Console method
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.ERROR:
      case LogLevel.SECURITY:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.DEBUG:
      case LogLevel.INFO:
      default:
        return console.log;
    }
  }

  /**
   * Sanitize and format log message for security audit
   * Preserves necessary information for compliance while protecting PII
   * @param eventType Security event type
   * @param data Event data
   * @returns Formatted security audit log
   */
  securityAudit(eventType: string, data: Record<string, any>): void {
    const sanitized = this.sanitizeObject(data);

    console.log(`[SECURITY AUDIT] ${eventType}`, {
      timestamp: new Date().toISOString(),
      event: eventType,
      ...sanitized
    });
  }
}

/**
 * Create a LogSanitizer instance based on environment
 * @param env Environment variables
 * @returns Configured LogSanitizer
 */
export function createLogSanitizer(env?: any): LogSanitizer {
  const isDevelopment = env?.DEV_MODE === 'true' ||
                       env?.NODE_ENV === 'development';

  const enableDebugLogs = env?.ENABLE_DEBUG_LOGS === 'true';

  return new LogSanitizer({
    isDevelopment,
    enableDebugLogs,
    preserveSecurityAudit: true
  });
}

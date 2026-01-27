/**
 * Secure Logger - Sanitizes sensitive data before logging
 * SECURITY: Never logs PII, tokens, passwords, or sensitive user data
 */

interface LogContext {
  userId?: string;
  action?: string;
  [key: string]: any;
}

// Fields that should never be logged
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'credit_card',
  'ssn',
  'email', // Email is PII
  'phone',
  'phone_number',
  'address',
  'ip_address',
];

// Headers that should never be logged
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
];

/**
 * Sanitize an object by removing or masking sensitive fields
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5) return '[Max Depth]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a sensitive field
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize HTTP headers
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

/**
 * Mask user identifiable information
 */
function maskUserId(userId: string): string {
  if (!userId || userId.length < 8) return '[MASKED]';
  return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
}

export class SecureLogger {
  private functionName: string;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  /**
   * Log informational messages (non-sensitive only)
   */
  info(message: string, context?: LogContext) {
    const sanitizedContext = context ? sanitizeObject(context) : {};
    console.info(`[${this.functionName}] ${message}`, sanitizedContext);
  }

  /**
   * Log errors (automatically sanitizes)
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const sanitizedContext = context ? sanitizeObject(context) : {};
    
    console.error(`[${this.functionName}] ERROR: ${message}`, {
      error: errorMessage,
      ...sanitizedContext
    });
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext) {
    const sanitizedContext = context ? sanitizeObject(context) : {};
    console.warn(`[${this.functionName}] WARNING: ${message}`, sanitizedContext);
  }

  /**
   * Log request start (sanitizes headers and body)
   */
  logRequest(req: Request, additionalContext?: LogContext) {
    this.info('Request received', {
      method: req.method,
      headers: sanitizeHeaders(req.headers),
      ...additionalContext
    });
  }

  /**
   * Log authenticated user (masks user ID)
   */
  logAuth(userId: string, additionalInfo?: Record<string, any>) {
    this.info('User authenticated', {
      userId: maskUserId(userId),
      ...sanitizeObject(additionalInfo || {})
    });
  }

  /**
   * Log action performed
   */
  logAction(action: string, context?: LogContext) {
    this.info(`Action: ${action}`, sanitizeObject(context || {}));
  }
}

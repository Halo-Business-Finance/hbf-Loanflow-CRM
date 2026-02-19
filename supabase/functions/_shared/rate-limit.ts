// Rate limiting utilities for Edge Functions
// deno-lint-ignore-file no-explicit-any
import { SecureLogger } from './secure-logger.ts';

const logger = new SecureLogger('rate-limit');

export interface RateLimitConfig {
  action: string;
  maxAttempts: number;
  windowMinutes: number;
}

export const checkRateLimit = async (
  supabase: any,
  userId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; error?: string }> => {
  try {
    const identifier = `${userId}:${config.action}`;
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      action: config.action,
      identifier,
      max_attempts: config.maxAttempts,
      window_minutes: config.windowMinutes
    });
    
    if (error) {
      logger.error('Rate limit check failed', error, { action: config.action });
      // Fail open (allow request) if rate limit check fails
      return { allowed: true };
    }
    
    if (!data || !data.allowed) {
      return { 
        allowed: false, 
        error: `Rate limit exceeded. Maximum ${config.maxAttempts} requests per ${config.windowMinutes} minutes.`
      };
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Rate limit error', error instanceof Error ? error : new Error(String(error)), { action: config.action });
    // Fail open (allow request) if rate limit check fails
    return { allowed: true };
  }
};

// Predefined rate limit configs for common operations
export const RATE_LIMITS = {
  // Admin operations
  ADMIN_CREATE_USER: { action: 'admin_create_user', maxAttempts: 10, windowMinutes: 60 },
  ADMIN_UPDATE_USER: { action: 'admin_update_user', maxAttempts: 20, windowMinutes: 60 },
  ADMIN_DELETE_USER: { action: 'admin_delete_user', maxAttempts: 5, windowMinutes: 60 },
  ADMIN_RESET_PASSWORD: { action: 'admin_reset_password', maxAttempts: 10, windowMinutes: 60 },
  ADMIN_GET_USERS: { action: 'admin_get_users', maxAttempts: 100, windowMinutes: 60 },
  
  // Security-sensitive operations
  ENCRYPT_DATA: { action: 'encrypt_data', maxAttempts: 50, windowMinutes: 60 },
  DECRYPT_DATA: { action: 'decrypt_data', maxAttempts: 30, windowMinutes: 60 },
  ENCRYPTION_KEY_DERIVE: { action: 'encryption_key_derive', maxAttempts: 20, windowMinutes: 60 },
  ENCRYPTION_KEY_ROTATE: { action: 'encryption_key_rotate', maxAttempts: 5, windowMinutes: 60 },
  
  // Email operations (prevent spam)
  SEND_EMAIL: { action: 'send_email', maxAttempts: 50, windowMinutes: 60 },
  SEND_PASSWORD_RESET: { action: 'send_password_reset', maxAttempts: 5, windowMinutes: 15 },
  
  // Document operations
  SCAN_DOCUMENT: { action: 'scan_document', maxAttempts: 100, windowMinutes: 60 },
  
  // Session operations
  SESSION_VALIDATE: { action: 'session_validate', maxAttempts: 200, windowMinutes: 60 },
  SESSION_TRACK: { action: 'session_track', maxAttempts: 500, windowMinutes: 60 },
  
  // Auth operations (strict limits for brute force prevention)
  AUTH_LOGIN: { action: 'auth_login', maxAttempts: 10, windowMinutes: 15 },
  AUTH_EXCHANGE_CODE: { action: 'auth_exchange_code', maxAttempts: 10, windowMinutes: 15 },
  
  // General operations
  AUDIT_LOG: { action: 'audit_log', maxAttempts: 100, windowMinutes: 60 },
  BLOCKCHAIN_HASH: { action: 'blockchain_hash', maxAttempts: 50, windowMinutes: 60 },
};

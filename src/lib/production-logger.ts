/**
 * Production-safe logging utility
 * Prevents sensitive data exposure in production while maintaining debug capability in development
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(`ℹ️ ${message}`, data || '');
    }
  },

  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`⚠️ ${message}`, data || '');
    }
  },

  error: (message: string, error?: any) => {
    // Always log errors but sanitize sensitive data
    const sanitizedError = error instanceof Error 
      ? { message: error.message, name: error.name }
      : error;
    
    console.error(`❌ ${message}`, isDevelopment ? error : sanitizedError);
  },

  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      console.debug(`🔍 ${message}`, data || '');
    }
  },

  // For critical security events that should always be logged
  security: (message: string, data?: any) => {
    console.warn(`🔒 SECURITY: ${message}`, data || '');
  }
};

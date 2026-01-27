/**
 * Production-safe logger utility
 * Prevents sensitive data leakage through console logs in production
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

class ProductionLogger {
  private isDevelopment = import.meta.env.DEV;

  log(...args: any[]) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  info(...args: any[]) {
    if (this.isDevelopment) {
      console.info(...args);
    }
  }

  warn(...args: any[]) {
    if (this.isDevelopment) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    // Always log errors, but sanitize in production
    if (this.isDevelopment) {
      console.error(...args);
    } else {
      // In production, log minimal error info
      console.error('An error occurred. Check server logs for details.');
    }
  }

  debug(...args: any[]) {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }

  /**
   * Use this for security-sensitive operations
   * Logs only in development, never in production
   */
  secureLog(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`[SECURE] ${message}`, data || '');
    }
  }
}

export const logger = new ProductionLogger();

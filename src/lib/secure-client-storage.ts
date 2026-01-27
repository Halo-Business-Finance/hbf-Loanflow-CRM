/**
 * Secure client-side storage utility that minimizes use of localStorage/sessionStorage
 * for security-sensitive data and implements automatic cleanup
 */

interface StorageItem {
  value: any;
  expires?: number;
  sensitive?: boolean;
}

class SecureClientStorage {
  private static instance: SecureClientStorage;
  private memoryStorage = new Map<string, StorageItem>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initCleanup();
    this.auditExistingStorage();
  }

  static getInstance(): SecureClientStorage {
    if (!SecureClientStorage.instance) {
      SecureClientStorage.instance = new SecureClientStorage();
    }
    return SecureClientStorage.instance;
  }

  /**
   * Store data with automatic expiration and security considerations
   */
  setItem(key: string, value: any, options?: {
    expires?: number; // minutes
    persistent?: boolean; // use localStorage, default false
    sensitive?: boolean; // mark as sensitive data
  }): void {
    const expires = options?.expires ? Date.now() + (options.expires * 60 * 1000) : undefined;
    const item: StorageItem = { value, expires, sensitive: options?.sensitive };

    if (options?.persistent && !options?.sensitive) {
      // Only use localStorage for non-sensitive, explicitly persistent data
      try {
        localStorage.setItem(key, JSON.stringify(item));
      } catch (error) {
        console.warn('localStorage unavailable, using memory storage');
        this.memoryStorage.set(key, item);
      }
    } else {
      // Use memory storage for sensitive or temporary data
      this.memoryStorage.set(key, item);
    }
  }

  /**
   * Retrieve data with automatic expiration check
   */
  getItem(key: string): any | null {
    // Check memory storage first
    const memoryItem = this.memoryStorage.get(key);
    if (memoryItem) {
      if (memoryItem.expires && Date.now() > memoryItem.expires) {
        this.memoryStorage.delete(key);
        return null;
      }
      return memoryItem.value;
    }

    // Check localStorage for persistent items
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const item: StorageItem = JSON.parse(stored);
        if (item.expires && Date.now() > item.expires) {
          localStorage.removeItem(key);
          return null;
        }
        return item.value;
      }
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
    }

    return null;
  }

  /**
   * Remove item from all storage locations
   */
  removeItem(key: string): void {
    this.memoryStorage.delete(key);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  }

  /**
   * Clear all storage with security considerations
   */
  clear(options?: { sensitiveOnly?: boolean }): void {
    if (options?.sensitiveOnly) {
      // Only clear sensitive data
      for (const [key, item] of this.memoryStorage.entries()) {
        if (item.sensitive) {
          this.memoryStorage.delete(key);
        }
      }
      
      // Check localStorage for sensitive items (should not exist, but clean up)
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.sensitive) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn('Error cleaning localStorage:', error);
      }
    } else {
      // Clear everything
      this.memoryStorage.clear();
      try {
        localStorage.clear();
      } catch (error) {
        console.warn('Error clearing localStorage:', error);
      }
    }
  }

  /**
   * Audit existing localStorage for security issues
   */
  private auditExistingStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const sensitivePatterns = [
        /token/i, /auth/i, /session/i, /password/i, /secret/i, 
        /api_key/i, /private/i, /credential/i, /mfa/i
      ];

      for (const key of keys) {
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
        if (isSensitive) {
          console.warn(`Security audit: Potentially sensitive data in localStorage: ${key}`);
          // Consider removing or migrating sensitive data
        }
      }
    } catch (error) {
      console.warn('Storage audit failed:', error);
    }
  }

  /**
   * Initialize automatic cleanup of expired items
   */
  private initCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean memory storage
      for (const [key, item] of this.memoryStorage.entries()) {
        if (item.expires && now > item.expires) {
          this.memoryStorage.delete(key);
        }
      }

      // Clean localStorage
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const item: StorageItem = JSON.parse(stored);
            if (item.expires && now > item.expires) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Emergency cleanup for security incidents
   */
  emergencyCleanup(): void {
    this.memoryStorage.clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Get storage statistics for monitoring
   */
  getStorageStats(): {
    memoryItems: number;
    localStorageItems: number;
    sensitiveItemsInMemory: number;
    expiredItems: number;
  } {
    const now = Date.now();
    let sensitiveItemsInMemory = 0;
    let expiredItems = 0;

    for (const [, item] of this.memoryStorage.entries()) {
      if (item.sensitive) sensitiveItemsInMemory++;
      if (item.expires && now > item.expires) expiredItems++;
    }

    return {
      memoryItems: this.memoryStorage.size,
      localStorageItems: Object.keys(localStorage).length,
      sensitiveItemsInMemory,
      expiredItems
    };
  }
}

// Export singleton instance
export const secureStorage = SecureClientStorage.getInstance();

// Export hook for React components
export const useSecureStorage = () => {
  return {
    setItem: secureStorage.setItem.bind(secureStorage),
    getItem: secureStorage.getItem.bind(secureStorage),
    removeItem: secureStorage.removeItem.bind(secureStorage),
    clear: secureStorage.clear.bind(secureStorage),
    emergencyCleanup: secureStorage.emergencyCleanup.bind(secureStorage),
    getStats: secureStorage.getStorageStats.bind(secureStorage)
  };
};
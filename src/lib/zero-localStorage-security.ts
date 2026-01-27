/**
 * Zero-localStorage Security Manager
 * Eliminates localStorage usage for sensitive data, using only server-side storage
 */

import { supabase } from '@/integrations/supabase/client';

interface SecureStorageOptions {
  encrypt?: boolean;
  ttl?: number; // Time to live in seconds
  critical?: boolean; // For critical security data
}

class ZeroLocalStorageManager {
  private static instance: ZeroLocalStorageManager;
  private encryptionKey: string | null = null;
  
  private constructor() {
    this.initializeEncryption();
    this.startCleanupTimer();
  }

  static getInstance(): ZeroLocalStorageManager {
    if (!ZeroLocalStorageManager.instance) {
      ZeroLocalStorageManager.instance = new ZeroLocalStorageManager();
    }
    return ZeroLocalStorageManager.instance;
  }

  private async initializeEncryption() {
    try {
      // Generate session-specific encryption key (never stored in localStorage)
      this.encryptionKey = await this.generateSecureKey();
    } catch (error) {
      console.error('Encryption initialization failed:', error);
    }
  }

  private async generateSecureKey(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Store sensitive data using only server-side secure sessions
   */
  async setSecureItem(key: string, value: any, options: SecureStorageOptions = {}): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('User not authenticated for secure storage');
        return false;
      }

      let processedValue = value;
      
      if (options.encrypt && this.encryptionKey) {
        processedValue = await this.encryptData(JSON.stringify(value));
      }

      const expiresAt = options.ttl 
        ? new Date(Date.now() + options.ttl * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h default

      // Store in security_events table as secure storage
      const { error } = await supabase
        .from('security_events')
        .insert({
          user_id: user.id,
          event_type: 'secure_storage',
          severity: options.critical ? 'high' : 'low',
          details: {
            key,
            value: processedValue,
            encrypted: options.encrypt || false,
            critical: options.critical || false,
            expires_at: expiresAt,
            created_at: new Date().toISOString()
          }
        });

      if (error) {
        console.error('Secure storage failed:', error);
        return false;
      }

      // Log security event for critical data
      if (options.critical) {
        await this.logSecurityEvent('critical_data_stored', {
          key,
          encrypted: options.encrypt,
          ttl: options.ttl
        });
      }

      return true;
    } catch (error) {
      console.error('Secure storage error:', error);
      return false;
    }
  }

  /**
   * Retrieve sensitive data from server-side secure sessions only
   */
  async getSecureItem(key: string): Promise<any | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('security_events')
        .select('details')
        .eq('user_id', user.id)
        .eq('event_type', 'secure_storage')
        .filter('details->key', 'eq', key)
        .gt('details->expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const sessionData = data.details as any;
      let value = sessionData.value;

      if (sessionData.encrypted && this.encryptionKey) {
        try {
          value = JSON.parse(await this.decryptData(value));
        } catch (decryptError) {
          console.warn('Decryption failed for key:', key);
          return null;
        }
      }

      // Log access to critical data
      if (sessionData.critical) {
        await this.logSecurityEvent('critical_data_accessed', { key });
      }

      return value;
    } catch (error) {
      console.error('Secure retrieval error:', error);
      return null;
    }
  }

  /**
   * Remove sensitive data from server-side storage
   */
  async removeSecureItem(key: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('security_events')
        .update({ event_type: 'secure_storage_deleted' })
        .eq('user_id', user.id)
        .eq('event_type', 'secure_storage')
        .filter('details->key', 'eq', key);

      return !error;
    } catch (error) {
      console.error('Secure removal error:', error);
      return false;
    }
  }

  /**
   * Clear all user session data from server-side storage
   */
  async clearAllSecureData(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('security_events')
        .update({ event_type: 'secure_storage_deleted' })
        .eq('user_id', user.id)
        .eq('event_type', 'secure_storage');

      await this.logSecurityEvent('all_secure_data_cleared', {});
      return !error;
    } catch (error) {
      console.error('Secure clear all error:', error);
      return false;
    }
  }

  /**
   * Audit and clean any remaining localStorage usage
   */
  auditAndCleanLocalStorage(): void {
    const sensitivePatterns = [
      '_sec_', '_fortress_', '_enhanced_', '_security_', '_session_',
      '_auth_', '_token_', '_key_', '_credential_', '_api_'
    ];

    const keys = Object.keys(localStorage);
    const violatingKeys: string[] = [];

    keys.forEach(key => {
      const isSensitive = sensitivePatterns.some(pattern => 
        key.toLowerCase().includes(pattern)
      );
      
      if (isSensitive) {
        violatingKeys.push(key);
        localStorage.removeItem(key);
      }
    });

    if (violatingKeys.length > 0) {
      console.warn('Removed sensitive data from localStorage:', violatingKeys);
      this.logSecurityEvent('localStorage_cleanup', {
        removedKeys: violatingKeys.length,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start periodic cleanup of localStorage
   */
  private startCleanupTimer(): void {
    // Clean localStorage every 5 minutes
    setInterval(() => {
      this.auditAndCleanLocalStorage();
    }, 5 * 60 * 1000);

    // Initial cleanup
    this.auditAndCleanLocalStorage();
  }

  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.encryptionKey.slice(0, 32));
    const dataToEncrypt = encoder.encode(data);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataToEncrypt
    );
    
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...result));
  }

  private async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    
    const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.encryptionKey.slice(0, 32));
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  }

  private async logSecurityEvent(eventType: string, details: any): Promise<void> {
    try {
      await supabase
        .from('security_events')
        .insert({
          event_type: eventType,
          severity: details.critical ? 'high' : 'medium',
          details: {
            ...details,
            timestamp: new Date().toISOString(),
            source: 'zero_localStorage_manager'
          }
        });
    } catch (error) {
      console.warn('Security event logging failed:', error);
    }
  }
}

// Export singleton instance
export const zeroLocalStorage = ZeroLocalStorageManager.getInstance();

// Hook for React components
export const useZeroLocalStorage = () => {
  return {
    setSecureItem: (key: string, value: any, options?: SecureStorageOptions) => 
      zeroLocalStorage.setSecureItem(key, value, options),
    getSecureItem: (key: string) => 
      zeroLocalStorage.getSecureItem(key),
    removeSecureItem: (key: string) => 
      zeroLocalStorage.removeSecureItem(key),
    clearAllSecureData: () => 
      zeroLocalStorage.clearAllSecureData(),
    auditLocalStorage: () => 
      zeroLocalStorage.auditAndCleanLocalStorage()
  };
};
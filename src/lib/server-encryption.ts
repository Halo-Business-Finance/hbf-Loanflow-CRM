/**
 * Server-Side Encryption Utility
 * 
 * SECURITY: All encryption operations are performed server-side via Edge Functions.
 * This eliminates client-side key storage vulnerabilities.
 * 
 * Usage:
 * - Replaces client-side encryption in secure-storage.ts, field-encryption.ts, etc.
 * - All keys managed securely by Supabase encryption-key-service
 */

import { ibmDb } from '@/lib/ibm';
import { getAuthUser } from '@/lib/auth-utils';

export interface EncryptionResult {
  success: boolean;
  encrypted?: string;
  decrypted?: any;
  error?: string;
}

/**
 * Encrypt sensitive data using server-side Edge Function
 * @param data - Data to encrypt (will be JSON stringified)
 * @param context - Optional context for key derivation
 */
export const encryptData = async (data: any, context?: string): Promise<EncryptionResult> => {
  try {
    const payload = {
      action: 'encrypt',
      data: typeof data === 'string' ? data : JSON.stringify(data),
      context
    };

    const { data: result, error } = await ibmDb.rpc('encrypt_data', payload);

    if (error) {
      console.error('Encryption failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true, encrypted: (result as any).encrypted };
  } catch (error) {
    console.error('Encryption error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Encryption failed' 
    };
  }
};

/**
 * Decrypt data using server-side Edge Function
 * @param encrypted - Encrypted string from encryptData
 * @param context - Optional context (must match encryption context)
 */
export const decryptData = async (encrypted: string, context?: string): Promise<EncryptionResult> => {
  try {
    const payload = {
      action: 'decrypt',
      encrypted,
      context
    };

    const { data: result, error } = await ibmDb.rpc('encrypt_data', payload);

    if (error) {
      console.error('Decryption failed:', error);
      return { success: false, error: error.message };
    }

    // Try to parse as JSON, fallback to raw string
    let decrypted;
    try {
      decrypted = JSON.parse((result as any).decrypted);
    } catch {
      decrypted = (result as any).decrypted;
    }

    return { success: true, decrypted };
  } catch (error) {
    console.error('Decryption error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Decryption failed' 
    };
  }
};

/**
 * Secure storage wrapper using server-side encryption
 * Replaces client-side secure-storage.ts and enhanced-secure-storage.ts
 */
export class ServerSecureStorage {
  /**
   * Store encrypted data server-side
   * @param key - Storage key
   * @param data - Data to encrypt and store
   * @param options - Storage options (ttl, etc.)
   */
  async setItem(
    key: string, 
    data: any, 
    options?: { ttl?: number; context?: string }
  ): Promise<boolean> {
    try {
      // Encrypt data server-side
      const encryptResult = await encryptData(data, options?.context || key);
      
      if (!encryptResult.success || !encryptResult.encrypted) {
        console.error('Failed to encrypt data for storage');
        return false;
      }

      // Store encrypted data in Supabase (secure_session_data table)
      const user = await getAuthUser();
      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      const expiresAt = options?.ttl 
        ? new Date(Date.now() + options.ttl * 60 * 1000).toISOString()
        : new Date(Date.now() + 480 * 60 * 1000).toISOString(); // Default 8 hours

      const { error } = await ibmDb
        .from('secure_session_data')
        .upsert({
          user_id: user.id,
          session_key: key,
          session_value: encryptResult.encrypted,
          expires_at: expiresAt
        });

      if (error) {
        console.error('Failed to store encrypted data:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Retrieve and decrypt data from server-side storage
   * @param key - Storage key
   * @param options - Retrieval options
   */
  async getItem(key: string, options?: { context?: string }): Promise<any | null> {
    try {
      const user = await getAuthUser();
      if (!user) {
        console.error('User not authenticated');
        return null;
      }

      // Fetch encrypted data from Supabase
      const { data, error } = await ibmDb
        .from('secure_session_data')
        .select('session_value, expires_at')
        .eq('user_id', user.id)
        .eq('session_key', key)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      // Check expiration
      if (new Date((data as any).expires_at) < new Date()) {
        // Data expired, delete it
        await this.removeItem(key);
        return null;
      }

      // Decrypt data server-side
      const decryptResult = await decryptData((data as any).session_value as string, options?.context || key);
      
      if (!decryptResult.success) {
        console.error('Failed to decrypt stored data');
        return null;
      }

      return decryptResult.decrypted;
    } catch (error) {
      console.error('Retrieval error:', error);
      return null;
    }
  }

  /**
   * Remove stored data
   * @param key - Storage key
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      const user = await getAuthUser();
      if (!user) return false;

      const { error } = await ibmDb
        .from('secure_session_data')
        .delete()
        .eq('user_id', user.id)
        .eq('session_key', key);

      return !error;
    } catch (error) {
      console.error('Removal error:', error);
      return false;
    }
  }

  /**
   * Clear all stored data for current user
   */
  async clear(): Promise<boolean> {
    try {
      const user = await getAuthUser();
      if (!user) return false;

      const { error } = await ibmDb
        .from('secure_session_data')
        .delete()
        .eq('user_id', user.id);

      return !error;
    } catch (error) {
      console.error('Clear error:', error);
      return false;
    }
  }
}

// Singleton instance
export const serverSecureStorage = new ServerSecureStorage();

// Migration helper - warns about deprecated client-side encryption
export const warnDeprecatedClientEncryption = (functionName: string) => {
  console.warn(
    `[SECURITY WARNING] ${functionName} uses deprecated client-side encryption. ` +
    `Migrate to serverSecureStorage from @/lib/server-encryption for military-grade security.`
  );
};

/**
 * Secure storage utility for encrypting sensitive data in localStorage
 */

class SecureStorage {
  private encryptionKey: string;

  constructor() {
    // Generate or retrieve encryption key
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  private getOrCreateEncryptionKey(): string {
    // Use session-based key (no localStorage) for better security
    if (!this.sessionKey) {
      this.sessionKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return this.sessionKey;
  }
  
  private sessionKey: string | null = null;

  private async encrypt(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate a random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.encryptionKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt using AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine salt, IV, and encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(encryptedText: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract salt, IV, and encrypted data
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);
      
      // Derive the same key using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.encryptionKey),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Decrypt using AES-GCM
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(value);
      localStorage.setItem(`_sec_${key}`, encrypted);
    } catch (error) {
      console.error('Secure storage setItem failed:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const encrypted = localStorage.getItem(`_sec_${key}`);
      if (!encrypted) return null;
      
      return await this.decrypt(encrypted);
    } catch (error) {
      console.error('Secure storage getItem failed:', error);
      return null;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(`_sec_${key}`);
  }

  clear(): void {
    // Clear all secure storage items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('_sec_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

export const secureStorage = new SecureStorage();
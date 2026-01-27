/**
 * Field-level encryption for sensitive data
 * Provides AES-GCM encryption for individual database fields
 */

export class FieldEncryption {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a derived key from master key and field identifier
  private static async deriveKey(masterKey: string, fieldIdentifier: string): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(masterKey + fieldIdentifier),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.encoder.encode('loan-flow-salt-' + fieldIdentifier),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt sensitive field data
  static async encryptField(
    data: string, 
    fieldType: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii',
    masterKey?: string
  ): Promise<string> {
    if (!data || data === '') return '';
    
    try {
      // Use a field-specific key derivation
      const key = await this.deriveKey(
        masterKey || await this.getMasterKey(), 
        fieldType
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const dataBuffer = this.encoder.encode(data);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      );
      
      // Combine IV and encrypted data with field type prefix
      const combined = new Uint8Array(1 + iv.length + encrypted.byteLength);
      combined[0] = this.getFieldTypeCode(fieldType);
      combined.set(iv, 1);
      combined.set(new Uint8Array(encrypted), 1 + iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Field encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  // Decrypt sensitive field data
  static async decryptField(
    encryptedData: string,
    fieldType?: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii',
    masterKey?: string
  ): Promise<string> {
    if (!encryptedData || encryptedData === '') return '';
    
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract field type from prefix if not provided
      const typeCode = combined[0];
      const detectedFieldType = fieldType || this.getFieldTypeFromCode(typeCode);
      
      const iv = combined.slice(1, 13);
      const encrypted = combined.slice(13);
      
      const key = await this.deriveKey(
        masterKey || await this.getMasterKey(),
        detectedFieldType
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      return this.decoder.decode(decrypted);
    } catch (error) {
      console.error('Field decryption failed:', error);
      return ''; // Return empty string for corrupted data
    }
  }

  // DEPRECATED: Client-side key storage is insecure
  // TODO: Migrate to server-side encryption via Edge Functions
  // @see: src/lib/server-encryption.ts for secure alternative
  private static async getMasterKey(): Promise<string> {
    console.warn('[SECURITY] field-encryption.ts uses deprecated client-side keys. Migrate to server-encryption.ts');
    
    // Ephemeral in-memory cache ONLY (no sessionStorage persistence)
    // @ts-ignore
    if ((FieldEncryption as any)._ephemeralMasterKey) {
      return (FieldEncryption as any)._ephemeralMasterKey as string;
    }

    // Generate new ephemeral key (memory only, no persistence)
    const key = Array.from(crypto.getRandomValues(new Uint8Array(64)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // @ts-ignore - Store in memory only
    (FieldEncryption as any)._ephemeralMasterKey = key;
    return key;
  }

  // Field type codes for data integrity
  private static getFieldTypeCode(fieldType: string): number {
    const codes = {
      'ssn': 1,
      'credit_score': 2,
      'loan_amount': 3,
      'financial': 4,
      'pii': 5
    };
    return codes[fieldType as keyof typeof codes] || 5;
  }

  private static getFieldTypeFromCode(code: number): string {
    const types = {
      1: 'ssn',
      2: 'credit_score', 
      3: 'loan_amount',
      4: 'financial',
      5: 'pii'
    };
    return types[code as keyof typeof types] || 'pii';
  }

  // Encrypt multiple fields at once
  static async encryptMultipleFields(
    data: Record<string, any>,
    fieldConfig: Record<string, 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'>
  ): Promise<Record<string, any>> {
    const encrypted = { ...data };
    
    for (const [field, type] of Object.entries(fieldConfig)) {
      if (data[field] && typeof data[field] === 'string') {
        encrypted[field] = await this.encryptField(data[field], type);
      } else if (data[field] && typeof data[field] === 'number') {
        encrypted[field] = await this.encryptField(data[field].toString(), type);
      }
    }
    
    return encrypted;
  }

  // Decrypt multiple fields at once
  static async decryptMultipleFields(
    data: Record<string, any>,
    fieldConfig: Record<string, 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'>
  ): Promise<Record<string, any>> {
    const decrypted = { ...data };
    
    for (const [field, type] of Object.entries(fieldConfig)) {
      if (data[field] && typeof data[field] === 'string') {
        const decryptedValue = await this.decryptField(data[field], type);
        
        // Convert back to number if it was originally a number
        if (type === 'credit_score' || type === 'loan_amount') {
          decrypted[field] = decryptedValue ? parseFloat(decryptedValue) : null;
        } else {
          decrypted[field] = decryptedValue;
        }
      }
    }
    
    return decrypted;
  }

  // Key rotation functionality
  static async rotateKeys(): Promise<void> {
    try {
      // This would typically involve:
      // 1. Generate new master key
      // 2. Re-encrypt all sensitive data with new key
      // 3. Update stored master key
      console.log('Key rotation would be implemented here for production');
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  // Clear all encryption keys (security measure)
  static clearKeys(): void {
    try {
      // Clear memory-only key (sessionStorage no longer used)
      // @ts-ignore
      if ((FieldEncryption as any)._ephemeralMasterKey) {
        // @ts-ignore
        delete (FieldEncryption as any)._ephemeralMasterKey;
      }
    } catch {}
  }
}

// Configuration for sensitive fields in Lead data
export const LEAD_ENCRYPTION_CONFIG = {
  credit_score: 'credit_score' as const,
  loan_amount: 'loan_amount' as const,
  annual_revenue: 'financial' as const,
  net_operating_income: 'financial' as const,
  existing_loan_amount: 'financial' as const,
  income: 'financial' as const,
  property_payment_amount: 'financial' as const,
  interest_rate: 'financial' as const,
  // Personal identifiable information
  phone: 'pii' as const,
  bdo_telephone: 'pii' as const,
  business_address: 'pii' as const,
  location: 'pii' as const
};

// Utility functions for common operations
export const encryptLeadData = (leadData: any) => 
  FieldEncryption.encryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG);

export const decryptLeadData = (leadData: any) => 
  FieldEncryption.decryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG);
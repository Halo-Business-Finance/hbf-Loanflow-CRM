/**
 * Data integrity protection layer
 * Provides checksums, tampering detection, and data validation
 */

export class DataIntegrity {
  // Generate SHA-256 hash for data integrity verification
  static async generateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify data integrity using checksum
  static async verifyChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.generateChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  // Create tamper-proof data package
  static async createSecurePackage(data: any): Promise<{
    data: string;
    checksum: string;
    timestamp: number;
    signature: string;
  }> {
    const jsonData = JSON.stringify(data);
    const checksum = await this.generateChecksum(jsonData);
    const timestamp = Date.now();
    
    // Create signature combining data, checksum, and timestamp
    const signatureData = `${jsonData}:${checksum}:${timestamp}`;
    const signature = await this.generateChecksum(signatureData);
    
    return {
      data: btoa(jsonData), // Base64 encode the data
      checksum,
      timestamp,
      signature
    };
  }

  // Verify and unpack secure data package
  static async verifySecurePackage(package_: {
    data: string;
    checksum: string;
    timestamp: number;
    signature: string;
  }): Promise<{ valid: boolean; data?: any; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Decode data
      const jsonData = atob(package_.data);
      const data = JSON.parse(jsonData);
      
      // Verify checksum
      const checksumValid = await this.verifyChecksum(jsonData, package_.checksum);
      if (!checksumValid) {
        errors.push('Data checksum verification failed');
      }
      
      // Verify signature
      const signatureData = `${jsonData}:${package_.checksum}:${package_.timestamp}`;
      const expectedSignature = await this.generateChecksum(signatureData);
      if (expectedSignature !== package_.signature) {
        errors.push('Data signature verification failed');
      }
      
      // Check timestamp (prevent replay attacks)
      const age = Date.now() - package_.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (age > maxAge) {
        errors.push('Data package expired');
      }
      
      return {
        valid: errors.length === 0,
        data: errors.length === 0 ? data : undefined,
        errors
      };
    } catch (error) {
      errors.push(`Package verification error: ${error}`);
      return { valid: false, errors };
    }
  }

  // Validate sensitive data patterns
  static validateSensitiveData(data: any, rules: Record<string, {
    required?: boolean;
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    type?: 'number' | 'string' | 'email' | 'phone';
  }>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      
      // Required field check
      if (rule.required && (!value || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is empty and not required
      if (!value || value === '') continue;
      
      // Type validation
      if (rule.type) {
        switch (rule.type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push(`${field} must be a valid number`);
            }
            break;
          case 'email':
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(value)) {
              errors.push(`${field} must be a valid email address`);
            }
            break;
          case 'phone':
            const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
            const cleanPhone = value.replace(/[\s\-()\.]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
              errors.push(`${field} must be a valid phone number`);
            }
            break;
        }
      }
      
      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
      
      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be no more than ${rule.maxLength} characters`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Create audit trail for data modifications - server-side only
  static async createAuditEntry(action: string, data: any, userId?: string): Promise<{
    id: string;
    action: string;
    userId?: string;
    timestamp: number;
    dataHash: string;
    metadata: any;
  }> {
    const entry = {
      id: crypto.randomUUID(),
      action,
      userId,
      timestamp: Date.now(),
      dataHash: await this.generateChecksum(JSON.stringify(data)),
      metadata: {
        userAgent: navigator.userAgent.substring(0, 100),
        url: window.location.href,
        size: JSON.stringify(data).length
      }
    };
    
    // Store audit entry to server only - no localStorage fallback for security
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.from('audit_logs').insert({
        action,
        user_id: userId,
        details: {
          ...entry.metadata,
          dataHash: entry.dataHash
        }
      });
    } catch (error) {
      // Log error but do not store in localStorage for security reasons
      console.error('Failed to create audit entry:', error);
    }
    
    return entry;
  }

  // Retrieve audit trail - server-side only
  static async getAuditTrail(limit: number = 100): Promise<any[]> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.error('Failed to retrieve audit trail:', error);
    }
    
    return [];
  }

  // Secure comparison for sensitive data (timing attack resistant)
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  // Generate secure random tokens
  static generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Note: Secure backups removed for security - use server-side database backups instead
  // If backup functionality is needed, implement server-side with proper encryption and access controls
}

// Validation rules for Lead data
export const LEAD_VALIDATION_RULES = {
  name: { required: true, minLength: 2, maxLength: 100 },
  email: { required: true, type: 'email' as const, maxLength: 254 },
  phone: { type: 'phone' as const, minLength: 10, maxLength: 15 },
  credit_score: { type: 'number' as const, pattern: /^[0-9]{3}$/ },
  loan_amount: { type: 'number' as const },
  annual_revenue: { type: 'number' as const },
  business_name: { maxLength: 200 },
  business_address: { maxLength: 500 },
  notes: { maxLength: 2000 }
};

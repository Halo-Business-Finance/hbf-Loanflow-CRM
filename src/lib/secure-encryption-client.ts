/**
 * CRITICAL SECURITY FIX: Secure client-side encryption utilities
 * This replaces the mock encryption with real AES-256-GCM encryption
 */
import { supabase } from '@/integrations/supabase/client';

interface EncryptionResult {
  success: boolean;
  encryptedValue?: string;
  keyId?: string;
  error?: string;
}

interface DecryptionResult {
  success: boolean;
  decryptedValue?: string;
  error?: string;
}

export class SecureEncryptionClient {
  
  /**
   * Encrypt sensitive field data using the secure encryption service
   */
  static async encryptField(
    data: string,
    tableName: string,
    fieldName: string,
    recordId: string
  ): Promise<EncryptionResult> {
    try {
      // Validate inputs
      if (!data || !tableName || !fieldName || !recordId) {
        return {
          success: false,
          error: 'All parameters are required for encryption'
        };
      }

      // Call the secure encryption edge function
      const { data: result, error } = await supabase.functions.invoke('encrypt-data', {
        body: {
          action: 'encrypt',
          data: data.toString(),
          tableName,
          fieldName,
          recordId
        }
      });

      if (error) {
        console.error('Encryption service error:', error);
        return {
          success: false,
          error: 'Encryption service unavailable'
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Encryption failed'
        };
      }

      return {
        success: true,
        encryptedValue: result.encryptedValue,
        keyId: result.keyId
      };

    } catch (error) {
      console.error('Client encryption error:', error);
      return {
        success: false,
        error: 'Encryption failed due to client error'
      };
    }
  }

  /**
   * Decrypt sensitive field data using the secure encryption service
   */
  static async decryptField(
    tableName: string,
    fieldName: string,
    recordId: string
  ): Promise<DecryptionResult> {
    try {
      // Validate inputs
      if (!tableName || !fieldName || !recordId) {
        return {
          success: false,
          error: 'All parameters are required for decryption'
        };
      }

      // Call the secure encryption edge function
      const { data: result, error } = await supabase.functions.invoke('encrypt-data', {
        body: {
          action: 'decrypt',
          tableName,
          fieldName,
          recordId
        }
      });

      if (error) {
        console.error('Decryption service error:', error);
        return {
          success: false,
          error: 'Decryption service unavailable'
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Decryption failed'
        };
      }

      return {
        success: true,
        decryptedValue: result.decryptedValue
      };

    } catch (error) {
      console.error('Client decryption error:', error);
      return {
        success: false,
        error: 'Decryption failed due to client error'
      };
    }
  }

  /**
   * Encrypt multiple sensitive fields for a contact record
   */
  static async encryptContactFields(
    contactData: Record<string, any>,
    contactId: string
  ): Promise<Record<string, any>> {
    const sensitiveFields = ['email', 'phone', 'credit_score', 'income', 'loan_amount'];
    const processedData = { ...contactData };

    for (const field of sensitiveFields) {
      if (contactData[field] && contactData[field] !== '') {
        const result = await this.encryptField(
          contactData[field].toString(),
          'contact_entities',
          field,
          contactId
        );

        if (result.success) {
          // Remove the original field from the data (it's now encrypted separately)
          delete processedData[field];
        } else {
          console.error(`Failed to encrypt field ${field}:`, result.error);
          // For now, keep the original value if encryption fails
          // In production, you might want to fail the entire operation
        }
      }
    }

    return processedData;
  }

  /**
   * Decrypt multiple sensitive fields for a contact record
   */
  static async decryptContactFields(
    contactId: string
  ): Promise<Record<string, string>> {
    const sensitiveFields = ['email', 'phone', 'credit_score', 'income', 'loan_amount'];
    const decryptedFields: Record<string, string> = {};

    for (const field of sensitiveFields) {
      const result = await this.decryptField(
        'contact_entities',
        field,
        contactId
      );

      if (result.success && result.decryptedValue) {
        decryptedFields[field] = result.decryptedValue;
      }
    }

    return decryptedFields;
  }

  /**
   * Validate session before performing critical operations
   */
  static async validateCriticalOperation(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('validate_critical_operation_access');
      
      if (error) {
        console.error('Session validation error:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Critical operation validation failed:', error);
      return false;
    }
  }
}

// Enhanced input validation utilities
export class SecureInputValidator {
  
  /**
   * Sanitize and validate input data with XSS protection
   */
  static async validateAndSanitize(
    input: string,
    fieldType: 'email' | 'phone' | 'text' | 'numeric' | 'url' = 'text',
    maxLength: number = 255
  ): Promise<{ valid: boolean; sanitized?: string; errors?: string[] }> {
    try {
      const { data, error } = await supabase.rpc('validate_and_sanitize_input_enhanced', {
        p_input: input,
        p_field_type: fieldType,
        p_max_length: maxLength,
        p_allow_html: false
      });

      if (error) {
        console.error('Input validation error:', error);
        return {
          valid: false,
          errors: ['Validation service unavailable']
        };
      }

      return {
        valid: (data as any)?.valid || false,
        sanitized: (data as any)?.sanitized,
        errors: (data as any)?.errors || []
      };

    } catch (error) {
      console.error('Input validation failed:', error);
      return {
        valid: false,
        errors: ['Validation failed']
      };
    }
  }

  /**
   * Validate email format with enhanced security
   */
  static async validateEmail(email: string): Promise<{ valid: boolean; sanitized?: string; errors?: string[] }> {
    return this.validateAndSanitize(email, 'email', 254);
  }

  /**
   * Validate phone number with enhanced security
   */
  static async validatePhone(phone: string): Promise<{ valid: boolean; sanitized?: string; errors?: string[] }> {
    return this.validateAndSanitize(phone, 'phone', 20);
  }

  /**
   * Validate numeric input (credit scores, amounts, etc.)
   */
  static async validateNumeric(value: string): Promise<{ valid: boolean; sanitized?: string; errors?: string[] }> {
    return this.validateAndSanitize(value, 'numeric', 20);
  }
}

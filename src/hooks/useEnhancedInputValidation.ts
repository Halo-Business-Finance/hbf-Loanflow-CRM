/**
 * ENHANCED INPUT VALIDATION - Comprehensive client/server validation
 * Implements XSS protection, length limits, and security monitoring
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: string;
  errors: string[];
  securityFlags: string[];
  lengthCheck?: boolean;
}

export interface ValidationConfig {
  maxLength?: number;
  minLength?: number;
  allowedChars?: RegExp;
  securityLevel?: 'basic' | 'enhanced' | 'strict';
}

export const useEnhancedInputValidation = () => {
  const validateAndSanitize = useCallback(async (
    input: string,
    fieldType: 'email' | 'phone' | 'text' | 'financial' | 'url' = 'text',
    maxLength = 100, // Tighter default limit for better security
    allowHtml = false
  ): Promise<ValidationResult> => {
    try {
      const { data, error } = await supabase.rpc('validate_and_sanitize_input_enhanced', {
        p_input: input,
        p_field_type: fieldType,
        p_max_length: maxLength,
        p_allow_html: allowHtml
      });

      if (error) {
        console.error('Server-side validation error:', error);
        // Log security event for validation failures
        await supabase.rpc('log_security_event', {
          p_event_type: 'input_validation_error',
          p_severity: 'low',
          p_details: { error: error.message, input_type: fieldType }
        });
        return {
          isValid: false,
          errors: ['Validation service unavailable'],
          securityFlags: ['validation_service_error']
        };
      }

      const validationResult = data as any;
      const result = {
        isValid: validationResult.valid,
        sanitizedValue: validationResult.sanitized,
        errors: validationResult.errors || [],
        securityFlags: validationResult.security_flags || []
      };

      // Log suspicious input patterns
      if (!validationResult.valid && validationResult.errors?.some((error: string) => 
        error.includes('malicious') || error.includes('Invalid characters'))) {
        await supabase.rpc('log_security_event', {
          p_event_type: 'suspicious_input_detected',
          p_severity: 'high',
          p_details: { 
            input_preview: input.substring(0, 50),
            field_type: fieldType,
            errors: validationResult.errors
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Input validation error:', error);
      await supabase.rpc('log_security_event', {
        p_event_type: 'input_validation_exception',
        p_severity: 'medium',
        p_details: { error: String(error), input_type: fieldType }
      });
      return {
        isValid: false,
        errors: ['Validation failed'],
        securityFlags: ['validation_exception']
      };
    }
  }, []);

  const validateFinancialData = useCallback(async (
    amount: string | number,
    fieldName: string
  ): Promise<ValidationResult> => {
    const stringAmount = String(amount);
    
    // Client-side pre-validation
    if (!stringAmount || stringAmount.trim() === '') {
      return {
        isValid: false,
        errors: [`${fieldName} is required`],
        securityFlags: []
      };
    }

    // Check for reasonable financial amounts
    const numericAmount = parseFloat(stringAmount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return {
        isValid: false,
        errors: [`${fieldName} must be a valid positive number`],
        securityFlags: ['invalid_financial_format']
      };
    }

    // Check for suspiciously large amounts (potential data manipulation)
    if (numericAmount > 100000000) { // 100 million
      return {
        isValid: false,
        errors: [`${fieldName} exceeds maximum allowed amount`],
        securityFlags: ['suspicious_large_amount']
      };
    }

    return await validateAndSanitize(stringAmount, 'financial');
  }, [validateAndSanitize]);

  const validateEmail = useCallback(async (email: string): Promise<ValidationResult> => {
    // Enhanced email validation with tighter length limit
    const result = await validateAndSanitize(email, 'email', 254); // RFC 5321 limit
    
    // Additional client-side checks for suspicious patterns
    const suspiciousPatterns = [
      /temp.*mail/i,
      /throw.*away/i,
      /disposable/i,
      /fake.*mail/i,
      /mailinator/i,
      /guerrillamail/i,
      /10minutemail/i
    ];

    const securityFlags = [...(result.securityFlags || [])];
    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      securityFlags.push('suspicious_email_pattern');
    }

    return {
      ...result,
      securityFlags
    };
  }, [validateAndSanitize]);

  const validatePhone = useCallback(async (phone: string): Promise<ValidationResult> => {
    // Remove all non-digits for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return {
        isValid: false,
        errors: ['Phone number must be 10-15 digits'],
        securityFlags: ['invalid_phone_length']
      };
    }

    return await validateAndSanitize(phone, 'phone', 20); // Tighter limit for phone numbers
  }, [validateAndSanitize]);

  return {
    validateAndSanitize,
    validateFinancialData,
    validateEmail,
    validatePhone
  };
};
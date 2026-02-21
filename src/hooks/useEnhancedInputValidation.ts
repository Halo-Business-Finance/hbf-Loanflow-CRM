/**
 * ENHANCED INPUT VALIDATION - Comprehensive client/server validation
 * Implements XSS protection, length limits, and security monitoring
 */
import { useCallback } from 'react';
import { ibmDb } from '@/lib/ibm';

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
    maxLength = 100,
    allowHtml = false
  ): Promise<ValidationResult> => {
    try {
      const { data, error } = await ibmDb.rpc('validate_and_sanitize_input_enhanced', {
        p_input: input,
        p_field_type: fieldType,
        p_max_length: maxLength,
        p_allow_html: allowHtml
      });

      if (error) {
        console.error('Server-side validation error:', error);
        await ibmDb.rpc('log_security_event', {
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

      if (!validationResult.valid && validationResult.errors?.some((error: string) => 
        error.includes('malicious') || error.includes('Invalid characters'))) {
        await ibmDb.rpc('log_security_event', {
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
      await ibmDb.rpc('log_security_event', {
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
    if (!stringAmount || stringAmount.trim() === '') {
      return { isValid: false, errors: [`${fieldName} is required`], securityFlags: [] };
    }
    const numericAmount = parseFloat(stringAmount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return { isValid: false, errors: [`${fieldName} must be a valid positive number`], securityFlags: ['invalid_financial_format'] };
    }
    if (numericAmount > 100000000) {
      return { isValid: false, errors: [`${fieldName} exceeds maximum allowed amount`], securityFlags: ['suspicious_large_amount'] };
    }
    return await validateAndSanitize(stringAmount, 'financial');
  }, [validateAndSanitize]);

  const validateEmail = useCallback(async (email: string): Promise<ValidationResult> => {
    const result = await validateAndSanitize(email, 'email', 254);
    const suspiciousPatterns = [/temp.*mail/i, /throw.*away/i, /disposable/i, /fake.*mail/i, /mailinator/i, /guerrillamail/i, /10minutemail/i];
    const securityFlags = [...(result.securityFlags || [])];
    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      securityFlags.push('suspicious_email_pattern');
    }
    return { ...result, securityFlags };
  }, [validateAndSanitize]);

  const validatePhone = useCallback(async (phone: string): Promise<ValidationResult> => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return { isValid: false, errors: ['Phone number must be 10-15 digits'], securityFlags: ['invalid_phone_length'] };
    }
    return await validateAndSanitize(phone, 'phone', 20);
  }, [validateAndSanitize]);

  return { validateAndSanitize, validateFinancialData, validateEmail, validatePhone };
};

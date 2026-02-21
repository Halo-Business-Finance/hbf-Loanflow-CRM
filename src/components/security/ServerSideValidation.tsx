import { useEffect, useState } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  isValid: boolean;
  sanitizedData: Record<string, any>;
  securityFlags: string[];
}

export const useServerSideValidation = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);

  const validateWithMaliciousDetection = async (
    formData: Record<string, any>
  ): Promise<ValidationResult> => {
    setIsValidating(true);
    
    try {
      // Server-side validation via ibmDb.rpc (maps to hbf-api endpoint)
      const { data, error } = await ibmDb.rpc('validate-form-data', {
        formData,
        securityLevel: 'high',
        includeXSSCheck: true,
        includeSQLInjectionCheck: true,
        logSecurityEvents: true
      });

      if (error) {
        console.error('Server validation error:', error);
        toast({
          title: "Validation Error",
          description: "Server-side validation failed. Please try again.",
          variant: "destructive"
        });
        
        return {
          isValid: false,
          sanitizedData: formData,
          securityFlags: ['server_error']
        };
      }

      const result = data as ValidationResult;
      
      if (result.securityFlags && result.securityFlags.length > 0) {
        console.warn('Security flags detected:', result.securityFlags);
        
        if (result.securityFlags.includes('xss_attempt') || 
            result.securityFlags.includes('sql_injection_attempt')) {
          toast({
            title: "Security Warning",
            description: "Your input contains potentially unsafe content. Please review and try again.",
            variant: "destructive"
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Validation failed:', error);
      toast({
        title: "Validation Failed",
        description: "Unable to validate your input. Please try again.",
        variant: "destructive"
      });
      
      return {
        isValid: false,
        sanitizedData: formData,
        securityFlags: ['validation_failed']
      };
    } finally {
      setIsValidating(false);
    }
  };

  const validateSensitiveField = async (
    fieldName: string,
    fieldValue: string,
    fieldType: 'email' | 'phone' | 'financial' | 'pii'
  ) => {
    try {
      const { data, error } = await ibmDb.rpc('validate-sensitive-field', {
        fieldName,
        fieldValue,
        fieldType,
        applyDataMasking: true,
        requireEncryption: true
      });

      if (error) {
        console.error('Sensitive field validation error:', error);
        return { isValid: false, sanitized: fieldValue };
      }

      return data;
    } catch (error) {
      console.error('Sensitive field validation failed:', error);
      return { isValid: false, sanitized: fieldValue };
    }
  };

  return {
    validateWithMaliciousDetection,
    validateSensitiveField,
    isValidating
  };
};

// Edge function template (for reference only — runs on hbf-api, not in browser)
export const createFormValidationFunction = `
// This validation logic now runs on the hbf-api backend
// See: POST /api/v1/security/validate-form-data
`;

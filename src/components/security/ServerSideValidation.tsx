import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      // Server-side validation with security checks
      const { data, error } = await supabase.functions.invoke('validate-form-data', {
        body: {
          formData,
          securityLevel: 'high',
          includeXSSCheck: true,
          includeSQLInjectionCheck: true,
          logSecurityEvents: true
        }
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
      
      // Log high-risk security flags
      if (result.securityFlags && result.securityFlags.length > 0) {
        console.warn('Security flags detected:', result.securityFlags);
        
        // Show user-friendly message for security issues
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
      const { data, error } = await supabase.functions.invoke('validate-sensitive-field', {
        body: {
          fieldName,
          fieldValue,
          fieldType,
          applyDataMasking: true,
          requireEncryption: true
        }
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

// Edge function for form validation - create this next
export const createFormValidationFunction = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { formData, securityLevel = 'medium' } = await req.json();
    
    // Enhanced security validation
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'string') {
        // XSS detection
        if (/<script|javascript:|vbscript:|onload|onerror/i.test(value)) {
          securityFlags.push('xss_attempt');
        }
        
        // SQL injection detection
        if (/('|(\\-\\-)|(;|\\||\\*|%))/.test(value)) {
          securityFlags.push('sql_injection_attempt');
        }
        
        // Sanitize the value
        sanitizedData[key] = value
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/[<>&"']/g, '') // Remove dangerous characters
          .trim();
      } else {
        sanitizedData[key] = value;
      }
    }
    
    // Log security events
    if (securityFlags.length > 0) {
      await supabase.rpc('log_enhanced_security_event', {
        p_event_type: 'form_validation_security_flag',
        p_severity: 'high',
        p_details: { securityFlags, formData: Object.keys(formData) }
      });
    }
    
    return new Response(
      JSON.stringify({
        isValid: securityFlags.length === 0,
        sanitizedData,
        securityFlags
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
`;
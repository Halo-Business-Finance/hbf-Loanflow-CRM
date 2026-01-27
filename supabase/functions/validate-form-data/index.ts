import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('validate-form-data')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationRequest {
  formData: Record<string, any>;
  securityLevel?: 'low' | 'medium' | 'high';
  includeXSSCheck?: boolean;
  includeSQLInjectionCheck?: boolean;
  logSecurityEvents?: boolean;
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

    const { 
      formData, 
      securityLevel = 'medium',
      includeXSSCheck = true,
      includeSQLInjectionCheck = true,
      logSecurityEvents = true
    }: ValidationRequest = await req.json();
    
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};
    let isValid = true;
    
    // Enhanced security validation patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /expression\s*\(/gi
    ];
    
    const sqlInjectionPatterns = [
      /('|(\\-\\-)|(;|\\||\\*|%))/,
      /(union\s+select)/i,
      /(drop\s+table)/i,
      /(delete\s+from)/i,
      /(insert\s+into)/i,
      /(update\s+.+set)/i,
      /(exec\s*\()/i,
      /(execute\s*\()/i
    ];
    
    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'string' && value.length > 0) {
        let sanitizedValue = value.trim();
        
        // XSS detection and prevention
        if (includeXSSCheck) {
          for (const pattern of xssPatterns) {
            if (pattern.test(sanitizedValue)) {
              securityFlags.push('xss_attempt');
              isValid = false;
              
              // Log detailed XSS attempt
              if (logSecurityEvents) {
                await supabase.rpc('log_enhanced_security_event', {
                  p_event_type: 'xss_attempt_detailed',
                  p_severity: 'critical',
                  p_details: { 
                    field: key, 
                    pattern: pattern.toString(),
                    inputLength: value.length,
                    attemptedPayload: value.substring(0, 100) // Log first 100 chars for analysis
                  }
                });
              }
              break;
            }
          }
          
          // Remove potentially malicious content
          sanitizedValue = sanitizedValue
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
        
        // SQL injection detection
        if (includeSQLInjectionCheck) {
          for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(sanitizedValue)) {
              securityFlags.push('sql_injection_attempt');
              isValid = false;
              
              // Log SQL injection attempt
              if (logSecurityEvents) {
                await supabase.rpc('log_enhanced_security_event', {
                  p_event_type: 'sql_injection_attempt',
                  p_severity: 'critical',
                  p_details: { 
                    field: key,
                    pattern: pattern.toString(),
                    inputLength: value.length
                  }
                });
              }
              break;
            }
          }
        }
        
        // Additional security checks based on security level
        if (securityLevel === 'high') {
          // Check for suspicious patterns
          if (/(%3C|%3E|%22|%27|%3B)/i.test(sanitizedValue)) {
            securityFlags.push('url_encoding_detected');
          }
          
          // Check for excessive length (potential DoS)
          if (sanitizedValue.length > 10000) {
            securityFlags.push('excessive_input_length');
            sanitizedValue = sanitizedValue.substring(0, 1000); // Truncate
          }
          
          // Check for binary content
          if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/.test(sanitizedValue)) {
            securityFlags.push('binary_content_detected');
            isValid = false;
          }
        }
        
        // Additional sanitization
        sanitizedData[key] = sanitizedValue
          .replace(/[<>&"']/g, (char) => {
            const entityMap: Record<string, string> = {
              '<': '&lt;',
              '>': '&gt;',
              '&': '&amp;',
              '"': '&quot;',
              "'": '&#x27;'
            };
            return entityMap[char] || char;
          });
      } else {
        sanitizedData[key] = value;
      }
    }
    
    // Log security validation results
    if (logSecurityEvents && securityFlags.length > 0) {
      await supabase.rpc('log_enhanced_security_event', {
        p_event_type: 'form_validation_security_flags',
        p_severity: isValid ? 'medium' : 'high',
        p_details: { 
          securityFlags, 
          formFields: Object.keys(formData),
          securityLevel,
          flagCount: securityFlags.length
        }
      });
    }
    
    // Rate limiting check for high-risk patterns
    if (securityFlags.includes('xss_attempt') || securityFlags.includes('sql_injection_attempt')) {
      // Additional security measures could be implemented here
      logger.warn('High-risk security pattern detected')
    }
    
    return new Response(
      JSON.stringify({
        isValid,
        sanitizedData,
        securityFlags,
        securityLevel,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Form validation error', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Validation service error',
        isValid: false,
        sanitizedData: {},
        securityFlags: ['validation_service_error']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
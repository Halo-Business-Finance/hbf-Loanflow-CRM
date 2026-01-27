import React, { useCallback, useState } from 'react';
import { useEnhancedInputValidation } from '@/hooks/useEnhancedInputValidation';
import { useSecurityAuditLogger } from '@/components/security/SecurityAuditLogger';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield } from 'lucide-react';

interface SecureFormWrapperProps {
  children: React.ReactNode;
  formName: string;
  onSubmit: (data: any) => Promise<void>;
  className?: string;
}

export const SecureFormWrapper: React.FC<SecureFormWrapperProps> = ({
  children,
  formName,
  onSubmit,
  className = ''
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const { validateAndSanitize } = useEnhancedInputValidation();
  const { logFormValidationFailure, logSuspiciousActivity } = useSecurityAuditLogger();

  const handleFormSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSecurityWarnings([]);

    try {
      const formData = new FormData(event.currentTarget);
      const data: Record<string, any> = {};
      const validationErrors: string[] = [];
      const securityFlags: string[] = [];

      // Validate and sanitize all form inputs
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string' && value.trim()) {
          const validation = await validateAndSanitize(value, 'text');
          
          if (!validation.isValid) {
            validationErrors.push(...validation.errors);
          }
          
          if (validation.securityFlags.length > 0) {
            securityFlags.push(...validation.securityFlags);
          }
          
          data[key] = validation.sanitizedValue || value;
        } else {
          data[key] = value;
        }
      }

      // Log validation failures if any
      if (validationErrors.length > 0 || securityFlags.length > 0) {
        await logFormValidationFailure(formName, validationErrors, securityFlags);
      }

      // Log suspicious activity for critical security flags
      const criticalFlags = securityFlags.filter(flag => 
        flag.includes('xss_attempt') || 
        flag.includes('sql_injection') || 
        flag.includes('malicious')
      );
      
      if (criticalFlags.length > 0) {
        await logSuspiciousActivity(
          'malicious_form_input',
          {
            form: formName,
            security_flags: criticalFlags,
            input_data: Object.keys(data) // Don't log actual values for security
          },
          'high'
        );
        
        setSecurityWarnings([
          'Potentially malicious input detected and blocked.',
          'This incident has been logged for security review.'
        ]);
        return;
      }

      // Show warnings for non-critical security flags
      if (securityFlags.length > 0) {
        setSecurityWarnings([
          'Some input was automatically sanitized for security.',
          'Please review your entries and try again if needed.'
        ]);
      }

      // Proceed with form submission if no critical issues
      if (validationErrors.length === 0) {
        await onSubmit(data);
      }

    } catch (error) {
      console.error('Form submission error:', error);
      await logSuspiciousActivity(
        'form_submission_error',
        {
          form: formName,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'medium'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formName, onSubmit, validateAndSanitize, logFormValidationFailure, logSuspiciousActivity]);

  return (
    <form onSubmit={handleFormSubmit} className={`secure-form ${className}`}>
      {securityWarnings.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {securityWarnings.map((warning, index) => (
                <div key={index}>{warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="relative">
        {children}
        
        {/* Security indicator */}
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-green-600" />
          <span>Form protected with enhanced security validation</span>
        </div>
        
        {isSubmitting && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </form>
  );
};
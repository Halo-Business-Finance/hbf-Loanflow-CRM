/**
 * SECURITY INPUT VALIDATOR - Standardized validation component
 * Provides consistent input validation across all forms
 */
import React, { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useEnhancedInputValidation, ValidationResult } from '@/hooks/useEnhancedInputValidation';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';

interface SecurityInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  fieldType?: 'email' | 'phone' | 'text' | 'financial' | 'url';
  multiline?: boolean;
  maxLength?: number;
  allowHtml?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const SecurityInputValidator: React.FC<SecurityInputProps> = ({
  id,
  label,
  value,
  onChange,
  fieldType = 'text',
  multiline = false,
  maxLength = 100,
  allowHtml = false,
  required = false,
  placeholder,
  className
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { validateAndSanitize, validateEmail, validatePhone, validateFinancialData } = useEnhancedInputValidation();

  const handleValidation = useCallback(async (inputValue: string) => {
    if (!inputValue && !required) {
      setValidationResult(null);
      onChange(inputValue, true);
      return;
    }

    setIsValidating(true);
    try {
      let result: ValidationResult;

      // Use specialized validators for specific field types
      switch (fieldType) {
        case 'email':
          result = await validateEmail(inputValue);
          break;
        case 'phone':
          result = await validatePhone(inputValue);
          break;
        case 'financial':
          result = await validateFinancialData(inputValue, label);
          break;
        default:
          result = await validateAndSanitize(inputValue, fieldType, maxLength, allowHtml);
      }

      setValidationResult(result);
      onChange(result.sanitizedValue || inputValue, result.isValid);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        errors: ['Validation failed'],
        securityFlags: ['validation_error']
      });
      onChange(inputValue, false);
    } finally {
      setIsValidating(false);
    }
  }, [fieldType, maxLength, allowHtml, required, label, onChange, validateAndSanitize, validateEmail, validatePhone, validateFinancialData]);

  const handleChange = (newValue: string) => {
    // Debounce validation to avoid excessive API calls
    setTimeout(() => handleValidation(newValue), 300);
  };

  const getValidationIcon = () => {
    if (isValidating) return <Shield className="h-4 w-4 animate-spin text-blue-500" />;
    if (!validationResult) return null;
    return validationResult.isValid ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  const hasSecurityFlags = validationResult?.securityFlags && validationResult.securityFlags.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex items-center gap-2">
          {label}
          {required && <span className="text-red-500">*</span>}
          {getValidationIcon()}
        </Label>
        {hasSecurityFlags && (
          <div className="flex gap-1">
            {validationResult.securityFlags.map((flag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {flag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value, validationResult?.isValid ?? true);
            handleChange(e.target.value);
          }}
          placeholder={placeholder}
          className={className}
          maxLength={maxLength}
        />
      ) : (
        <Input
          id={id}
          type={fieldType === 'email' ? 'email' : fieldType === 'phone' ? 'tel' : 'text'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value, validationResult?.isValid ?? true);
            handleChange(e.target.value);
          }}
          placeholder={placeholder}
          className={className}
          maxLength={maxLength}
        />
      )}

      {/* Character count */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{value.length}/{maxLength} characters</span>
        {fieldType === 'financial' && (
          <span>Financial data is encrypted</span>
        )}
      </div>

      {/* Validation errors */}
      {validationResult && !validationResult.isValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationResult.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Security warnings for suspicious patterns */}
      {hasSecurityFlags && validationResult.securityFlags.some(flag => 
        flag.includes('suspicious') || flag.includes('malicious')
      ) && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Security patterns detected. Your input has been flagged for review.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
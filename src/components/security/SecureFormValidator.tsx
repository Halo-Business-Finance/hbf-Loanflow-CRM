import React, { createContext, useContext, ReactNode } from 'react';
import { useSecureForm } from '@/hooks/useSecureForm';
import { useToast } from '@/hooks/use-toast';

interface SecureFormContextType {
  validateField: (value: string, fieldType: 'text' | 'email' | 'phone' | 'numeric') => Promise<{
    isValid: boolean;
    sanitizedValue: string;
    errors: string[];
  }>;
  validateFormData: (formData: Record<string, any>) => Promise<{
    isValid: boolean;
    sanitizedData: Record<string, any>;
    errors: Record<string, string[]>;
  }>;
  isValidating: boolean;
}

const SecureFormContext = createContext<SecureFormContextType | undefined>(undefined);

interface SecureFormProviderProps {
  children: ReactNode;
}

export const SecureFormProvider: React.FC<SecureFormProviderProps> = ({ children }) => {
  const { validateAndSanitize, validateFormData, isValidating } = useSecureForm();
  const { toast } = useToast();

  const validateField = async (
    value: string, 
    fieldType: 'text' | 'email' | 'phone' | 'numeric'
  ) => {
    try {
      const result = await validateAndSanitize(value, fieldType);
      
      if (!result.valid && result.errors.length > 0) {
        // Show security-related validation errors
        toast({
          title: "Invalid Input",
          description: result.errors[0],
          variant: "destructive"
        });
      }
      
      return {
        isValid: result.valid,
        sanitizedValue: result.sanitized,
        errors: result.errors
      };
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Error",
        description: "Unable to validate input. Please try again.",
        variant: "destructive"
      });
      
      return {
        isValid: false,
        sanitizedValue: value,
        errors: ['Validation failed']
      };
    }
  };

  const contextValue: SecureFormContextType = {
    validateField,
    validateFormData,
    isValidating
  };

  return (
    <SecureFormContext.Provider value={contextValue}>
      {children}
    </SecureFormContext.Provider>
  );
};

export const useSecureFormContext = () => {
  const context = useContext(SecureFormContext);
  if (!context) {
    throw new Error('useSecureFormContext must be used within a SecureFormProvider');
  }
  return context;
};
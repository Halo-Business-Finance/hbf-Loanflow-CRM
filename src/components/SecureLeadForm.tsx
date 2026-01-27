import React from 'react';
import { useRoleBasedAccess } from '@/hooks/useRoleBasedAccess';
import { useSecureForm } from '@/hooks/useSecureForm';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

interface SecureLeadFormProps {
  children: React.ReactNode;
}

export const SecureLeadForm: React.FC<SecureLeadFormProps> = ({ children }) => {
  const { canAccessLeads } = useRoleBasedAccess();
  const { isValidating } = useSecureForm();

  if (!canAccessLeads) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access lead management features.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <SecurityWrapper requireRole="loan_originator">
      <div className={isValidating ? 'opacity-50 pointer-events-none' : ''}>
        {children}
      </div>
    </SecurityWrapper>
  );
};
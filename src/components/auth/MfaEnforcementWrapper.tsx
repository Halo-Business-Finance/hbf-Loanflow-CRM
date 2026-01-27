import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMfaStatus } from '@/hooks/useMfaStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle } from 'lucide-react';

interface MfaEnforcementWrapperProps {
  children: React.ReactNode;
}

export const MfaEnforcementWrapper: React.FC<MfaEnforcementWrapperProps> = ({ children }) => {
  // MFA enforcement disabled - users complained about unwanted authenticator entries
  return <>{children}</>;
};

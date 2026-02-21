import { useState, useCallback } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'manager' | 'viewer' | 'super_admin' | 'loan_processor' | 'underwriter' | 'funder' | 'closer' | 'tech' | 'loan_originator';

interface RoleAssignmentResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface MFAVerificationResult {
  success: boolean;
  verification_token?: string;
  expires_in_minutes?: number;
  error?: string;
}

interface MFAVerificationResponse {
  success: boolean;
  verification_token: string;
  expires_in_minutes: number;
}

interface RoleAssignmentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const useSecureRoleManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string>('');
  const [hasMfaVerification, setHasMfaVerification] = useState(false);
  const { toast } = useToast();

  const generateMfaVerification = useCallback(async (): Promise<MFAVerificationResult> => {
    try {
      setIsLoading(true);
      const { data, error } = await ibmDb.rpc('generate_role_change_mfa_verification');
      if (error) { console.error('MFA generation error:', error); return { success: false, error: error.message }; }
      const response = data as unknown as MFAVerificationResponse;
      if (response?.success) {
        setMfaToken(response.verification_token); setHasMfaVerification(true);
        toast({ title: "MFA Required", description: `Verification token generated. Valid for ${response.expires_in_minutes} minutes.` });
        return { success: true, verification_token: response.verification_token, expires_in_minutes: response.expires_in_minutes };
      }
      return { success: false, error: 'Failed to generate MFA verification' };
    } catch (error) { console.error('MFA generation error:', error); return { success: false, error: 'Network error during MFA generation' }; }
    finally { setIsLoading(false); }
  }, [toast]);

  const verifyMfaToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { data, error } = await ibmDb.rpc('verify_role_change_mfa', { p_token: token });
      if (error) { console.error('MFA verification error:', error); toast({ variant: "destructive", title: "MFA Verification Failed", description: "Invalid or expired verification token." }); return false; }
      if (data) { setHasMfaVerification(true); toast({ title: "MFA Verified", description: "Multi-factor authentication successful." }); return true; }
      return false;
    } catch (error) { console.error('MFA verification error:', error); toast({ variant: "destructive", title: "Verification Error", description: "Network error during MFA verification." }); return false; }
    finally { setIsLoading(false); }
  }, [toast]);

  const assignUserRole = useCallback(async (targetUserId: string, newRole: UserRole, reason: string = 'Role assignment', mfaVerified: boolean = false): Promise<RoleAssignmentResult> => {
    try {
      setIsLoading(true);
      const { data, error } = await ibmDb.rpc('assign_user_role', { p_target_user_id: targetUserId, p_new_role: newRole, p_reason: reason, p_mfa_verified: mfaVerified });
      if (error) { console.error('Role assignment error:', error); toast({ variant: "destructive", title: "Role Assignment Failed", description: error.message }); return { success: false, error: error.message }; }
      const response = data as unknown as RoleAssignmentResponse;
      if (response?.success) { toast({ title: "Role Assigned", description: response.message || 'Role assigned successfully' }); setHasMfaVerification(false); setMfaToken(''); return { success: true, message: response.message }; }
      if (response?.error) { toast({ variant: "destructive", title: "Assignment Failed", description: response.error }); return { success: false, error: response.error }; }
      return { success: false, error: 'Unknown error occurred' };
    } catch (error) { const errorMessage = 'Network error during role assignment'; toast({ variant: "destructive", title: "Assignment Error", description: errorMessage }); return { success: false, error: errorMessage }; }
    finally { setIsLoading(false); }
  }, [toast]);

  const revokeUserRole = useCallback(async (targetUserId: string, reason: string = 'Role revocation', mfaVerified: boolean = false): Promise<RoleAssignmentResult> => {
    try {
      setIsLoading(true);
      const { data, error } = await ibmDb.rpc('revoke_user_role', { p_target_user_id: targetUserId, p_reason: reason, p_mfa_verified: mfaVerified });
      if (error) { console.error('Role revocation error:', error); toast({ variant: "destructive", title: "Role Revocation Failed", description: error.message }); return { success: false, error: error.message }; }
      const response = data as unknown as RoleAssignmentResponse;
      if (response?.success) { toast({ title: "Role Revoked", description: response.message || 'Role revoked successfully' }); setHasMfaVerification(false); setMfaToken(''); return { success: true, message: response.message }; }
      if (response?.error) { toast({ variant: "destructive", title: "Revocation Failed", description: response.error }); return { success: false, error: response.error }; }
      return { success: false, error: 'Unknown error occurred' };
    } catch (error) { const errorMessage = 'Network error during role revocation'; toast({ variant: "destructive", title: "Revocation Error", description: errorMessage }); return { success: false, error: errorMessage }; }
    finally { setIsLoading(false); }
  }, [toast]);

  const resetMfaState = useCallback(() => { setHasMfaVerification(false); setMfaToken(''); }, []);

  return { isLoading, mfaToken, hasMfaVerification, generateMfaVerification, verifyMfaToken, assignUserRole, revokeUserRole, resetMfaState };
};

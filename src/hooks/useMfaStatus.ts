import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';

interface MfaStatus {
  mfa_setup_required: boolean;
  mfa_setup_completed: boolean;
  login_count: number;
  requires_immediate_setup: boolean;
  grace_logins_remaining: number;
}

export const useMfaStatus = (userId?: string) => {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkMfaStatus = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await ibmDb.rpc('check_mfa_requirement', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error checking MFA status:', error);
        throw error;
      }

      const statusData = data as unknown as MfaStatus;
      setMfaStatus(statusData);

      if (statusData.mfa_setup_required && !statusData.mfa_setup_completed && statusData.grace_logins_remaining > 0) {
        toast({
          title: "MFA Setup Reminder",
          description: `You have ${statusData.grace_logins_remaining} login${statusData.grace_logins_remaining === 1 ? '' : 's'} remaining before MFA setup is required.`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Failed to check MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMfaCompleted = async () => {
    if (!userId) return false;

    try {
      const { data, error } = await ibmDb.rpc('mark_mfa_completed', {
        p_user_id: userId
      });

      if (error) throw error;

      await checkMfaStatus();

      toast({
        title: "MFA Setup Complete",
        description: "Multi-factor authentication has been successfully configured.",
      });

      return data;
    } catch (error) {
      console.error('Failed to mark MFA as completed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete MFA setup.",
      });
      return false;
    }
  };

  useEffect(() => {
    checkMfaStatus();
  }, [userId]);

  return { mfaStatus, loading, checkMfaStatus, markMfaCompleted };
};

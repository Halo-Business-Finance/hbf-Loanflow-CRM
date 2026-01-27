import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SecureEmailTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_expired: boolean;
}

export const useSecureEmailAccounts = () => {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadEmailAccounts = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Use secure view that excludes OAuth tokens entirely
      const { data, error } = await supabase
        .from('email_accounts_secure' as any)
        .select('id, email_address, display_name, expires_at, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setEmailAccounts((data as unknown as EmailAccount[]) || []);
    } catch (error: any) {
      logger.error('Error loading email accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load email accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSecureTokens = async (emailAddress: string): Promise<SecureEmailTokens | null> => {
    if (!user) return null;

    try {
      // Use the new secure function that automatically decrypts tokens
      const { data, error } = await supabase.rpc('get_email_tokens_secure', {
        p_email_address: emailAddress
      });

      if (error) {
        throw error;
      }

      return data?.[0] || null;
    } catch (error: any) {
      logger.error('Error getting secure tokens');
      toast({
        title: "Security Error",
        description: "Failed to retrieve email tokens securely",
        variant: "destructive",
      });
      return null;
    }
  };

  const storeSecureTokens = async (
    emailAddress: string,
    displayName: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: string
  ) => {
    if (!user) throw new Error('Not authenticated');

    try {
      // Use the secure storage function that automatically encrypts tokens
      const { error } = await supabase.rpc('store_secure_email_tokens', {
        p_user_id: user.id,
        p_email_address: emailAddress,
        p_display_name: displayName,
        p_access_token: accessToken,
        p_refresh_token: refreshToken,
        p_expires_at: expiresAt
      });

      if (error) {
        throw error;
      }

      // Reload accounts to reflect changes
      await loadEmailAccounts();
      
      toast({
        title: "Success",
        description: "Email account connected securely",
      });
    } catch (error: any) {
      logger.error('Error storing secure tokens');
      toast({
        title: "Security Error",
        description: "Failed to store email tokens securely",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deactivateAccount = async (accountId: string) => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Use secure update that triggers audit logging
      const { error } = await supabase
        .from('email_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) {
        throw error;
      }

      // Reload accounts to reflect changes
      await loadEmailAccounts();
      
      toast({
        title: "Disconnected",
        description: "Email account disconnected securely",
      });
    } catch (error: any) {
      logger.error('Error deactivating account');
      toast({
        title: "Error",
        description: "Failed to disconnect account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadEmailAccounts();
    }
  }, [user]);

  return {
    emailAccounts,
    isLoading,
    loadEmailAccounts,
    getSecureTokens,
    storeSecureTokens,
    deactivateAccount,
  };
};
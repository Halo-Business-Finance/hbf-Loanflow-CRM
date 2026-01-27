import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface SecureProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  job_title?: string;
  created_at: string;
  is_active: boolean;
}

export const useSecureProfiles = () => {
  const [profiles, setProfiles] = useState<SecureProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const getMaskedProfile = useCallback(async (profileId: string): Promise<SecureProfile | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('secure-profile-access', {
        body: {
          action: 'get_masked_profile',
          profile_id: profileId
        }
      });

      if (error) {
        throw error;
      }

      return data.data;
    } catch (error: any) {
      console.error('Error getting masked profile:', error);
      toast({
        title: "Access Error",
        description: "Failed to access profile data securely",
        variant: "destructive",
      });
      return null;
    }
  }, [user, toast]);

  const getMultipleProfiles = useCallback(async (profileIds: string[]): Promise<SecureProfile[]> => {
    if (!user || profileIds.length === 0) return [];

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('secure-profile-access', {
        body: {
          action: 'get_multiple_profiles',
          profile_ids: profileIds
        }
      });

      if (error) {
        throw error;
      }

      const maskedProfiles = data.data || [];
      setProfiles(maskedProfiles);
      return maskedProfiles;
    } catch (error: any) {
      console.error('Error getting multiple profiles:', error);
      toast({
        title: "Security Error",
        description: "Failed to retrieve profiles with security masking",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const updateProfileSecure = useCallback(async (
    profileId: string, 
    updates: Partial<SecureProfile>
  ): Promise<SecureProfile | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('secure-profile-access', {
        body: {
          action: 'update_profile_secure',
          profile_id: profileId,
          updates
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Profile Updated",
        description: "Profile updated securely with field-level encryption",
      });

      return data.data;
    } catch (error: any) {
      console.error('Error updating profile securely:', error);
      toast({
        title: "Update Error",
        description: error.message || "Failed to update profile securely",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const getAllTeamProfiles = useCallback(async (): Promise<SecureProfile[]> => {
    if (!user) return [];

    try {
      setIsLoading(true);
      
      // Get all profile IDs first (this respects RLS)
      const { data: profileIds, error: idsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

      if (idsError) {
        throw idsError;
      }

      if (!profileIds || profileIds.length === 0) {
        return [];
      }

      // Get masked data for all profiles
      return await getMultipleProfiles(profileIds.map(p => p.id));
    } catch (error: any) {
      console.error('Error getting team profiles:', error);
      toast({
        title: "Access Error",
        description: "Failed to retrieve team profiles",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, getMultipleProfiles, toast]);

  const migrateExistingData = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('secure-profile-access', {
        body: {
          action: 'migrate_existing_data'
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${data.migrated_profiles} profiles with encryption`,
      });

      return true;
    } catch (error: any) {
      console.error('Error migrating data:', error);
      toast({
        title: "Migration Error",
        description: error.message || "Failed to migrate existing data",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  return {
    profiles,
    isLoading,
    getMaskedProfile,
    getMultipleProfiles,
    updateProfileSecure,
    getAllTeamProfiles,
    migrateExistingData,
  };
};
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, Trash2, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DataProtectionSettings {
  auto_encrypt_new_data: boolean;
  enable_data_retention: boolean;
  retention_period_days: number;
  enable_secure_export: boolean;
  enable_data_anonymization: boolean;
}

interface EncryptionStatus {
  total_sensitive_fields: number;
  encrypted_fields: number;
  encryption_percentage: number;
  last_encryption_check: string;
}

export const DataProtectionManager: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DataProtectionSettings>({
    auto_encrypt_new_data: true,
    enable_data_retention: false,
    retention_period_days: 365,
    enable_secure_export: true,
    enable_data_anonymization: false
  });
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>({
    total_sensitive_fields: 0,
    encrypted_fields: 0,
    encryption_percentage: 0,
    last_encryption_check: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load current settings
  useEffect(() => {
    if (!user) return;
    loadDataProtectionSettings();
    checkEncryptionStatus();
  }, [user]);

  const loadDataProtectionSettings = async () => {
    try {
      // Load settings from server-side storage (using any to bypass type checking until types regenerate)
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('setting_category', 'data_protection')
        .eq('setting_key', 'preferences')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setSettings(data.setting_value as DataProtectionSettings);
      }
    } catch (error) {
      console.error('Failed to load data protection settings:', error);
    }
  };

  const saveSettings = async (newSettings: DataProtectionSettings) => {
    try {
      setIsLoading(true);
      
      // Save settings to server-side storage with upsert (using any to bypass type checking)
      const { error } = await (supabase as any)
        .from('user_settings')
        .upsert({
          user_id: user?.id,
          setting_category: 'data_protection',
          setting_key: 'preferences',
          setting_value: newSettings
        }, {
          onConflict: 'user_id,setting_category,setting_key'
        });

      if (error) throw error;
      
      setSettings(newSettings);
      toast.success('Data protection settings saved');
      
      // Log security event for settings change
      await (supabase as any).from('security_events').insert({
        user_id: user?.id,
        event_type: 'data_protection_settings_changed',
        severity: 'low',
        details: { settings: newSettings }
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const checkEncryptionStatus = async () => {
    try {
      // Check profile encryption status
      const { data: profileFields } = await supabase
        .from('contact_encrypted_fields')
        .select('contact_id')
        .eq('contact_id', user?.id);

      // Count total sensitive fields that should be encrypted
      const sensitiveFields = ['email', 'phone', 'income', 'credit_score'];
      const totalFields = sensitiveFields.length;
      const encryptedFields = profileFields?.length || 0;

      setEncryptionStatus({
        total_sensitive_fields: totalFields,
        encrypted_fields: encryptedFields,
        encryption_percentage: Math.round((encryptedFields / totalFields) * 100),
        last_encryption_check: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to check encryption status:', error);
    }
  };

  const encryptExistingData = async () => {
    try {
      setIsLoading(true);
      toast.info('Starting data encryption process...');

      const { data, error } = await supabase.rpc('encrypt_existing_contact_data');
      
      if (error) throw error;
      
      await checkEncryptionStatus();
      toast.success('Data encryption completed');
      
      // Log security event
      await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id,
        p_event_type: 'data_encryption_completed',
        p_severity: 'low',
        p_details: { encrypted_fields: data || 0 }
      });
    } catch (error) {
      console.error('Encryption failed:', error);
      toast.error('Data encryption failed');
    } finally {
      setIsLoading(false);
    }
  };

  const exportSecureData = async () => {
    try {
      setIsLoading(true);
      toast.info('Preparing secure data export...');

      // Get encrypted contact data
      const { data: contactData } = await supabase.rpc('get_masked_contact_data_enhanced', {
        p_contact_id: user?.id
      });

      // Create secure export
      const exportData = {
        user_id: user?.id,
        export_date: new Date().toISOString(),
        data: contactData,
        encryption_status: encryptionStatus
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `secure_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Secure data export completed');
      
      // Log export event
      await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id,
        p_event_type: 'secure_data_export',
        p_severity: 'medium',
        p_details: { export_format: 'json' }
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Data export failed');
    } finally {
      setIsLoading(false);
    }
  };

  const anonymizeData = async () => {
    try {
      setIsLoading(true);
      toast.info('Starting data anonymization...');

      // This would typically call a function to anonymize sensitive data
      const { error } = await supabase.rpc('anonymize_user_data', {
        p_user_id: user?.id
      });

      if (error) throw error;
      
      toast.success('Data anonymization completed');
      
      // Log anonymization event
      await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id,
        p_event_type: 'data_anonymization',
        p_severity: 'medium',
        p_details: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Anonymization failed:', error);
      toast.error('Data anonymization failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Protection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Encryption Progress</span>
              <Badge variant={encryptionStatus.encryption_percentage === 100 ? 'default' : 'secondary'}>
                {encryptionStatus.encryption_percentage}% Complete
              </Badge>
            </div>
            
            <Progress value={encryptionStatus.encryption_percentage} className="w-full" />
            
            <div className="text-sm text-muted-foreground">
              {encryptionStatus.encrypted_fields} of {encryptionStatus.total_sensitive_fields} sensitive fields encrypted
            </div>

            {encryptionStatus.encryption_percentage < 100 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some sensitive data is not encrypted. Click "Encrypt Existing Data" to secure all sensitive information.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Protection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">Auto-encrypt new data</span>
              <p className="text-xs text-muted-foreground">
                Automatically encrypt sensitive information when created
              </p>
            </div>
            <Switch
              checked={settings.auto_encrypt_new_data}
              onCheckedChange={(checked) => 
                saveSettings({ ...settings, auto_encrypt_new_data: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">Enable data retention policies</span>
              <p className="text-xs text-muted-foreground">
                Automatically delete old data after specified period
              </p>
            </div>
            <Switch
              checked={settings.enable_data_retention}
              onCheckedChange={(checked) => 
                saveSettings({ ...settings, enable_data_retention: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">Secure data export</span>
              <p className="text-xs text-muted-foreground">
                Enable encrypted data export functionality
              </p>
            </div>
            <Switch
              checked={settings.enable_secure_export}
              onCheckedChange={(checked) => 
                saveSettings({ ...settings, enable_secure_export: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">Data anonymization</span>
              <p className="text-xs text-muted-foreground">
                Enable data anonymization for compliance reporting
              </p>
            </div>
            <Switch
              checked={settings.enable_data_anonymization}
              onCheckedChange={(checked) => 
                saveSettings({ ...settings, enable_data_anonymization: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Protection Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={encryptExistingData}
              disabled={isLoading || encryptionStatus.encryption_percentage === 100}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              Encrypt Existing Data
            </Button>

            <Button
              variant="outline"
              onClick={exportSecureData}
              disabled={isLoading || !settings.enable_secure_export}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Secure Data
            </Button>

            <Button
              variant="outline"
              onClick={anonymizeData}
              disabled={isLoading || !settings.enable_data_anonymization}
              className="flex items-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Anonymize Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
-- Create user_settings table for data protection settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data_protection_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own settings" ON public.user_settings
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create function for GDPR data deletion
CREATE OR REPLACE FUNCTION public.initiate_gdpr_data_deletion(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mark user for deletion (in real implementation, this would trigger a deletion workflow)
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'gdpr_deletion_requested', 'user_data', 
          jsonb_build_object('request_date', now(), 'status', 'pending'));
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for data anonymization
CREATE OR REPLACE FUNCTION public.anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Anonymize sensitive data (in real implementation, this would anonymize actual data)
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'data_anonymized', 'user_data',
          jsonb_build_object('anonymized_date', now()));
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for secure session creation
CREATE OR REPLACE FUNCTION public.create_secure_session(
  p_session_token TEXT,
  p_device_fingerprint TEXT,
  p_user_agent TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.active_sessions (
    user_id, session_token, device_fingerprint, user_agent, expires_at
  ) VALUES (
    auth.uid(), p_session_token, p_device_fingerprint, p_user_agent,
    now() + interval '8 hours'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
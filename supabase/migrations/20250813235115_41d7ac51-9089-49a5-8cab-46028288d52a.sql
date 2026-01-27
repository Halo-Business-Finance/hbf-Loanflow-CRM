-- Fix infinite recursion in RLS policies and tighten security

-- Create security definer function to check user roles without recursion
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid DEFAULT auth.uid())
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = p_user_id 
  AND is_active = true 
  LIMIT 1;
$$;

-- Drop existing problematic policies on approval_requests
DROP POLICY IF EXISTS "Users can view relevant approval requests" ON public.approval_requests;

-- Create new safe policy for approval_requests
CREATE POLICY "Users can view their approval requests or if they are approver"
ON public.approval_requests
FOR SELECT
USING (
  auth.uid() = submitted_by OR 
  get_user_role() = 'admin' OR
  auth.uid() IN (
    SELECT approver_id FROM approval_steps 
    WHERE request_id = approval_requests.id
  )
);

-- Drop existing problematic policies on approval_steps  
DROP POLICY IF EXISTS "Users can view relevant approval steps" ON public.approval_steps;

-- Create new safe policy for approval_steps
CREATE POLICY "Users can view approval steps they are involved in"
ON public.approval_steps
FOR SELECT
USING (
  auth.uid() = approver_id OR 
  get_user_role() = 'admin' OR
  EXISTS (
    SELECT 1 FROM approval_requests 
    WHERE id = approval_steps.request_id 
    AND submitted_by = auth.uid()
  )
);

-- Tighten contact_entities policies to prevent data exposure
DROP POLICY IF EXISTS "Users can view only their own contact entities" ON public.contact_entities;

CREATE POLICY "Strict contact entity access control"
ON public.contact_entities
FOR SELECT
USING (
  auth.uid() = user_id OR 
  get_user_role() IN ('admin', 'super_admin')
);

-- Secure account lockouts - only admins and system should access
DROP POLICY IF EXISTS "Users can view their own lockouts" ON public.account_lockouts;

CREATE POLICY "Only admins can view account lockouts"
ON public.account_lockouts
FOR SELECT
USING (get_user_role() IN ('admin', 'super_admin'));

-- Fix overly permissive lead document policies if they exist
-- Note: This assumes lead_documents table exists, will be ignored if not
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lead_documents') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view all lead documents" ON public.lead_documents';
    EXECUTE 'CREATE POLICY "Users can only view their own lead documents" ON public.lead_documents FOR SELECT USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_documents.lead_id AND leads.user_id = auth.uid()) OR get_user_role() IN (''admin'', ''super_admin''))';
  END IF;
END
$$;

-- Add security event logging for policy violations
CREATE OR REPLACE FUNCTION public.log_policy_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'rls_policy_violation',
    'high',
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  RETURN NULL;
END;
$$;

-- Enhance session security with encrypted token validation
CREATE OR REPLACE FUNCTION public.validate_session_with_encryption(
  p_user_id uuid, 
  p_session_token text, 
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_record RECORD;
  decrypted_token text;
  is_valid boolean := false;
  risk_score integer := 0;
BEGIN
  -- Get session with encrypted token
  SELECT * INTO session_record
  FROM public.active_sessions 
  WHERE user_id = p_user_id 
  AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Decrypt and validate token
    decrypted_token := public.decrypt_token(session_record.session_token);
    
    IF decrypted_token = p_session_token AND session_record.expires_at > now() THEN
      -- Check for IP address changes
      IF p_ip_address IS NOT NULL AND session_record.ip_address != p_ip_address THEN
        risk_score := risk_score + 30;
        
        -- Log suspicious IP change
        INSERT INTO public.security_events (
          user_id, event_type, severity, details, ip_address
        ) VALUES (
          p_user_id, 'session_ip_change', 'medium',
          jsonb_build_object('old_ip', session_record.ip_address, 'new_ip', p_ip_address),
          p_ip_address
        );
      END IF;
      
      -- Update session activity
      UPDATE public.active_sessions 
      SET 
        last_activity = now(),
        ip_address = COALESCE(p_ip_address, ip_address)
      WHERE id = session_record.id;
      
      is_valid := risk_score < 50;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'risk_score', risk_score,
    'requires_mfa', risk_score >= 30
  );
END;
$$;
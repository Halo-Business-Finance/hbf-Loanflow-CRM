-- Create table to track MFA setup requirements and login attempts
CREATE TABLE IF NOT EXISTS public.user_mfa_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_setup_required BOOLEAN NOT NULL DEFAULT true,
  mfa_setup_completed BOOLEAN NOT NULL DEFAULT false,
  login_count_since_required INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP WITH TIME ZONE,
  mfa_required_since TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mfa_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_mfa_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own MFA status
CREATE POLICY "Users can view own MFA status"
ON public.user_mfa_status
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own MFA status
CREATE POLICY "Users can update own MFA status"
ON public.user_mfa_status
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can insert MFA status
CREATE POLICY "System can insert MFA status"
ON public.user_mfa_status
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all MFA status
CREATE POLICY "Admins can view all MFA status"
ON public.user_mfa_status
FOR SELECT
TO authenticated
USING (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role));

-- Function to initialize MFA status for new users
CREATE OR REPLACE FUNCTION public.initialize_user_mfa_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_mfa_status (
    user_id,
    mfa_setup_required,
    mfa_setup_completed,
    login_count_since_required
  ) VALUES (
    NEW.id,
    true,
    false,
    0
  );
  RETURN NEW;
END;
$$;

-- Trigger to initialize MFA status when user is created
DROP TRIGGER IF EXISTS on_user_created_mfa_status ON auth.users;
CREATE TRIGGER on_user_created_mfa_status
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_mfa_status();

-- Function to reset MFA requirement when role changes
CREATE OR REPLACE FUNCTION public.reset_mfa_on_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only reset if role actually changed and it's an admin or super_admin role
  IF (OLD.role IS DISTINCT FROM NEW.role) AND 
     (NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin')) THEN
    
    UPDATE public.user_mfa_status
    SET 
      mfa_setup_required = true,
      login_count_since_required = 0,
      mfa_required_since = now(),
      updated_at = now()
    WHERE user_id = NEW.user_id;
    
    -- Log the MFA reset
    INSERT INTO public.security_events (
      user_id,
      event_type,
      severity,
      details
    ) VALUES (
      NEW.user_id,
      'mfa_reset_role_change',
      'medium',
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'changed_by', auth.uid()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to reset MFA requirement on role changes
DROP TRIGGER IF EXISTS on_role_change_reset_mfa ON public.user_roles;
CREATE TRIGGER on_role_change_reset_mfa
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_mfa_on_role_change();

-- Function to increment login count and check MFA requirement
CREATE OR REPLACE FUNCTION public.check_mfa_requirement(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mfa_status RECORD;
  v_requires_setup BOOLEAN := false;
  v_login_count INTEGER := 0;
BEGIN
  -- Get current MFA status
  SELECT * INTO v_mfa_status
  FROM public.user_mfa_status
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_mfa_status (user_id, mfa_setup_required, login_count_since_required)
    VALUES (p_user_id, true, 1)
    RETURNING * INTO v_mfa_status;
    
    v_login_count := 1;
  ELSE
    -- Increment login count if MFA is required but not completed
    IF v_mfa_status.mfa_setup_required AND NOT v_mfa_status.mfa_setup_completed THEN
      UPDATE public.user_mfa_status
      SET 
        login_count_since_required = login_count_since_required + 1,
        last_login_at = now(),
        updated_at = now()
      WHERE user_id = p_user_id
      RETURNING login_count_since_required INTO v_login_count;
    ELSE
      -- Just update last login
      UPDATE public.user_mfa_status
      SET last_login_at = now(), updated_at = now()
      WHERE user_id = p_user_id;
      
      v_login_count := v_mfa_status.login_count_since_required;
    END IF;
  END IF;
  
  -- Check if user needs to set up MFA (after 3 logins)
  v_requires_setup := v_mfa_status.mfa_setup_required 
                      AND NOT v_mfa_status.mfa_setup_completed 
                      AND v_login_count > 3;
  
  -- Log the login attempt
  INSERT INTO public.security_events (
    user_id,
    event_type,
    severity,
    details
  ) VALUES (
    p_user_id,
    CASE 
      WHEN v_requires_setup THEN 'mfa_setup_required'
      ELSE 'login_with_mfa_grace_period'
    END,
    CASE 
      WHEN v_requires_setup THEN 'high'
      ELSE 'low'
    END,
    jsonb_build_object(
      'login_count', v_login_count,
      'grace_period_remaining', GREATEST(0, 3 - v_login_count),
      'mfa_required', v_requires_setup
    )
  );
  
  RETURN jsonb_build_object(
    'mfa_setup_required', v_mfa_status.mfa_setup_required,
    'mfa_setup_completed', v_mfa_status.mfa_setup_completed,
    'login_count', v_login_count,
    'requires_immediate_setup', v_requires_setup,
    'grace_logins_remaining', GREATEST(0, 3 - v_login_count)
  );
END;
$$;

-- Function to mark MFA as completed
CREATE OR REPLACE FUNCTION public.mark_mfa_completed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_mfa_status
  SET 
    mfa_setup_completed = true,
    mfa_setup_required = false,
    mfa_completed_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log MFA completion
  INSERT INTO public.security_events (
    user_id,
    event_type,
    severity,
    details
  ) VALUES (
    p_user_id,
    'mfa_setup_completed',
    'low',
    jsonb_build_object(
      'completed_at', now()
    )
  );
  
  RETURN true;
END;
$$;
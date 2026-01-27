-- Phase 1: Add email and phone verification tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone_verification_code TEXT,
ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verification_attempts INTEGER DEFAULT 0;

-- Create function to check if user's email is verified
CREATE OR REPLACE FUNCTION public.is_email_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_confirmed_at TIMESTAMPTZ;
  v_email_verified_at TIMESTAMPTZ;
BEGIN
  -- Check auth.users for email_confirmed_at
  SELECT email_confirmed_at INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Check profiles for email_verified_at
  SELECT email_verified_at INTO v_email_verified_at
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Return true if either is set
  RETURN (v_email_confirmed_at IS NOT NULL OR v_email_verified_at IS NOT NULL);
END;
$$;

-- Create function to update email verification status when user confirms email
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When email_confirmed_at is set in auth.users, update profiles
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET email_verified_at = NEW.email_confirmed_at
    WHERE id = NEW.id AND email_verified_at IS NULL;
    
    -- Log verification event
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      NEW.id,
      'email_verified',
      'low',
      jsonb_build_object(
        'verified_at', NEW.email_confirmed_at,
        'email', NEW.email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync email verification from auth.users to profiles
DROP TRIGGER IF EXISTS sync_email_verification_trigger ON auth.users;
CREATE TRIGGER sync_email_verification_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verification();

-- Create function to generate phone verification code
CREATE OR REPLACE FUNCTION public.generate_phone_verification_code(p_user_id UUID, p_phone_number TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Update profile with code and expiration (10 minutes)
  UPDATE public.profiles
  SET 
    phone_number = p_phone_number,
    phone_verification_code = v_code,
    phone_verification_expires_at = NOW() + INTERVAL '10 minutes',
    phone_verification_attempts = 0
  WHERE id = p_user_id;
  
  -- Log code generation
  INSERT INTO public.security_events (user_id, event_type, severity, details)
  VALUES (
    p_user_id,
    'phone_verification_code_generated',
    'low',
    jsonb_build_object(
      'phone_number', p_phone_number,
      'expires_at', NOW() + INTERVAL '10 minutes'
    )
  );
  
  RETURN v_code;
END;
$$;

-- Create function to verify phone code
CREATE OR REPLACE FUNCTION public.verify_phone_code(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Get profile with verification details
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Check if code exists
  IF v_profile.phone_verification_code IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No verification code generated'
    );
  END IF;
  
  -- Check if code expired
  IF v_profile.phone_verification_expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Verification code expired'
    );
  END IF;
  
  -- Check attempt limit
  IF v_profile.phone_verification_attempts >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum verification attempts exceeded'
    );
  END IF;
  
  -- Verify code
  IF v_profile.phone_verification_code = p_code THEN
    -- Success - mark as verified
    UPDATE public.profiles
    SET 
      phone_verified_at = NOW(),
      phone_verification_code = NULL,
      phone_verification_expires_at = NULL,
      phone_verification_attempts = 0
    WHERE id = p_user_id;
    
    -- Log successful verification
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      p_user_id,
      'phone_verified',
      'low',
      jsonb_build_object(
        'phone_number', v_profile.phone_number,
        'verified_at', NOW()
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone number verified successfully'
    );
  ELSE
    -- Failed attempt
    UPDATE public.profiles
    SET phone_verification_attempts = phone_verification_attempts + 1
    WHERE id = p_user_id;
    
    -- Log failed attempt
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      p_user_id,
      'phone_verification_failed',
      'medium',
      jsonb_build_object(
        'attempts', v_profile.phone_verification_attempts + 1
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid verification code',
      'attempts_remaining', 3 - (v_profile.phone_verification_attempts + 1)
    );
  END IF;
END;
$$;
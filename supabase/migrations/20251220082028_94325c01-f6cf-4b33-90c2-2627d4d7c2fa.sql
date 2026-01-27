-- Fix SECURITY DEFINER functions without SET search_path = ''
-- This migration adds search_path protection to prevent SQL injection attacks

-- Fix update_lenders_updated_at
CREATE OR REPLACE FUNCTION public.update_lenders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_lender_contacts_updated_at
CREATE OR REPLACE FUNCTION public.update_lender_contacts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix increment_template_usage
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  UPDATE public.document_templates
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = template_id;
END;
$function$;

-- Fix update_support_tickets_updated_at
CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix log_loan_request_admin_access
CREATE OR REPLACE FUNCTION public.log_loan_request_admin_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF public.has_role('super_admin'::public.user_role) THEN
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      auth.uid(),
      'super_admin_loan_access',
      'critical',
      jsonb_build_object(
        'loan_request_id', COALESCE(NEW.id, OLD.id),
        'operation', TG_OP,
        'timestamp', now()
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_sensitive_contact_access
CREATE OR REPLACE FUNCTION public.log_sensitive_contact_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF public.has_role('super_admin'::public.user_role) AND auth.uid() != NEW.user_id THEN
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      auth.uid(),
      'sensitive_contact_accessed',
      'high',
      jsonb_build_object(
        'contact_id', NEW.id,
        'contact_owner', NEW.user_id,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix initialize_user_mfa_status
CREATE OR REPLACE FUNCTION public.initialize_user_mfa_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;

-- Fix reset_mfa_on_role_change
CREATE OR REPLACE FUNCTION public.reset_mfa_on_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) AND 
     (NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin')) THEN
    
    UPDATE public.user_mfa_status
    SET 
      mfa_setup_required = true,
      login_count_since_required = 0,
      mfa_required_since = now(),
      updated_at = now()
    WHERE user_id = NEW.user_id;
    
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
$function$;

-- Fix get_accessible_leads
CREATE OR REPLACE FUNCTION public.get_accessible_leads()
 RETURNS SETOF public.leads
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT l.*
  FROM public.leads l
  WHERE l.user_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','viewer']::public.user_role[]);
$function$;

-- Fix log_mfa_admin_modification
CREATE OR REPLACE FUNCTION public.log_mfa_admin_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF public.has_role('super_admin'::public.user_role) AND auth.uid() != COALESCE(NEW.user_id, OLD.user_id) THEN
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      auth.uid(),
      'super_admin_mfa_modification',
      'critical',
      jsonb_build_object(
        'target_user_id', COALESCE(NEW.user_id, OLD.user_id),
        'operation', TG_OP,
        'timestamp', now(),
        'warning', 'MFA secret modification by super admin - requires incident ticket'
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_case_creation
CREATE OR REPLACE FUNCTION public.log_case_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.security_events (user_id, event_type, severity, details)
  VALUES (
    auth.uid(),
    'case_created',
    'low',
    jsonb_build_object(
      'case_id', NEW.id,
      'case_number', NEW.case_number,
      'client_id', NEW.client_id,
      'priority', NEW.priority,
      'case_type', NEW.case_type
    )
  );
  RETURN NEW;
END;
$function$;

-- Fix cleanup_expired_session_data
CREATE OR REPLACE FUNCTION public.cleanup_expired_session_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.secure_session_data
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '1 day';
END;
$function$;

-- Fix has_any_role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.user_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = any(_roles)
  );
$function$;

-- Fix set_lead_assigned_at
CREATE OR REPLACE FUNCTION public.set_lead_assigned_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.assigned_at = NOW();
  END IF;
  
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NOT NULL AND OLD.user_id != NEW.user_id THEN
    NEW.assigned_at = NOW();
  END IF;
  
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.assigned_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix log_unassigned_lead_access
CREATE OR REPLACE FUNCTION public.log_unassigned_lead_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_id IS NULL AND (
    public.has_role(auth.uid(), 'admin'::public.user_role) OR 
    public.has_role(auth.uid(), 'manager'::public.user_role) OR
    public.has_role(auth.uid(), 'super_admin'::public.user_role)
  ) THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      risk_score
    ) VALUES (
      auth.uid(),
      'VIEWED_UNASSIGNED_LEAD',
      'leads',
      NEW.id::text,
      30
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix log_sensitive_partner_changes
CREATE OR REPLACE FUNCTION public.log_sensitive_partner_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    risk_score
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    50
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_sensitive_data_modification
CREATE OR REPLACE FUNCTION public.log_sensitive_data_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    ip_address,
    risk_score,
    old_values,
    new_values
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    auth.uid(),
    inet_client_addr(),
    CASE 
      WHEN TG_TABLE_NAME IN ('contact_entities', 'lead_documents') THEN 50
      WHEN TG_TABLE_NAME = 'profiles' THEN 30
      ELSE 10
    END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix get_lead_counts
CREATE OR REPLACE FUNCTION public.get_lead_counts()
 RETURNS TABLE(user_id uuid, lead_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT p.id AS user_id, COALESCE(COUNT(l.id)::integer, 0) AS lead_count
  FROM public.profiles p
  LEFT JOIN public.leads l ON l.user_id = p.id
  WHERE p.is_active = true
  GROUP BY p.id
$function$;

-- Fix assign_user_number
CREATE OR REPLACE FUNCTION public.assign_user_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('public.user_number_seq');
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix create_initial_document_version
CREATE OR REPLACE FUNCTION public.create_initial_document_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.document_versions (
    document_id,
    version_number,
    file_path,
    file_size,
    file_mime_type,
    uploaded_by,
    is_current
  ) VALUES (
    NEW.id,
    1,
    NEW.file_path,
    NEW.file_size,
    NEW.file_mime_type,
    NEW.user_id,
    true
  );

  RETURN NEW;
END;
$function$;

-- Fix log_sensitive_field_access
CREATE OR REPLACE FUNCTION public.log_sensitive_field_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF (OLD.email IS DISTINCT FROM NEW.email) OR 
     (OLD.phone_number IS DISTINCT FROM NEW.phone_number) THEN
    INSERT INTO public.security_events (
      user_id,
      event_type,
      severity,
      details,
      ip_address
    ) VALUES (
      auth.uid(),
      'sensitive_field_update',
      'medium',
      jsonb_build_object(
        'profile_id', NEW.id,
        'fields_changed', ARRAY['email', 'phone_number'],
        'timestamp', now()
      ),
      inet_client_addr()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
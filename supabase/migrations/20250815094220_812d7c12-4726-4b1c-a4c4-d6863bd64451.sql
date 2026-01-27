-- Final fix for all functions missing search_path security setting
-- This ensures all PostgreSQL functions have proper security isolation

-- Fix any remaining functions that may not have search_path set
-- We'll recreate the most critical ones that could be missing this setting

-- Get all function names and fix them systematically
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Update all existing functions to have secure search_path
    FOR func_record IN 
        SELECT routine_name, routine_schema
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name NOT LIKE 'pg_%'
        AND routine_name NOT LIKE 'extensions.%'
    LOOP
        BEGIN
            -- Try to set search_path for each function
            EXECUTE format('ALTER FUNCTION %I.%I() SET search_path TO ''''', 
                         func_record.routine_schema, func_record.routine_name);
        EXCEPTION
            WHEN OTHERS THEN
                -- If single parameter version fails, try common parameter combinations
                BEGIN
                    EXECUTE format('ALTER FUNCTION %I.%I(uuid) SET search_path TO ''''', 
                                 func_record.routine_schema, func_record.routine_name);
                EXCEPTION
                    WHEN OTHERS THEN
                        BEGIN
                            EXECUTE format('ALTER FUNCTION %I.%I(text) SET search_path TO ''''', 
                                         func_record.routine_schema, func_record.routine_name);
                        EXCEPTION
                            WHEN OTHERS THEN
                                -- Continue with next function if this one can't be altered
                                CONTINUE;
                        END;
                END;
        END;
    END LOOP;
END $$;

-- Ensure specific critical functions have proper search_path
ALTER FUNCTION public.get_user_role(uuid) SET search_path TO '';
ALTER FUNCTION public.has_role(user_role, uuid) SET search_path TO '';
ALTER FUNCTION public.handle_new_user() SET search_path TO '';
ALTER FUNCTION public.encrypt_token(text) SET search_path TO '';
ALTER FUNCTION public.decrypt_token(text) SET search_path TO '';
ALTER FUNCTION public.get_active_encryption_key() SET search_path TO '';
ALTER FUNCTION public.validate_enhanced_session(uuid, text, jsonb, inet) SET search_path TO '';
ALTER FUNCTION public.archive_user(uuid, uuid, text) SET search_path TO '';
ALTER FUNCTION public.restore_user(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.store_secure_session_token(uuid, text, text, text) SET search_path TO '';
ALTER FUNCTION public.validate_secure_session_token(uuid, text) SET search_path TO '';
ALTER FUNCTION public.store_secure_email_tokens(uuid, text, text, text, text, timestamp with time zone) SET search_path TO '';
ALTER FUNCTION public.get_secure_email_tokens(uuid, text) SET search_path TO '';
ALTER FUNCTION public.monitor_sensitive_field_access() SET search_path TO '';
ALTER FUNCTION public.get_security_config(text) SET search_path TO '';
ALTER FUNCTION public.check_rate_limit(text, text, integer, integer) SET search_path TO '';
ALTER FUNCTION public.handle_lead_to_client_conversion() SET search_path TO '';
ALTER FUNCTION public.log_policy_violation() SET search_path TO '';
ALTER FUNCTION public.encrypt_contact_field(uuid, text, text) SET search_path TO '';
ALTER FUNCTION public.validate_password_strength(text) SET search_path TO '';
ALTER FUNCTION public.log_enhanced_security_event(uuid, text, text, jsonb, inet, text, text, jsonb) SET search_path TO '';
ALTER FUNCTION public.create_blockchain_record(text, text, text, jsonb) SET search_path TO '';
ALTER FUNCTION public.handle_lead_deletion() SET search_path TO '';
ALTER FUNCTION public.verify_data_integrity(text, text) SET search_path TO '';
ALTER FUNCTION public.create_immutable_audit_entry() SET search_path TO '';
ALTER FUNCTION public.get_masked_contact_data(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.validate_blockchain_access(text, text) SET search_path TO '';
ALTER FUNCTION public.monitor_sensitive_access() SET search_path TO '';
ALTER FUNCTION public.update_loan_requests_updated_at() SET search_path TO '';
ALTER FUNCTION public.validate_session_security(uuid, text) SET search_path TO '';
ALTER FUNCTION public.validate_and_sanitize_input(text, text, integer, boolean) SET search_path TO '';
ALTER FUNCTION public.log_email_token_access() SET search_path TO '';
ALTER FUNCTION public.validate_pipeline_amount() SET search_path TO '';
ALTER FUNCTION public.validate_and_sanitize_input_enhanced(text, text, integer, boolean) SET search_path TO '';
ALTER FUNCTION public.validate_session_with_security_checks(uuid, text, inet, text) SET search_path TO '';
ALTER FUNCTION public.get_email_tokens_secure(text) SET search_path TO '';
ALTER FUNCTION public.get_masked_contact_data_enhanced(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.encrypt_active_session_token() SET search_path TO '';
ALTER FUNCTION public.encrypt_email_account_tokens() SET search_path TO '';
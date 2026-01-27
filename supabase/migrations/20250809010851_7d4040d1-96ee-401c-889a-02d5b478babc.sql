-- 1) Make lead-documents bucket private
update storage.buckets set public = false where id = 'lead-documents';

-- 2) Storage RLS policies for lead-documents bucket using user-id/lead-id/filename path
-- Allow users to read their own files
create policy if not exists "Lead docs: users can read own" on storage.objects
for select
using (
  bucket_id = 'lead-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to upload into their own folder
create policy if not exists "Lead docs: users can upload to own" on storage.objects
for insert
with check (
  bucket_id = 'lead-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
create policy if not exists "Lead docs: users can update own" on storage.objects
for update
using (
  bucket_id = 'lead-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'lead-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
create policy if not exists "Lead docs: users can delete own" on storage.objects
for delete
using (
  bucket_id = 'lead-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Strengthen session validation to support encrypted tokens too
create or replace function public.validate_session_with_security_checks(
  p_user_id uuid,
  p_session_token text,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_record record;
  config_record record;
  is_valid boolean := false;
  reason text := 'Session validation failed';
  risk_score integer := 0;
  security_flags jsonb := '[]'::jsonb;
begin
  -- Get session config
  select * into config_record from public.session_config limit 1;
  
  -- Get active session; support plaintext or encrypted storage of token
  select * into session_record
  from public.active_sessions
  where user_id = p_user_id 
    and is_active = true
    and (
      session_token = p_session_token
      or public.decrypt_token(session_token) = p_session_token
    )
  limit 1;
  
  if found then
    -- Check if session has expired
    if session_record.expires_at > now() then
      -- Check if last activity is within timeout
      if session_record.last_activity > (now() - interval '1 minute' * config_record.session_timeout_minutes) then
        -- Additional security checks
        if p_ip_address is not null and session_record.ip_address is not null 
           and session_record.ip_address != p_ip_address then
          risk_score := risk_score + 30;
          security_flags := security_flags || '"ip_change"'::jsonb;
        end if;
        
        if p_user_agent is not null and session_record.user_agent is not null 
           and session_record.user_agent != p_user_agent then
          risk_score := risk_score + 20;
          security_flags := security_flags || '"user_agent_change"'::jsonb;
        end if;
        
        if session_record.last_activity < (now() - interval '1 hour') then
          risk_score := risk_score + 10;
          security_flags := security_flags || '"long_inactive"'::jsonb;
        end if;
        
        if risk_score < 50 then
          is_valid := true;
          reason := 'Session valid';
          
          -- Update last activity and security info
          update public.active_sessions 
          set 
            last_activity = now(),
            ip_address = coalesce(p_ip_address, ip_address),
            user_agent = coalesce(p_user_agent, user_agent)
          where id = session_record.id;
        else
          reason := 'Session flagged for suspicious activity';
          insert into public.security_events (user_id, event_type, severity, details, ip_address, user_agent)
          values (p_user_id, 'suspicious_session_activity', 'medium', 
                  jsonb_build_object('risk_score', risk_score, 'flags', security_flags),
                  p_ip_address, p_user_agent);
        end if;
      else
        reason := 'Session timeout due to inactivity';
        update public.active_sessions set is_active = false where id = session_record.id;
      end if;
    else
      reason := 'Session expired';
      update public.active_sessions set is_active = false where id = session_record.id;
    end if;
  else
    reason := 'Session not found or inactive';
  end if;
  
  insert into public.audit_logs (user_id, action, table_name, new_values)
  values (p_user_id, 'session_validation', 'active_sessions',
          jsonb_build_object('valid', is_valid, 'reason', reason, 'risk_score', risk_score));
  
  return jsonb_build_object(
    'valid', is_valid,
    'reason', reason,
    'requires_reauth', not is_valid,
    'risk_score', risk_score,
    'security_flags', security_flags
  );
end;
$$;
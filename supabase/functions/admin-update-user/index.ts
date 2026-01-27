import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { validateName, validatePhone, validateText, validateUUID } from "../_shared/validation.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        }
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role using service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: rolesData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roleList = rolesData?.map((r: { role: string }) => r.role) || [];
    if (roleError || (!roleList.includes('admin') && !roleList.includes('super_admin'))) {
      // Log unauthorized attempt
      await supabaseClient.from('security_events').insert({
        user_id: user.id,
        event_type: 'unauthorized_admin_function_attempt',
        severity: 'high',
        details: { attempted_function: 'admin-update-user' }
      });
      return new Response(
        JSON.stringify({ error: 'Insufficient privileges' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, firstName, lastName, phone, city, state, isActive, mfa_token } = await req.json();

    // CRITICAL: MANDATORY MFA verification for user updates
    if (!mfa_token) {
      return new Response(
        JSON.stringify({ error: 'MFA token is required for user update operations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: mfaVerified, error: mfaError } = await supabaseClient.rpc('verify_mfa_for_operation', {
      p_user_id: user.id,
      p_mfa_token: mfa_token,
      p_operation_type: 'user_update'
    });

    if (mfaError || !mfaVerified) {
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'mfa_verification_failed',
        p_severity: 'high',
        p_details: { operation: 'user_update', admin_id: user.id, target_user: userId }
      });
      return new Response(
        JSON.stringify({ error: 'MFA verification failed. Please try again.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting for admin operations
    const rateLimit = await checkRateLimit(supabaseClient, user.id, RATE_LIMITS.ADMIN_UPDATE_USER);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error);
    }

    // CRITICAL: Validate and sanitize all user input
    const userIdValidation = validateUUID(userId, 'User ID');
    if (!userIdValidation.valid) {
      throw new Error(userIdValidation.error);
    }
    
    const firstNameValidation = validateName(firstName, 'First name');
    if (!firstNameValidation.valid) {
      throw new Error(firstNameValidation.error);
    }
    
    const lastNameValidation = validateName(lastName, 'Last name');
    if (!lastNameValidation.valid) {
      throw new Error(lastNameValidation.error);
    }
    
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error);
    }
    
    const cityValidation = validateText(city, 'City', 100);
    if (!cityValidation.valid) {
      throw new Error(cityValidation.error);
    }
    
    const stateValidation = validateText(state, 'State', 50);
    if (!stateValidation.valid) {
      throw new Error(stateValidation.error);
    }

    // Call the admin_update_profile database function with sanitized data
    const { data, error } = await supabaseClient.rpc('admin_update_profile', {
      p_user_id: userIdValidation.sanitized,
      p_first_name: firstNameValidation.sanitized || null,
      p_last_name: lastNameValidation.sanitized || null,
      p_phone: phoneValidation.sanitized || null,
      p_city: cityValidation.sanitized || null,
      p_state: stateValidation.sanitized || null,
      p_is_active: isActive !== undefined ? isActive : null,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
});

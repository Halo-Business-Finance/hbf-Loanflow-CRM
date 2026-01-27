import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validatePassword, validateUUID } from "../_shared/validation.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin privileges
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc('get_user_role', {
      p_user_id: user.id
    });

    if (roleError || !['admin', 'super_admin'].includes(roleData)) {
      throw new Error('Admin privileges required');
    }

    const { user_id, new_password, mfa_token } = await req.json();

    // CRITICAL: Validate user ID
    const userIdValidation = validateUUID(user_id, 'User ID');
    if (!userIdValidation.valid) {
      throw new Error(userIdValidation.error);
    }
    const sanitizedUserId = userIdValidation.sanitized;
    
    // CRITICAL: Validate password
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error);
    }

    // CRITICAL: Rate limiting for password resets
    const rateLimit = await checkRateLimit(supabaseAdmin, user.id, RATE_LIMITS.ADMIN_RESET_PASSWORD);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error);
    }

    // CRITICAL: MANDATORY MFA verification for password resets
    if (!mfa_token) {
      throw new Error('MFA token is required for password reset operations');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        }
      }
    );

    const { data: mfaVerified, error: mfaError } = await supabaseClient.rpc('verify_mfa_for_operation', {
      p_user_id: user.id,
      p_mfa_token: mfa_token,
      p_operation_type: 'password_reset'
    });

    if (mfaError || !mfaVerified) {
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'mfa_verification_failed',
        p_severity: 'high',
        p_details: { operation: 'password_reset', admin_id: user.id, target_user: sanitizedUserId }
      });
      throw new Error('MFA verification failed. Please try again.');
    }

    // Update user password using admin privileges
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(sanitizedUserId, {
      password: new_password
    });

    if (updateError) {
      throw updateError;
    }

    // Log the password reset action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_password_reset',
      table_name: 'auth.users',
      record_id: sanitizedUserId,
      new_values: { admin_reset: true, reset_by: user.id }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
});

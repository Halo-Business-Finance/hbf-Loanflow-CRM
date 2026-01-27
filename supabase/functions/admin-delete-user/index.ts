import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateUUID } from "../_shared/validation.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: rolesData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !rolesData || rolesData.length === 0) {
      throw new Error('Failed to verify admin access');
    }

    const roleList = rolesData.map((r: { role: string }) => r.role);

    if (!roleList.includes('admin') && !roleList.includes('super_admin')) {
      // Log unauthorized attempt
      await supabaseClient.from('security_events').insert({
        user_id: user.id,
        event_type: 'unauthorized_admin_function_attempt',
        severity: 'high',
        details: { attempted_function: 'admin-delete-user' }
      });
      throw new Error('Insufficient privileges');
    }

    // Get the target user ID and MFA token from request body
    const { userId, mfa_token } = await req.json();
    
    // CRITICAL: Validate user ID
    const userIdValidation = validateUUID(userId, 'User ID');
    if (!userIdValidation.valid) {
      throw new Error(userIdValidation.error);
    }
    const sanitizedUserId = userIdValidation.sanitized;
    
    // CRITICAL: Rate limiting for user deletion (extremely sensitive operation)
    const rateLimit = await checkRateLimit(supabaseClient, user.id, RATE_LIMITS.ADMIN_DELETE_USER);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error);
    }

    // CRITICAL: MANDATORY MFA verification for user deletion
    if (!mfa_token) {
      throw new Error('MFA token is required for user deletion operations');
    }

    const { data: mfaVerified, error: mfaError } = await supabaseClient.rpc('verify_mfa_for_operation', {
      p_user_id: user.id,
      p_mfa_token: mfa_token,
      p_operation_type: 'user_deletion'
    });

    if (mfaError || !mfaVerified) {
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'mfa_verification_failed',
        p_severity: 'high',
        p_details: { operation: 'user_deletion', admin_id: user.id, target_user: sanitizedUserId }
      });
      throw new Error('MFA verification failed. Please try again.');
    }

    // Prevent self-deletion
    if (sanitizedUserId === user.id) {
      throw new Error('Cannot delete your own account');
    }

    // Get user details before deletion for logging
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(sanitizedUserId);
    
    if (getUserError) {
      throw new Error('User not found');
    }

    // Delete the user using admin client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(sanitizedUserId);

    if (deleteError) {
      throw new Error('Failed to delete user');
    }

    // Log the deletion as a security event
    await supabaseClient.from('security_events').insert({
      user_id: user.id,
      event_type: 'user_permanently_deleted',
      severity: 'critical',
      details: {
        deleted_user_id: sanitizedUserId,
        deleted_user_email: targetUser.user?.email,
        deleted_by: user.email,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User permanently deleted'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateUserCreation } from "../_shared/validation.ts";
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

    // Extract the JWT token from the Authorization header
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

    // Set the session using the token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role (handle multiple roles)
    const { data: rolesData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !rolesData || rolesData.length === 0) {
      throw new Error('Failed to verify admin access');
    }

    const roleList = rolesData.map((r: { role: string }) => r.role);

    if (!roleList.includes('admin') && !roleList.includes('super_admin')) {
      throw new Error('Admin access required');
    }

    // CRITICAL: Rate limiting for user creation (prevent abuse)
    const rateLimit = await checkRateLimit(supabaseClient, user.id, RATE_LIMITS.ADMIN_CREATE_USER);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error);
    }

    // Get the user data from request body
    const requestBody = await req.json();
    
    // CRITICAL: MANDATORY MFA verification for admin user creation
    const { mfa_token } = requestBody;
    
    if (!mfa_token) {
      throw new Error('MFA token is required for user creation operations');
    }

    const { data: mfaVerified, error: mfaError } = await supabaseClient.rpc('verify_mfa_for_operation', {
      p_user_id: user.id,
      p_mfa_token: mfa_token,
      p_operation_type: 'user_creation'
    });

    if (mfaError || !mfaVerified) {
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'mfa_verification_failed',
        p_severity: 'high',
        p_details: { operation: 'user_creation', user_id: user.id }
      });
      throw new Error('MFA verification failed. Please try again.');
    }
    
    // CRITICAL: Validate and sanitize all user input
    const validation = validateUserCreation(requestBody);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    const { email, password, firstName, lastName, phone, city, state } = validation.sanitized!;
    const { role, isActive } = requestBody; // These are not user-provided text

    // Create the user using admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || ''
      }
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    // Update profile with additional information and mark email as verified
    if (newUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          city: city || null,
          state: state || null,
          is_active: isActive !== false,
          email_verified_at: new Date().toISOString() // Auto-verify for admin-created users
        })
        .eq('id', newUser.user.id);

      // Assign user role
      const { error: roleAssignError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: role || 'agent' })
        .eq('user_id', newUser.user.id);
    }

    // Log the creation as a security event
    await supabaseClient.from('security_events').insert({
      user_id: user.id,
      event_type: 'user_created_by_admin',
      severity: 'medium',
      details: {
        new_user_id: newUser.user.id,
        new_user_email: email,
        created_by: user.email,
        role: role || 'agent',
        email_auto_confirmed: true,
        email_auto_verified: true,
        created_by_admin: true,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        userId: newUser.user.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
});

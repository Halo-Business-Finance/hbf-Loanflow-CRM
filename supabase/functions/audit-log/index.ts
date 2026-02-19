import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { validateText, validateUUID } from "../_shared/validation.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { SecureLogger } from "../_shared/secure-logger.ts";

const logger = new SecureLogger('audit-log');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }
    
    // CRITICAL: Rate limiting for audit logging
    const rateLimit = await checkRateLimit(supabase, user.id, RATE_LIMITS.AUDIT_LOG);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error);
    }
    
    // CRITICAL: Validate and sanitize input
    const actionValidation = validateText(requestBody.action, 'Action', 100);
    if (!actionValidation.valid) {
      throw new Error(actionValidation.error);
    }
    
    const tableNameValidation = validateText(requestBody.table_name, 'Table name', 100);
    if (!tableNameValidation.valid) {
      throw new Error(tableNameValidation.error);
    }
    
    let recordIdValidation: { valid: boolean; sanitized: string; error?: string } = { valid: true, sanitized: requestBody.record_id };
    if (requestBody.record_id) {
      recordIdValidation = validateUUID(requestBody.record_id, 'Record ID');
      if (!recordIdValidation.valid) {
        throw new Error(recordIdValidation.error ?? 'Invalid Record ID');
      }
    }
    
    const { action, table_name, record_id, old_values, new_values } = {
      action: actionValidation.sanitized,
      table_name: tableNameValidation.sanitized,
      record_id: recordIdValidation.sanitized,
      old_values: requestBody.old_values,
      new_values: requestBody.new_values
    };

    // Get client IP and user agent - handle comma-separated IPs
    const rawIP = req.headers.get('x-forwarded-for') || 
                  req.headers.get('x-real-ip') || 
                  'unknown';
    // Parse first valid IP address from comma-separated list
    const clientIP = rawIP.includes(',') ? rawIP.split(',')[0].trim() : rawIP;
    const userAgent = req.headers.get('user-agent') || 'unknown';

    logger.logAction(action, { userId: user.id });

    // Insert audit log
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: action,
        table_name: table_name,
        record_id: record_id,
        old_values: old_values,
        new_values: new_values,
        ip_address: clientIP,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      logger.error('Database error', error);
      throw error;
    }

    return new Response(JSON.stringify({ 
      success: true,
      audit_log_id: data.id
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('webhook-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    
    // Critical security check: ensure webhook secret is configured
    if (!webhookSecret || webhookSecret === 'default-secret-key' || webhookSecret.trim() === '') {
      logger.error('CRITICAL: WEBHOOK_SECRET not configured or using default value');
      // Log security event for missing secret
      await supabase.rpc('log_security_event', {
        p_event_type: 'webhook_misconfiguration',
        p_severity: 'critical',
        p_details: { error: 'WEBHOOK_SECRET not properly configured' }
      });
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();

    // Verify webhook signature (now async)
    const isValidSignature = await verifyWebhookSignature(body, signature || '', webhookSecret);
    if (!signature || !isValidSignature) {
      logger.warn('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the webhook event for security auditing
    await supabase.from('webhook_events').insert({
      event_type: payload.type || 'unknown',
      payload: payload,
      source_ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      signature_verified: true,
      processed_at: new Date().toISOString()
    });

    // Process the webhook based on event type
    switch (payload.type) {
      case 'security_alert':
        await handleSecurityAlert(supabase, payload);
        break;
      case 'automation_trigger':
        await handleAutomationTrigger(supabase, payload);
        break;
      case 'system_notification':
        await handleSystemNotification(supabase, payload);
        break;
      default:
        logger.warn('Unknown webhook event type', { type: payload.type });
    }

    return new Response(JSON.stringify({
      status: 'success', 
      message: 'Webhook processed successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Error processing webhook', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Create HMAC signature
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(payload);
    
    // Use Web Crypto API to create HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === `sha256=${expectedSignature}`;
  } catch (error) {
    logger.error('Signature verification error', error);
    return false;
  }
}

async function handleSecurityAlert(supabase: any, payload: any) {
  logger.info('Processing security alert', { type: payload.type })
  
  // Create security notification
  await supabase.from('security_notifications').insert({
    notification_type: 'webhook_security_alert',
    title: payload.title || 'Security Alert from Webhook',
    message: payload.message || 'Security event detected via webhook',
    severity: payload.severity || 'medium',
    metadata: payload
  });
}

async function handleAutomationTrigger(supabase: any, payload: any) {
  logger.info('Processing automation trigger', { type: payload.type })
  
  // Log automation event
  await supabase.from('audit_logs').insert({
    action: 'webhook_automation_trigger',
    table_name: 'webhooks',
    new_values: payload
  });
}

async function handleSystemNotification(supabase: any, payload: any) {
  logger.info('Processing system notification', { type: payload.type })
  
  // Create system notification
  await supabase.from('security_notifications').insert({
    notification_type: 'system_notification',
    title: payload.title || 'System Notification',
    message: payload.message || 'System event via webhook',
    severity: payload.severity || 'low',
    metadata: payload
  });
}
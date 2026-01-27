import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecurityHeaders, handleSecureOptions, validatePhoneNumber, sanitizeString } from "../_shared/security-headers.ts";
import { SecureLogger } from "../_shared/secure-logger.ts";

const logger = new SecureLogger('ringcentral-auth');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleSecureOptions()
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, phoneNumber } = await req.json()

    // Validate inputs
    if (action && !['call', 'status'].includes(action)) {
      throw new Error('Invalid action parameter')
    }
    
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
      throw new Error('Invalid phone number format')
    }

    // Get user's RingCentral account
    const { data: rcAccount, error: rcError } = await supabaseClient
      .from('ringcentral_accounts')
      .select('client_id, client_secret, server_url, username, extension, password')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (rcError || !rcAccount) {
      throw new Error('RingCentral account not configured')
    }

    // Validate required fields
    if (!rcAccount.client_id || !rcAccount.client_secret || !rcAccount.username || !rcAccount.password) {
      throw new Error('RingCentral account incomplete - missing required credentials')
    }

    // Authenticate with RingCentral using proper password field
    const authResponse = await fetch(`${rcAccount.server_url}/restapi/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${rcAccount.client_id}:${rcAccount.client_secret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: rcAccount.username,
        password: rcAccount.password, // Use the actual password field, not client_secret
        extension: rcAccount.extension || ''
      })
    })

    if (!authResponse.ok) {
      const error = await authResponse.text()
      logger.error('RingCentral auth error', new Error(error))
      throw new Error('Failed to authenticate with RingCentral')
    }

    const authData = await authResponse.json()
    logger.info('RingCentral authenticated successfully')

    let result = {}

    if (action === 'call' && phoneNumber) {
      // Sanitize phone number
      const sanitizedPhoneNumber = sanitizeString(phoneNumber, 20);
      
      // Make a RingOut call
      const callResponse = await fetch(`${rcAccount.server_url}/restapi/v1.0/account/~/extension/~/ring-out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: { phoneNumber: rcAccount.username },
          to: { phoneNumber: sanitizedPhoneNumber },
          playPrompt: false
        })
      })

      if (!callResponse.ok) {
        const error = await callResponse.text()
        logger.error('RingCentral call error', new Error(error))
        throw new Error('Failed to initiate call')
      }

      result = await callResponse.json()
      logger.info('Call initiated')

    } else if (action === 'status') {
      // Get extension info
      const extensionResponse = await fetch(`${rcAccount.server_url}/restapi/v1.0/account/~/extension/~`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`
        }
      })

      if (!extensionResponse.ok) {
        throw new Error('Failed to get extension status')
      }

      result = await extensionResponse.json()
      logger.info('Extension status retrieved')
    }

    return new Response(JSON.stringify(result), {
      headers: getSecurityHeaders({ 'Content-Type': 'application/json' }),
    })

  } catch (error) {
    logger.error('Error in ringcentral-auth function', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: getSecurityHeaders({ 'Content-Type': 'application/json' }),
    })
  }
})
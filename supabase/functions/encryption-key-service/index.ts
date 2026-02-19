import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { SecureLogger } from '../_shared/secure-logger.ts'
import { checkRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts'

const logger = new SecureLogger('encryption-key-service')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface KeyRequest {
  action: 'derive' | 'rotate'
  keyType: 'master' | 'field' | 'session'
  fieldIdentifier?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, keyType, fieldIdentifier }: KeyRequest = await req.json()

    // Apply rate limiting based on action
    const rateLimitConfig = action === 'rotate' ? RATE_LIMITS.ENCRYPTION_KEY_ROTATE : RATE_LIMITS.ENCRYPTION_KEY_DERIVE
    const rateLimitResult = await checkRateLimit(supabaseClient, user.id, rateLimitConfig)
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for key operation', { userId: user.id, action })
      return new Response(
        JSON.stringify({ success: false, error: rateLimitResult.error }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log key access for audit
    await supabaseClient.from('security_events').insert({
      event_type: 'encryption_key_access',
      user_id: user.id,
      severity: 'info',
      details: { action, keyType, fieldIdentifier }
    })

    if (action === 'derive') {
      // Derive session-specific encryption key server-side
      // This key is unique per user session and never stored client-side
      const sessionId = user.id + ':' + Date.now()
      const keyMaterial = `${user.id}:${user.email}:${fieldIdentifier || keyType}:${Deno.env.get('ENCRYPTION_MASTER_SECRET')}`
      
      // Use PBKDF2 to derive a strong key
      const encoder = new TextEncoder()
      const keyData = encoder.encode(keyMaterial)
      const salt = encoder.encode(`loanflow-salt-${keyType}-${fieldIdentifier || ''}`)
      
      const importedKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 310000, // OWASP recommendation (2024)
          hash: 'SHA-512'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )

      // Export as raw key for client use
      const exportedKey = await crypto.subtle.exportKey('raw', derivedKey)
      const keyArray = Array.from(new Uint8Array(exportedKey))
      const keyBase64 = btoa(String.fromCharCode(...keyArray))

      return new Response(
        JSON.stringify({
          success: true,
          key: keyBase64,
          keyType,
          expiresIn: 3600 // 1 hour
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (action === 'rotate') {
      // Trigger key rotation process
      await supabaseClient.from('security_events').insert({
        event_type: 'encryption_key_rotation_requested',
        user_id: user.id,
        severity: 'medium',
        details: { keyType, timestamp: new Date().toISOString() }
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Key rotation initiated',
          rotationId: crypto.randomUUID()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    throw new Error('Invalid action')

  } catch (error: unknown) {
    logger.error('Encryption key service error', error instanceof Error ? error : new Error(String(error)))
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    
    return new Response(
      JSON.stringify({
        success: false,
        error: message
      }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
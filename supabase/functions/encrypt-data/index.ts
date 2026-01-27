import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'
import { checkRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts'

const logger = new SecureLogger('encrypt-data')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EncryptionRequest {
  action: 'encrypt' | 'decrypt'
  data: string
  tableName: string
  fieldName: string
  recordId: string
  keyId?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { 
      action, 
      data, 
      tableName, 
      fieldName, 
      recordId, 
      keyId 
    }: EncryptionRequest = await req.json()

    if (!action || !tableName || !fieldName || !recordId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Apply rate limiting based on action
    const rateLimitConfig = action === 'encrypt' ? RATE_LIMITS.ENCRYPT_DATA : RATE_LIMITS.DECRYPT_DATA
    const rateLimitResult = await checkRateLimit(supabase, user.id, rateLimitConfig)
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for encryption operation', { userId: user.id, action })
      return new Response(
        JSON.stringify({ error: rateLimitResult.error }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'encrypt') {
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Data is required for encryption' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Generate encryption components
      const encoder = new TextEncoder()
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(16))

      // Generate or get encryption key
      let encryptionKeyId = keyId
      if (!encryptionKeyId) {
        const { data: existingKey } = await supabase
          .from('encryption_keys')
          .select('id')
          .eq('key_purpose', 'field_encryption')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (existingKey) {
          encryptionKeyId = existingKey.id
        } else {
          // Create new encryption key
          const { data: newKey } = await supabase
            .from('encryption_keys')
            .insert({
              key_name: `field_encryption_${Date.now()}`,
              key_purpose: 'field_encryption',
              algorithm: 'AES-256-GCM'
            })
            .select('id')
            .single()

          encryptionKeyId = newKey!.id
        }
      }

      // Get active encryption key from database
      const { data: keyData } = await supabase
        .from('encryption_keys')
        .select('key_material')
        .eq('id', encryptionKeyId)
        .single()

      if (!keyData || !keyData.key_material) {
        throw new Error('Encryption key not found')
      }

      // Derive encryption key using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(keyData.key_material),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      const cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      )

      // Perform real AES-256-GCM encryption
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        encoder.encode(data)
      )

      const encryptedValue = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)))

      // Store encrypted field
      const { error: insertError } = await supabase
        .from('encrypted_fields')
        .upsert({
          table_name: tableName,
          field_name: fieldName,
          record_id: recordId,
          encryption_key_id: encryptionKeyId,
          encrypted_value: encryptedValue,
          encryption_algorithm: 'AES-256-GCM',
          salt: btoa(String.fromCharCode(...salt)),
          iv: btoa(String.fromCharCode(...iv))
        })

      if (insertError) {
        logger.error('Error storing encrypted field', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to store encrypted field' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Log security event
      await supabase
        .from('security_events')
        .insert({
          event_type: 'data_encrypted',
          severity: 'low',
          details: {
            table_name: tableName,
            field_name: fieldName,
            record_id: recordId,
            encryption_key_id: encryptionKeyId
          }
        })

      return new Response(
        JSON.stringify({
          success: true,
          encryptedValue: encryptedValue,
          keyId: encryptionKeyId,
          algorithm: 'AES-256-GCM'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } else if (action === 'decrypt') {
      // Get encrypted field
      const { data: encryptedField, error: fetchError } = await supabase
        .from('encrypted_fields')
        .select('*')
        .eq('table_name', tableName)
        .eq('field_name', fieldName)
        .eq('record_id', recordId)
        .single()

      if (fetchError || !encryptedField) {
        return new Response(
          JSON.stringify({ error: 'Encrypted field not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Get encryption key
      const { data: keyData } = await supabase
        .from('encryption_keys')
        .select('key_material')
        .eq('id', encryptedField.encryption_key_id)
        .single()

      if (!keyData || !keyData.key_material) {
        throw new Error('Encryption key not found')
      }

      // Convert stored values from base64
      const salt = new Uint8Array(atob(encryptedField.salt).split('').map(char => char.charCodeAt(0)))
      const iv = new Uint8Array(atob(encryptedField.iv).split('').map(char => char.charCodeAt(0)))
      const encryptedBuffer = new Uint8Array(atob(encryptedField.encrypted_value).split('').map(char => char.charCodeAt(0)))

      // Derive decryption key using PBKDF2
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(keyData.key_material),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      const cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )

      // Perform real AES-256-GCM decryption
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        encryptedBuffer
      )

      const decoder = new TextDecoder()
      const decryptedValue = decoder.decode(decryptedBuffer)

      // Log security event
      await supabase
        .from('security_events')
        .insert({
          event_type: 'data_decrypted',
          severity: 'medium',
          details: {
            table_name: tableName,
            field_name: fieldName,
            record_id: recordId,
            encryption_key_id: encryptedField.encryption_key_id
          }
        })

      return new Response(
        JSON.stringify({
          success: true,
          decryptedValue: decryptedValue,
          keyId: encryptedField.encryption_key_id
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    logger.error('Encryption function error', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
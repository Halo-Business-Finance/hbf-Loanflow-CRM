import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateText, validateUUID } from "../_shared/validation.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { SecureLogger } from "../_shared/secure-logger.ts";

const logger = new SecureLogger('blockchain-hash');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BlockchainRequest {
  recordType: string
  recordId: string
  data: any
  metadata?: any
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
    
    // Get authorization and verify rate limit
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        // CRITICAL: Rate limiting for blockchain operations
        const rateLimit = await checkRateLimit(supabase, user.id, RATE_LIMITS.BLOCKCHAIN_HASH);
        if (!rateLimit.allowed) {
          throw new Error(rateLimit.error);
        }
      }
    }

    // Get request body
    const requestBody: BlockchainRequest = await req.json();

    if (!requestBody.recordType || !requestBody.recordId || !requestBody.data) {
      throw new Error('Missing required fields: recordType, recordId, data');
    }
    
    // CRITICAL: Validate and sanitize input
    const recordTypeValidation = validateText(requestBody.recordType, 'Record type', 50);
    if (!recordTypeValidation.valid) {
      throw new Error(recordTypeValidation.error);
    }
    
    const recordIdValidation = validateUUID(requestBody.recordId, 'Record ID');
    if (!recordIdValidation.valid) {
      throw new Error(recordIdValidation.error);
    }
    
    const { recordType, recordId, data, metadata = {} } = {
      recordType: recordTypeValidation.sanitized,
      recordId: recordIdValidation.sanitized,
      data: requestBody.data,
      metadata: requestBody.metadata || {}
    };

    // Generate cryptographic hash of the data
    const encoder = new TextEncoder()
    const dataString = JSON.stringify(data)
    const dataBuffer = encoder.encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = new Uint8Array(hashBuffer)
    const dataHash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('')

    // Create blockchain record
    const { data: blockchainRecord, error: createError } = await supabase
      .rpc('create_blockchain_record', {
        p_record_type: recordType,
        p_record_id: recordId,
        p_data_hash: dataHash,
        p_metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          version: '1.0',
          hash_algorithm: 'SHA-256'
        }
      })

    if (createError) {
      logger.error('Error creating blockchain record', createError)
      return new Response(
        JSON.stringify({ error: 'Failed to create blockchain record' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Simulate blockchain transaction (replace with actual blockchain integration)
    const mockTransactionHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), 
      byte => byte.toString(16).padStart(2, '0')).join('')}`
    const mockBlockNumber = Math.floor(Math.random() * 1000000) + 15000000
    const mockBlockchainHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), 
      byte => byte.toString(16).padStart(2, '0')).join('')}`

    // Update blockchain record with transaction details
    const { error: updateError } = await supabase
      .from('blockchain_records')
      .update({
        blockchain_hash: mockBlockchainHash,
        transaction_hash: mockTransactionHash,
        block_number: mockBlockNumber,
        verification_status: 'verified',
        verified_at: new Date().toISOString()
      })
      .eq('id', blockchainRecord)

    if (updateError) {
      logger.error('Error updating blockchain record', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update blockchain record' }),
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
        event_type: 'blockchain_hash_created',
        severity: 'low',
        details: {
          record_type: recordType,
          record_id: recordId,
          data_hash: dataHash,
          transaction_hash: mockTransactionHash,
          block_number: mockBlockNumber
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        blockchainRecordId: blockchainRecord,
        dataHash: dataHash,
        transactionHash: mockTransactionHash,
        blockNumber: mockBlockNumber,
        blockchainHash: mockBlockchainHash,
        verificationStatus: 'verified'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    // Use secure error handler to prevent information leakage
    return createErrorResponse(error, corsHeaders, 400);
  }
})
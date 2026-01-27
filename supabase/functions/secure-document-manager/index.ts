import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('secure-document-manager')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, document_id, lead_id, file_path, metadata } = await req.json()
    
    // Get the authenticated user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (userError || !user) {
      throw new Error('Invalid authentication')
    }

    logger.logAuth(user.id, { action });

    switch (action) {
      case 'validate_upload_access':
        return await validateUploadAccess(lead_id, user.id)
      case 'validate_document_access':
        return await validateDocumentAccess(document_id, 'read', user.id)
      case 'validate_document_modification':
        return await validateDocumentAccess(document_id, 'write', user.id)
      case 'validate_document_deletion':
        return await validateDocumentAccess(document_id, 'delete', user.id)
      case 'secure_file_cleanup':
        return await secureFileCleanup(file_path, user.id)
      case 'get_secure_documents':
        return await getSecureDocuments(lead_id, user.id)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error: unknown) {
    logger.error('Secure document operation error', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function validateUploadAccess(leadId: string, userId: string) {
  try {
    // Check if user owns the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('user_id')
      .eq('id', leadId)
      .single()

    if (leadError) {
      throw leadError
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'Lead not found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if user owns the lead or is admin
    const { data: userRole } = await supabase.rpc('get_user_role', {
      p_user_id: userId
    })

    const allowed = lead.user_id === userId || ['admin', 'super_admin'].includes(userRole)
    
    // Log access attempt
    await supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_event_type: 'document_upload_validation',
      p_severity: allowed ? 'low' : 'medium',
      p_details: {
        lead_id: leadId,
        access_granted: allowed,
        reason: allowed ? 'authorized_upload' : 'unauthorized_upload_attempt'
      }
    })

    return new Response(
      JSON.stringify({ 
        allowed,
        reason: allowed ? 'Upload authorized' : 'Not authorized to upload documents for this lead',
        secure_path: allowed ? `${userId}/${leadId}/` : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error validating upload access', error)
    throw error
  }
}

async function validateDocumentAccess(documentId: string, action: string, userId: string) {
  try {
    const { data: hasAccess, error } = await supabase.rpc('validate_document_access', {
      p_document_id: documentId,
      p_action: action
    })

    if (error) {
      throw error
    }

    // Get document details for logging
    const { data: document } = await supabase
      .from('lead_documents')
      .select('lead_id, document_name, user_id')
      .eq('id', documentId)
      .single()

    // Log access attempt
    await supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_event_type: `document_${action}_validation`,
      p_severity: hasAccess ? 'low' : 'high',
      p_details: {
        document_id: documentId,
        lead_id: document?.lead_id,
        document_name: document?.document_name,
        document_owner: document?.user_id,
        access_granted: hasAccess,
        requested_action: action
      }
    })

    return new Response(
      JSON.stringify({ 
        allowed: hasAccess,
        reason: hasAccess ? `${action} access granted` : `${action} access denied - insufficient permissions`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error validating document access', error)
    throw error
  }
}

async function secureFileCleanup(filePath: string, userId: string) {
  try {
    // Validate file ownership before deletion
    const pathParts = filePath.split('/')
    const fileOwnerId = pathParts[0]
    
    // Check if user owns the file or is admin
    const { data: userRole } = await supabase.rpc('get_user_role', {
      p_user_id: userId
    })

    const canDelete = fileOwnerId === userId || ['admin', 'super_admin'].includes(userRole)
    
    if (!canDelete) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'Unauthorized file deletion attempt' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('lead-documents')
      .remove([filePath])

    if (storageError) {
      throw storageError
    }

    // Log secure deletion
    await supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_event_type: 'secure_file_cleanup',
      p_severity: 'medium',
      p_details: {
        file_path: filePath,
        file_owner: fileOwnerId,
        deleted_by: userId
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'File deleted securely' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error during secure file cleanup', error)
    throw error
  }
}

async function getSecureDocuments(leadId: string, userId: string) {
  try {
    // Get documents using RLS-protected query
    const { data: documents, error } = await supabase
      .from('lead_documents')
      .select(`
        id,
        document_name,
        document_type,
        file_size,
        file_mime_type,
        status,
        uploaded_at,
        verified_at,
        verified_by,
        notes,
        metadata,
        user_id
      `)
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      throw error
    }

    // Additional security: filter out sensitive metadata based on user role
    const { data: userRole } = await supabase.rpc('get_user_role', {
      p_user_id: userId
    })

    const filteredDocuments = documents?.map(doc => {
      // Users can see full details of their own documents
      if (doc.user_id === userId || ['admin', 'super_admin'].includes(userRole)) {
        return doc
      }
      
      // Other users see limited information
      return {
        ...doc,
        notes: null, // Hide notes from other users
        metadata: null // Hide metadata from other users
      }
    })

    return new Response(
      JSON.stringify({ 
        documents: filteredDocuments || [],
        total: filteredDocuments?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error getting secure documents', error)
    throw error
  }
}

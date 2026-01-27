import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface SecureDocument {
  id: string;
  lead_id: string;
  document_name: string;
  document_type: string;
  file_size: number;
  file_mime_type: string;
  status: string;
  uploaded_at: string;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  metadata?: any;
  user_id: string;
}

export const useSecureDocuments = () => {
  const [documents, setDocuments] = useState<SecureDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const validateUploadAccess = useCallback(async (leadId: string): Promise<{
    allowed: boolean;
    reason: string;
    securePath?: string;
  }> => {
    if (!user) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('secure-document-manager', {
        body: {
          action: 'validate_upload_access',
          lead_id: leadId
        }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error validating upload access:', error);
      return { allowed: false, reason: 'Validation failed' };
    }
  }, [user]);

  const secureUpload = useCallback(async (
    leadId: string,
    file: File,
    documentType: string = 'other'
  ): Promise<SecureDocument | null> => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upload documents",
        variant: "destructive",
      });
      return null;
    }

    // Validate file type
    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    ];

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only PDF, DOC, DOCX, XLS, XLSX, PNG, and JPG files are allowed",
        variant: "destructive",
      });
      return null;
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return null;
    }

    try {
      setIsLoading(true);

      // First validate upload access
      const validation = await validateUploadAccess(leadId);
      if (!validation.allowed) {
        toast({
          title: "Upload Denied",
          description: validation.reason,
          variant: "destructive",
        });
        return null;
      }

      // Generate cryptographically random filename to prevent guessing
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      const randomName = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      const timestamp = Date.now();
      const securePath = `${user.id}/${leadId}/${timestamp}-${randomName}.${fileExtension}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lead-documents')
        .upload(securePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Create document record in database
      const { data: docData, error: docError } = await supabase
        .from('lead_documents')
        .insert({
          lead_id: leadId,
          user_id: user.id,
          document_name: file.name,
          document_type: documentType,
          file_path: securePath,
          file_size: file.size,
          file_mime_type: file.type,
          status: 'uploaded',
          metadata: {
            original_name: file.name,
            upload_timestamp: timestamp,
            secure_path: securePath
          }
        })
        .select()
        .single();

      if (docError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from('lead-documents')
          .remove([securePath]);
        throw docError;
      }

      toast({
        title: "Upload Successful",
        description: `${file.name} uploaded securely`,
      });

      return docData;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document securely",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, validateUploadAccess, toast]);

  const validateDocumentAccess = useCallback(async (
    documentId: string, 
    action: 'read' | 'write' | 'delete' = 'read'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('secure-document-manager', {
        body: {
          action: `validate_document_${action === 'read' ? 'access' : action === 'write' ? 'modification' : 'deletion'}`,
          document_id: documentId
        }
      });

      if (error) {
        throw error;
      }

      return data.allowed;
    } catch (error: any) {
      console.error('Error validating document access:', error);
      return false;
    }
  }, [user]);

  const getSecureDocuments = useCallback(async (leadId: string): Promise<SecureDocument[]> => {
    if (!user) return [];

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('secure-document-manager', {
        body: {
          action: 'get_secure_documents',
          lead_id: leadId
        }
      });

      if (error) {
        throw error;
      }

      const secureDocuments = data.documents || [];
      setDocuments(secureDocuments);
      return secureDocuments;
    } catch (error: any) {
      console.error('Error getting secure documents:', error);
      toast({
        title: "Access Error",
        description: "Failed to load documents securely",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const secureDownload = useCallback(async (documentId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // First validate access
      const hasAccess = await validateDocumentAccess(documentId, 'read');
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to download this document",
          variant: "destructive",
        });
        return null;
      }

      // Get document details
      const { data: doc, error: docError } = await supabase
        .from('lead_documents')
        .select('file_path, document_name')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        throw new Error('Document not found');
      }

      // Create signed URL for secure download (30 minute expiry)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('lead-documents')
        .createSignedUrl(doc.file_path, 1800); // 30 minutes expiry

      if (urlError) {
        throw urlError;
      }

      // Log secure document access
      await supabase.rpc('log_security_event', {
        p_event_type: 'document_download',
        p_severity: 'low',
        p_details: {
          document_id: documentId,
          document_name: doc.document_name,
          action: 'download',
          timestamp: new Date().toISOString()
        }
      });

      return signedUrlData.signedUrl;
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download document securely",
        variant: "destructive",
      });
      return null;
    }
  }, [user, validateDocumentAccess, toast]);

  const secureDelete = useCallback(async (documentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // First validate deletion access
      const hasAccess = await validateDocumentAccess(documentId, 'delete');
      if (!hasAccess) {
        toast({
          title: "Delete Denied",
          description: "You don't have permission to delete this document",
          variant: "destructive",
        });
        return false;
      }

      // Get document details before deletion
      const { data: doc, error: docError } = await supabase
        .from('lead_documents')
        .select('file_path, document_name')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        throw new Error('Document not found');
      }

      // Delete from database first (triggers audit log)
      const { error: deleteError } = await supabase
        .from('lead_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw deleteError;
      }

      // Clean up file from storage using secure cleanup
      await supabase.functions.invoke('secure-document-manager', {
        body: {
          action: 'secure_file_cleanup',
          file_path: doc.file_path
        }
      });

      toast({
        title: "Document Deleted",
        description: `${doc.document_name} deleted securely`,
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document securely",
        variant: "destructive",
      });
      return false;
    }
  }, [user, validateDocumentAccess, toast]);

  return {
    documents,
    isLoading,
    validateUploadAccess,
    secureUpload,
    getSecureDocuments,
    secureDownload,
    secureDelete,
    validateDocumentAccess,
  };
};
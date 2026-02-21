import { useState, useEffect } from 'react';
import { ibmDb, ibmStorage } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/hooks/use-toast';

export interface LeadDocument {
  id: string;
  lead_id: string;
  contact_entity_id: string;
  user_id: string;
  document_name: string;
  document_type: string;
  file_path?: string;
  file_size?: number;
  file_mime_type?: string;
  status: string;
  uploaded_at?: string;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  contact_entity?: {
    name: string;
    business_name?: string;
    loan_amount?: number;
    loan_type?: string;
    location?: string;
    business_city?: string;
    business_state?: string;
    business_address?: string;
  };
}

export function useDocuments() {
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchDocuments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await ibmDb
        .from('lead_documents')
        .select(`
          *,
          contact_entity:contact_entities!contact_entity_id(name, business_name, loan_amount, loan_type, location, business_city, business_state, business_address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data as unknown as LeadDocument[]) || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (
    leadId: string,
    contactEntityId: string,
    file: File,
    documentType: string,
    notes?: string,
    customDocumentName?: string
  ) => {
    if (!user) return null;

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${leadId}/${fileName}`;
      
      const { error: uploadError } = await ibmStorage
        .from('lead-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error: dbError } = await ibmDb
        .from('lead_documents')
        .insert({
          lead_id: leadId,
          contact_entity_id: contactEntityId,
          user_id: user.id,
          document_name: customDocumentName || file.name,
          document_type: documentType,
          file_path: filePath,
          file_size: file.size,
          file_mime_type: file.type,
          status: 'pending',
          notes: notes,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      fetchDocuments();
      return data;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateDocumentStatus = async (documentId: string, status: string) => {
    if (!user) return;

    try {
      const updates: any = { status };
      if (status === 'verified') {
        updates.verified_at = new Date().toISOString();
        updates.verified_by = user.id;
      }

      const { error } = await ibmDb
        .from('lead_documents')
        .update(updates)
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Document ${status}`,
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error updating document status:', error);
      toast({
        title: "Error",
        description: "Failed to update document status",
        variant: "destructive",
      });
    }
  };

  const downloadDocument = async (document: LeadDocument) => {
    if (!document.file_path) return;

    try {
      const { data, error } = await ibmStorage
        .from('lead-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const deleteDocument = async (documentId: string, filePath?: string) => {
    if (!user) return;

    try {
      if (filePath) {
        await ibmStorage
          .from('lead-documents')
          .remove([filePath]);
      }

      const { error } = await ibmDb
        .from('lead_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  return {
    documents,
    loading,
    uploadDocument,
    updateDocumentStatus,
    downloadDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
}

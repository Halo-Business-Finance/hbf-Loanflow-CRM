import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_size: number;
  file_mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  change_description: string | null;
  is_current: boolean;
  checksum: string | null;
  metadata: any;
}

export function useDocumentVersions(documentId: string | null) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchVersions = async () => {
    if (!documentId || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error: any) {
      console.error('Error fetching versions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document versions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadNewVersion = async (
    file: File,
    changeDescription?: string
  ): Promise<boolean> => {
    if (!documentId || !user) return false;

    try {
      // Generate file path
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `${user.id}/${documentId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('lead-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create new version using RPC
      const { data, error: versionError } = await supabase.rpc(
        'create_document_version',
        {
          p_document_id: documentId,
          p_file_path: filePath,
          p_file_size: file.size,
          p_file_mime_type: file.type,
          p_change_description: changeDescription || null,
        }
      );

      if (versionError) throw versionError;

      toast({
        title: 'Success',
        description: 'New version uploaded successfully',
      });

      await fetchVersions();
      return true;
    } catch (error: any) {
      console.error('Error uploading version:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload new version',
        variant: 'destructive',
      });
      return false;
    }
  };

  const revertToVersion = async (versionNumber: number): Promise<boolean> => {
    if (!documentId || !user) return false;

    try {
      const { data, error } = await supabase.rpc('revert_to_document_version', {
        p_document_id: documentId,
        p_version_number: versionNumber,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Reverted to version ${versionNumber}`,
      });

      await fetchVersions();
      return true;
    } catch (error: any) {
      console.error('Error reverting version:', error);
      toast({
        title: 'Revert Failed',
        description: error.message || 'Failed to revert to version',
        variant: 'destructive',
      });
      return false;
    }
  };

  const downloadVersion = async (version: DocumentVersion) => {
    try {
      const { data, error } = await supabase.storage
        .from('lead-documents')
        .download(version.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `v${version.version_number}_${version.file_path.split('/').pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading version:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download document version',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchVersions();
    }
  }, [documentId, user]);

  return {
    versions,
    loading,
    uploadNewVersion,
    revertToVersion,
    downloadVersion,
    refetch: fetchVersions,
  };
}

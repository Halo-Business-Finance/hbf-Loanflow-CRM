import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye,
  Download,
  Trash2,
  Loader2,
  History
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFileUploadProgress, formatBytes } from '@/hooks/useFileUpload';
import { DocumentVersionHistory } from '@/components/DocumentVersionHistory';

// File validation schema
const fileValidationSchema = z.object({
  file: z.custom<File>((file) => file instanceof File, {
    message: 'Please select a file',
  }),
  documentType: z.string().min(1, 'Document type is required'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

// Allowed file types with MIME types
const ALLOWED_FILE_TYPES = {
  'application/pdf': { ext: 'PDF', icon: '📄', description: 'PDF Document' },
  'application/msword': { ext: 'DOC', icon: '📝', description: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    ext: 'DOCX', icon: '📝', description: 'Word Document' 
  },
  'application/vnd.ms-excel': { ext: 'XLS', icon: '📊', description: 'Excel Spreadsheet' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { 
    ext: 'XLSX', icon: '📊', description: 'Excel Spreadsheet' 
  },
  'image/jpeg': { ext: 'JPG', icon: '🖼️', description: 'JPEG Image' },
  'image/png': { ext: 'PNG', icon: '🖼️', description: 'PNG Image' },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Required loan documents
const REQUIRED_DOCUMENTS = [
  { id: 'tax-returns', label: 'Business Tax Returns (2 years)', required: true },
  { id: 'personal-tax', label: 'Personal Tax Returns (2 years)', required: true },
  { id: 'financial-statements', label: 'P&L and Balance Sheet', required: true },
  { id: 'bank-statements', label: 'Bank Statements (3 months)', required: true },
  { id: 'debt-schedule', label: 'Debt Schedule and Notes', required: true },
  { id: 'loan-app', label: 'Loan Application & Driver\'s License', required: true },
  { id: 'ar-ap', label: 'AR & AP', required: false },
  { id: 'projections', label: 'Projections, Resume & Business Plan', required: false },
  { id: 'sba-docs', label: 'SBA & Bank Documents', required: false },
  { id: 'corp-docs', label: 'Corp Articles, Operating Agreement & EIN', required: false },
];

interface UploadedDocument {
  id: string;
  document_type: string;
  document_name: string;
  file_size: number;
  file_mime_type: string;
  status: string;
  uploaded_at: string;
  notes?: string;
  file_path?: string;
  current_version?: number;
  total_versions?: number;
  last_version_date?: string;
}

interface FileUploadItem {
  file: File;
  documentType: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  id: string;
}

interface LoanDocumentSubmissionProps {
  leadId: string;
  contactEntityId: string;
  leadName: string;
}

export function LoanDocumentSubmission({ 
  leadId, 
  contactEntityId, 
  leadName 
}: LoanDocumentSubmissionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileUploadItem[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [validationError, setValidationError] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [selectedDocForVersions, setSelectedDocForVersions] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { simulateProgress } = useFileUploadProgress();

  useEffect(() => {
    fetchUploadedDocuments();
  }, [leadId]);

  const fetchUploadedDocuments = async () => {
    if (!user || !leadId) return;

    try {
      const { data, error } = await supabase
        .from('lead_documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setUploadedDocs(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return `Invalid file type. Allowed types: ${Object.values(ALLOWED_FILE_TYPES)
        .map(t => t.ext)
        .join(', ')}`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum limit of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB`;
    }

    // Check filename for special characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
    if (invalidChars.test(file.name)) {
      return 'Filename contains invalid characters';
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setValidationError('');
    
    if (!files || files.length === 0) {
      return;
    }

    const newFiles: FileUploadItem[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        newFiles.push({
          file,
          documentType: '',
          status: 'pending',
          progress: 0,
          id: `${Date.now()}-${index}`,
        });
      }
    });

    if (errors.length > 0) {
      setValidationError(errors.join('; '));
      toast({
        title: 'Some files are invalid',
        description: `${errors.length} file(s) could not be added`,
        variant: 'destructive',
      });
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      toast({
        title: 'Files added',
        description: `${newFiles.length} file(s) ready to upload`,
      });
    }

    // Reset input
    e.target.value = '';
  };

  const updateFileDocType = (fileId: string, docType: string) => {
    setSelectedFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, documentType: docType } : f)
    );
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      return;
    }

    const newFiles: FileUploadItem[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        newFiles.push({
          file,
          documentType: '',
          status: 'pending',
          progress: 0,
          id: `${Date.now()}-${index}`,
        });
      }
    });

    if (errors.length > 0) {
      setValidationError(errors.join('; '));
      toast({
        title: 'Some files are invalid',
        description: `${errors.length} file(s) could not be added`,
        variant: 'destructive',
      });
    }

    if (newFiles.length > 0) {
      if (bulkMode) {
        setSelectedFiles(prev => [...prev, ...newFiles]);
        toast({
          title: 'Files added',
          description: `${newFiles.length} file(s) ready to upload`,
        });
      } else {
        // In single mode, only keep the first file
        setSelectedFiles([newFiles[0]]);
        toast({
          title: 'File added',
          description: '1 file ready to upload',
        });
      }
    }
  };

  const uploadSingleFile = async (fileItem: FileUploadItem): Promise<boolean> => {
    if (!user) return false;

    try {
      // Update status to uploading
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { ...f, status: 'uploading' as const, progress: 0 } : f)
      );

      // Simulate realistic progress for better UX
      const progressInterval = setInterval(() => {
        setSelectedFiles(prev =>
          prev.map(f => {
            if (f.id === fileItem.id && f.progress < 85) {
              // Increase progress gradually, slowing down as it approaches 85%
              const increment = Math.max(1, (85 - f.progress) / 10);
              return { ...f, progress: Math.min(f.progress + increment, 85) };
            }
            return f;
          })
        );
      }, 400);

      // Generate secure file path
      const timestamp = Date.now();
      const sanitizedFileName = fileItem.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `${user.id}/${leadId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('lead-documents')
        .upload(filePath, fileItem.file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      // Update progress to 90% after successful upload (before DB write)
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { ...f, progress: 90 } : f)
      );

      // Create database record
      const { error: dbError } = await supabase
        .from('lead_documents')
        .insert({
          lead_id: leadId,
          contact_entity_id: contactEntityId,
          user_id: user.id,
          document_name: fileItem.file.name,
          document_type: fileItem.documentType,
          file_path: filePath,
          file_size: fileItem.file.size,
          file_mime_type: fileItem.file.type,
          status: 'pending',
          notes: notes || null,
        });

      if (dbError) throw dbError;

      // Update to success
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { ...f, status: 'success' as const, progress: 100 } : f)
      );

      return true;
    } catch (error: any) {
      console.error('Upload error:', error);
      setSelectedFiles(prev =>
        prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: 'error' as const, 
          error: error.message || 'Upload failed' 
        } : f)
      );
      return false;
    }
  };

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) {
      setValidationError('Please select at least one file');
      return;
    }

    // Check if all files have document types
    const filesWithoutType = selectedFiles.filter(f => !f.documentType);
    if (filesWithoutType.length > 0) {
      setValidationError('Please select document type for all files');
      toast({
        title: 'Missing document types',
        description: `${filesWithoutType.length} file(s) need document type`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setValidationError('');
    setOverallProgress(0);

    let successCount = 0;
    let errorCount = 0;
    const totalFiles = selectedFiles.length;

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];
      
      // Update overall progress
      const baseProgress = (i / totalFiles) * 100;
      setOverallProgress(baseProgress);

      const success = await uploadSingleFile(fileItem);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Update overall progress after each file
      setOverallProgress(((i + 1) / totalFiles) * 100);
    }

    setUploading(false);
    setOverallProgress(100);

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      toast({
        title: 'Upload Complete',
        description: `Successfully uploaded ${successCount} document(s)`,
      });
      setSelectedFiles([]);
      setNotes('');
    } else if (successCount > 0 && errorCount > 0) {
      toast({
        title: 'Partial Upload',
        description: `${successCount} succeeded, ${errorCount} failed`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Upload Failed',
        description: `Failed to upload ${errorCount} document(s)`,
        variant: 'destructive',
      });
    }

    // Refresh documents list
    await fetchUploadedDocuments();

    // Reset overall progress after a delay
    setTimeout(() => setOverallProgress(0), 2000);
  };

  const handleDelete = async (docId: string, filePath?: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      if (filePath) {
        await supabase.storage
          .from('lead-documents')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('lead_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });

      await fetchUploadedDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const getCompletionStatus = () => {
    const requiredDocs = REQUIRED_DOCUMENTS.filter(d => d.required);
    const uploadedRequired = requiredDocs.filter(doc => 
      uploadedDocs.some(up => up.document_type === doc.label)
    );
    return {
      total: requiredDocs.length,
      completed: uploadedRequired.length,
      percentage: Math.round((uploadedRequired.length / requiredDocs.length) * 100),
    };
  };

  const status = getCompletionStatus();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Document Submission</CardTitle>
              <CardDescription>
                Upload required documents for {leadName}
              </CardDescription>
            </div>
            <Badge variant={status.completed === status.total ? 'default' : 'secondary'}>
              {status.completed} of {status.total} Required
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion Progress</span>
              <span className="font-medium">{status.percentage}%</span>
            </div>
            <Progress value={status.percentage} className="h-2" />
          </div>

          {/* Overall Upload Progress */}
          {uploading && overallProgress > 0 && (
            <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium">Uploading documents...</span>
                </div>
                <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          {/* Upload Mode Toggle */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedFiles([]);
                setValidationError('');
              }}
            >
              {bulkMode ? 'Single Upload Mode' : 'Bulk Upload Mode'}
            </Button>
          </div>

          {/* Upload Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="file-upload" className="text-sm font-medium">
                  {bulkMode ? 'Select Multiple Files' : 'Select File'} <span className="text-destructive">*</span>
                </Label>
                {bulkMode && selectedFiles.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFiles.length} file(s) selected
                  </span>
                )}
              </div>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                  isDragging 
                    ? 'bg-primary/10 border-primary scale-[1.02]' 
                    : 'hover:bg-muted/30 border-border'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  multiple={bulkMode}
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="space-y-2">
                    <Upload className={`h-10 w-10 mx-auto transition-colors ${
                      isDragging ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="text-sm">
                      {isDragging ? (
                        <span className="font-medium text-primary">Drop files here</span>
                      ) : (
                        <>
                          <span className="font-medium text-primary">Click to upload</span>
                          {' '}or drag and drop
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 10MB each)
                      {bulkMode && <div className="mt-1">Multiple files can be selected</div>}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Selected Files List for Bulk Upload */}
            {bulkMode && selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedFiles.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="flex items-start gap-3 p-3 border rounded-lg bg-background"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{fileItem.file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(fileItem.file.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                        {fileItem.status === 'success' && (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        )}
                        {fileItem.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                        )}
                        {fileItem.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileItem.id)}
                            disabled={uploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <select
                        value={fileItem.documentType}
                        onChange={(e) => updateFileDocType(fileItem.id, e.target.value)}
                        className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background"
                        disabled={fileItem.status !== 'pending' || uploading}
                      >
                        <option value="">Select document type...</option>
                        {REQUIRED_DOCUMENTS.map((doc) => (
                          <option key={doc.id} value={doc.label}>
                            {doc.label} {doc.required && '*'}
                          </option>
                        ))}
                      </select>
                      {fileItem.status === 'uploading' && (
                        <div className="space-y-1">
                          <Progress value={fileItem.progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">
                            {fileItem.progress < 90 
                              ? `Uploading... ${Math.round(fileItem.progress)}%`
                              : 'Finalizing...'
                            }
                          </p>
                        </div>
                      )}
                      {fileItem.status === 'error' && fileItem.error && (
                        <p className="text-xs text-destructive">{fileItem.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes Section */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notes (Optional - applies to all uploads)
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any relevant notes..."
                  maxLength={500}
                  rows={3}
                  disabled={uploading}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {notes.length}/500
                </div>
              </div>
            )}

            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {bulkMode ? (
              <Button
                onClick={handleBulkUpload}
                disabled={selectedFiles.length === 0 || uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Document(s)`}
              </Button>
            ) : (
              <Button
                onClick={handleBulkUpload}
                disabled={selectedFiles.length === 0 || uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            )}
          </div>

          {/* Uploaded Documents */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Uploaded Documents</h3>
            {uploadedDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No documents uploaded yet
              </div>
            ) : (
              <div className="space-y-2">
                {uploadedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{doc.document_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{doc.document_type}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(2)} KB</span>
                          {doc.total_versions && doc.total_versions > 1 && (
                            <>
                              <span>•</span>
                              <span className="text-primary font-medium">
                                v{doc.current_version} of {doc.total_versions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={doc.status === 'verified' ? 'default' : 'secondary'}>
                        {doc.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {doc.total_versions && doc.total_versions >= 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedDocForVersions({
                              id: doc.id,
                              name: doc.document_name,
                            })
                          }
                          title="View version history"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc.id, doc.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Version History Modal */}
      {selectedDocForVersions && (
        <DocumentVersionHistory
          isOpen={!!selectedDocForVersions}
          onClose={() => {
            setSelectedDocForVersions(null);
            fetchUploadedDocuments(); // Refresh to show updated version info
          }}
          documentId={selectedDocForVersions.id}
          documentName={selectedDocForVersions.name}
        />
      )}
    </div>
  );
}

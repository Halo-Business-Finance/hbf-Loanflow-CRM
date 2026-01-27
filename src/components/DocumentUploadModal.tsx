import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Lead {
  id: string;
  contact_entity_id: string;
  contact_entity: {
    name: string;
    business_name: string;
  };
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (leadId: string, contactEntityId: string, file: File, documentType: string, notes?: string, customDocumentName?: string) => Promise<any>;
  preSelectedLeadId?: string; // Optional pre-selected lead
}

const documentTypes = [
  'Business Tax Returns',
  'Personal Tax Returns',
  'P&L and Balance Sheet',
  'Bank Statements',
  'Debt Schedule and Notes',
  'Loan Application & Driver\'s License',
  'AR & AP',
  'Projections, Resume & Business Plan',
  'SBA & Bank Documents',
  'Corp Articles, Operating Agreement & EIN Form',
  'Other'
];

export function DocumentUploadModal({ isOpen, onClose, onUpload, preSelectedLeadId }: DocumentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user) {
      fetchLeads();
      // Pre-select lead if provided
      if (preSelectedLeadId) {
        setSelectedLead(preSelectedLeadId);
      }
    }
  }, [isOpen, user, preSelectedLeadId]);

  const fetchLeads = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          contact_entity_id,
          contact_entity:contact_entities!contact_entity_id(name, business_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (file) {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
          toast({ title: 'Invalid file type', description: 'Allowed: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG', variant: 'destructive' });
          return;
        }
        if (file.size > maxSize) {
          toast({ title: 'File too large', description: 'Maximum size is 10MB', variant: 'destructive' });
          return;
        }

        setSelectedFile(file);
        if (!documentName) {
          const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
          setDocumentName(nameWithoutExtension);
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({ title: 'Error', description: 'Failed to process file. Please try again.', variant: 'destructive' });
    }
  };

  const handleUpload = async () => {
    console.log('Upload button clicked!');
    console.log('Form state:', { selectedFile, selectedLead, documentType, documentName });
    
    if (!selectedFile || !selectedLead || !documentType || !documentName) {
      console.log('Missing required fields:', {
        hasFile: !!selectedFile,
        hasLead: !!selectedLead,
        hasDocType: !!documentType,
        hasDocName: !!documentName
      });
      return;
    }

    setUploading(true);
    try {
      const selectedLeadData = leads.find(lead => lead.id === selectedLead);
      if (!selectedLeadData) {
        console.log('Selected lead not found in leads array');
        return;
      }

      console.log('Calling onUpload with:', {
        leadId: selectedLead,
        contactEntityId: selectedLeadData.contact_entity_id,
        fileName: selectedFile.name,
        documentType,
        notes,
        documentName
      });

      await onUpload(
        selectedLead,
        selectedLeadData.contact_entity_id,
        selectedFile,
        documentType,
        notes || undefined,
        documentName
      );
      
      // Reset form
      setSelectedFile(null);
      setSelectedLead('');
      setDocumentType('');
      setDocumentName('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">Upload Document</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload documents for loan processing and underwriting review
          </p>
        </DialogHeader>
        
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label htmlFor="lead-select" className="text-sm font-medium">
              Borrower / Company
            </Label>
            <Select value={selectedLead} onValueChange={setSelectedLead} disabled={!!preSelectedLeadId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select borrower or company..." />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.contact_entity?.business_name || lead.contact_entity?.name || 'Unnamed Lead'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preSelectedLeadId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
                Pre-selected for this loan application
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-type" className="text-sm font-medium">
                Document Type
              </Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-name" className="text-sm font-medium">
                Document Name
              </Label>
              <Input
                id="document-name"
                placeholder="Enter name..."
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload" className="text-sm font-medium">
              File Upload
            </Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
              <input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-3"
              >
                {selectedFile ? (
                  <div className="flex items-center gap-3 p-4 bg-background rounded-lg border w-full">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate">{selectedFile.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        Click to upload or drag and drop
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        PDF, DOC, JPG, PNG, XLS (max 10MB)
                      </div>
                    </div>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any relevant notes or comments about this document..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="min-w-[100px]">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedLead || !documentType || !documentName || uploading}
              className="min-w-[140px]"
            >
              {uploading ? (
                <>
                  <span className="animate-pulse">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
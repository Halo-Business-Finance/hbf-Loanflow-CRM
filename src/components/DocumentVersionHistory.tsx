import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  Download,
  RotateCcw,
  Upload,
  FileText,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useDocumentVersions } from '@/hooks/useDocumentVersions';
import { formatBytes } from '@/hooks/useFileUpload';

interface DocumentVersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export function DocumentVersionHistory({
  isOpen,
  onClose,
  documentId,
  documentName,
}: DocumentVersionHistoryProps) {
  const {
    versions,
    loading,
    uploadNewVersion,
    revertToVersion,
    downloadVersion,
  } = useDocumentVersions(documentId);

  const [showUploadNew, setShowUploadNew] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changeDescription, setChangeDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const handleUploadNewVersion = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const success = await uploadNewVersion(selectedFile, changeDescription);
    setUploading(false);

    if (success) {
      setSelectedFile(null);
      setChangeDescription('');
      setShowUploadNew(false);
    }
  };

  const handleRevert = async (versionNumber: number) => {
    if (
      !confirm(
        `Are you sure you want to revert to version ${versionNumber}? This will make it the current version.`
      )
    ) {
      return;
    }

    await revertToVersion(versionNumber);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <DialogTitle>Version History</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadNew(!showUploadNew)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload New Version
            </Button>
          </div>
          <DialogDescription>{documentName}</DialogDescription>
        </DialogHeader>

        {/* Upload New Version Section */}
        {showUploadNew && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Upload New Version</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUploadNew(false);
                  setSelectedFile(null);
                  setChangeDescription('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version-file">Select File</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  id="version-file"
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="version-file"
                  className="cursor-pointer flex flex-col items-center"
                >
                  {selectedFile ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatBytes(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm">Click to select file</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-description">
                Change Description (Optional)
              </Label>
              <Textarea
                id="change-description"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {changeDescription.length}/500
              </p>
            </div>

            <Button
              onClick={handleUploadNewVersion}
              disabled={!selectedFile || uploading}
              className="w-full"
            >
              {uploading ? 'Uploading...' : 'Upload Version'}
            </Button>
          </div>
        )}

        {/* Version List */}
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No version history available</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`p-4 border rounded-lg space-y-3 ${
                    version.is_current
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          v{version.version_number}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            Version {version.version_number}
                          </h4>
                          {version.is_current && (
                            <Badge className="bg-green-500">Current</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(
                              new Date(version.uploaded_at),
                              'MMM d, yyyy HH:mm'
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {formatBytes(version.file_size)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadVersion(version)}
                        title="Download this version"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!version.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevert(version.version_number)}
                          title="Revert to this version"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {version.change_description && (
                    <div className="pl-13">
                      <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                        {version.change_description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

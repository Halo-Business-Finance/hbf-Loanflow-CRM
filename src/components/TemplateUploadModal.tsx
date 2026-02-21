import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText } from "lucide-react"
import { ibmDb, ibmAuth, ibmStorage } from '@/lib/ibm'
import { useToast } from "@/hooks/use-toast"

interface TemplateUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const templateTypes = [
  { value: "Business Tax Returns", label: "Business Tax Returns" },
  { value: "Personal Tax Returns", label: "Personal Tax Returns" },
  { value: "P&L and Balance Sheet", label: "P&L and Balance Sheet" },
  { value: "Bank Statements", label: "Bank Statements" },
  { value: "Debt Schedule and Notes", label: "Debt Schedule and Notes" },
  { value: "Loan Application & Driver's License", label: "Loan Application & Driver's License" },
  { value: "AR & AP", label: "AR & AP" },
  { value: "Projections, Resume & Business Plan", label: "Projections, Resume & Business Plan" },
  { value: "SBA & Bank Documents", label: "SBA & Bank Documents" },
  { value: "Corp Articles, Operating Agreement & EIN Form", label: "Corp Articles, Operating Agreement & EIN Form" },
  { value: "Miscellaneous", label: "Miscellaneous" },
]

export function TemplateUploadModal({ isOpen, onClose, onSuccess }: TemplateUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [description, setDescription] = useState("")
  const [templateType, setTemplateType] = useState("")
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, Word document, or Excel file",
          variant: "destructive"
        })
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB",
          variant: "destructive"
        })
        return
      }

      setSelectedFile(file)
      if (!templateName) {
        setTemplateName(file.name.replace(/\.[^/.]+$/, ""))
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !templateName || !templateType) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setUploading(true)

    try {
      const session = await ibmAuth.getSession()
      const user = session?.user
      if (!user) throw new Error("Not authenticated")

      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}_${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await ibmStorage
        .from('document-templates')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { error: dbError } = await ibmDb
        .from('document_templates')
        .insert({
          name: templateName,
          description: description || null,
          template_type: templateType,
          file_path: filePath,
          file_format: fileExt || '',
          file_size: selectedFile.size,
          created_by: user.id
        })

      if (dbError) {
        await ibmStorage
          .from('document-templates')
          .remove([filePath])
        throw dbError
      }

      toast({
        title: "Success",
        description: "Template uploaded successfully"
      })

      setSelectedFile(null)
      setTemplateName("")
      setDescription("")
      setTemplateType("")
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload template",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Document Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., SBA Loan Application Form"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-type">Template Type *</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue placeholder="Select template type" />
              </SelectTrigger>
              <SelectContent>
                {templateTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Upload File *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6">
              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    PDF, Word, or Excel files (Max 10MB)
                  </p>
                  <label htmlFor="file-upload">
                    <Button variant="outline" size="sm" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !templateName || !templateType || uploading}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Template
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

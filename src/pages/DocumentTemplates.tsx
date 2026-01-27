import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Download, Plus, Trash2, Eye, Mail, Upload, Grid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TemplateUploadModal } from "@/components/TemplateUploadModal"
import { EmailComposer } from "@/components/EmailComposer"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { format } from "date-fns"

interface DocumentTemplate {
  id: string
  name: string
  description: string | null
  template_type: string
  file_path: string
  file_format: string
  file_size: number | null
  usage_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  last_modified: string
}

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [isVersionUploadOpen, setIsVersionUploadOpen] = useState(false)
  const [selectedTemplateForVersion, setSelectedTemplateForVersion] = useState<DocumentTemplate | null>(null)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const { toast } = useToast()
  const { canAccessAdminFeatures } = useRoleBasedAccess()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error: any) {
      console.error('Error fetching templates:', error)
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleView = async (template: DocumentTemplate) => {
    try {
      const { data } = supabase.storage
        .from('document_templates')
        .getPublicUrl(template.file_path)
      
      window.open(data.publicUrl, '_blank')
    } catch (error) {
      console.error("Error viewing template:", error)
      toast({
        title: "Error",
        description: "Failed to open template",
        variant: "destructive",
      })
    }
  }

  const handleDownload = async (template: DocumentTemplate) => {
    try {
      await supabase.rpc('increment_template_usage', {
        template_id: template.id
      })

      const { data, error } = await supabase.storage
        .from('document_templates')
        .download(template.file_path)

      if (error) throw error

      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = template.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "Template downloaded successfully",
      })

      fetchTemplates()
    } catch (error) {
      console.error("Error downloading template:", error)
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      })
    }
  }

  const handleRename = async (templateId: string) => {
    if (!newTemplateName.trim()) return

    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ name: newTemplateName })
        .eq('id', templateId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Template renamed successfully",
      })

      setEditingTemplate(null)
      setNewTemplateName("")
      fetchTemplates()
    } catch (error) {
      console.error("Error renaming template:", error)
      toast({
        title: "Error",
        description: "Failed to rename template",
        variant: "destructive",
      })
    }
  }

  const handleVersionUpload = async () => {
    if (!newVersionFile || !selectedTemplateForVersion) return

    try {
      const fileExt = newVersionFile.name.split('.').pop()
      const filePath = `${selectedTemplateForVersion.template_type}/${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('document_templates')
        .upload(filePath, newVersionFile)

      if (uploadError) throw uploadError

      // Delete old file
      await supabase.storage
        .from('document_templates')
        .remove([selectedTemplateForVersion.file_path])

      const { error: updateError } = await supabase
        .from('document_templates')
        .update({
          file_path: filePath,
          file_format: fileExt || 'pdf',
          file_size: newVersionFile.size,
          last_modified: new Date().toISOString()
        })
        .eq('id', selectedTemplateForVersion.id)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Template version updated successfully",
      })

      setIsVersionUploadOpen(false)
      setSelectedTemplateForVersion(null)
      setNewVersionFile(null)
      fetchTemplates()
    } catch (error) {
      console.error("Error uploading new version:", error)
      toast({
        title: "Error",
        description: "Failed to upload new version",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (templateId: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const { error: storageError } = await supabase.storage
        .from('document_templates')
        .remove([filePath])

      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('document_templates')
        .update({ is_active: false })
        .eq('id', templateId)

      if (dbError) throw dbError

      toast({
        title: "Success",
        description: "Template deleted successfully",
      })

      fetchTemplates()
    } catch (error) {
      console.error("Error deleting template:", error)
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      })
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTemplateTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      "Business Tax Returns": "Business Tax Returns",
      "Personal Tax Returns": "Personal Tax Returns",
      "P&L and Balance Sheet": "P&L and Balance Sheet",
      "Bank Statements": "Bank Statements",
      "Debt Schedule and Notes": "Debt Schedule and Notes",
      "Loan Application & Driver's License": "Loan Application & Driver's License",
      "AR & AP": "AR & AP",
      "Projections, Resume & Business Plan": "Projections, Resume & Business Plan",
      "SBA & Bank Documents": "SBA & Bank Documents",
      "Corp Articles, Operating Agreement & EIN Form": "Corp Articles, Operating Agreement & EIN Form",
      "Miscellaneous": "Miscellaneous"
    }
    return labels[type] || type
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <IBMPageHeader 
          title="Document Templates"
          subtitle="Manage and customize loan document templates"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border border-border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 w-7 p-0"
                >
                  <Grid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 w-7 p-0"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
              {canAccessAdminFeatures() && (
                <Button onClick={() => setShowUploadModal(true)} size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white gap-2">
                  <Plus className="h-3 w-3" />
                  Create Template
                </Button>
              )}
            </div>
          }
        />

        {/* Content Area */}
        <div className="space-y-6">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card className="bg-card border border-[#0A1628]">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No templates available</p>
              <p className="text-sm text-muted-foreground mb-4">
                {canAccessAdminFeatures() ? "Upload your first template to get started" : "Templates will appear here once uploaded"}
              </p>
              {canAccessAdminFeatures() && (
                <Button onClick={() => setShowUploadModal(true)} className="bg-[#0f62fe] hover:bg-[#0353e9] text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="bg-card border border-[#0A1628] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    {editingTemplate === template.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(template.id)
                            if (e.key === 'Escape') {
                              setEditingTemplate(null)
                              setNewTemplateName("")
                            }
                          }}
                          className="text-sm h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRename(template.id)}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTemplate(template.id)
                          setNewTemplateName(template.name)
                        }}
                        className="text-left hover:text-primary transition-colors flex items-center gap-2 flex-1"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <span className="line-clamp-1">{template.name}</span>
                      </button>
                    )}
                    {canAccessAdminFeatures() && !editingTemplate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id, template.file_path)}
                        className="text-destructive hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {template.description || getTemplateTypeLabel(template.template_type)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Type: {getTemplateTypeLabel(template.template_type)}</p>
                    <p>Size: {formatFileSize(template.file_size)}</p>
                    <p>Format: {template.file_format.toUpperCase()}</p>
                    <p>Last modified: {format(new Date(template.last_modified), 'MMM d, yyyy')}</p>
                    <p>Used: {template.usage_count} times</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(template)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(template)}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <EmailComposer
                    trigger={
                      <Button size="sm" variant="secondary" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Button>
                    }
                  />
                  {canAccessAdminFeatures() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplateForVersion(template)
                        setIsVersionUploadOpen(true)
                      }}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      New Version
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>

      {canAccessAdminFeatures() && (
        <TemplateUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={fetchTemplates}
        />
      )}

      <Dialog open={isVersionUploadOpen} onOpenChange={setIsVersionUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Current template: {selectedTemplateForVersion?.name}
              </p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsVersionUploadOpen(false)
                  setSelectedTemplateForVersion(null)
                  setNewVersionFile(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVersionUpload}
                disabled={!newVersionFile}
              >
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Search, FolderOpen, Upload, Users, ChevronRight, Grid, List, Trash2, Download, CheckSquare, FileText, Clock, AlertCircle, Maximize2, Minimize2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { useState, useMemo } from "react"
import { useDocuments } from "@/hooks/useDocuments"
import { DocumentUploadModal } from "@/components/DocumentUploadModal"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

interface LoanFolder {
  leadId: string
  leadName: string
  loanType: string
  location: string
  documentCount: number
  lastUpdated: string
  updatedBy: string
}

export default function Documents() {
  const { documents, loading, uploadDocument } = useDocuments()
  const [searchTerm, setSearchTerm] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [isCompact, setIsCompact] = useState(false)
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<'name' | 'updated' | 'size' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const navigate = useNavigate()

  // Group documents by lead to create folder structure
  const loanFolders = useMemo(() => {
    const folderMap = new Map<string, LoanFolder>()
    
    documents.forEach(doc => {
      if (!doc.lead_id) return
      
      const leadId = doc.lead_id
      const existing = folderMap.get(leadId)
      
      if (existing) {
        existing.documentCount++
        if (new Date(doc.updated_at) > new Date(existing.lastUpdated)) {
          existing.lastUpdated = doc.updated_at
        }
      } else {
        // Construct location from available fields
        const locationParts = [];
        if (doc.contact_entity?.business_city) locationParts.push(doc.contact_entity.business_city);
        if (doc.contact_entity?.business_state) locationParts.push(doc.contact_entity.business_state);
        const constructedLocation = locationParts.length > 0 
          ? locationParts.join(', ') 
          : (doc.contact_entity?.location || 'Location not specified');
        
        folderMap.set(leadId, {
          leadId,
          leadName: doc.contact_entity?.business_name || doc.contact_entity?.name || 'Unknown Business',
          loanType: doc.contact_entity?.loan_type || 'General',
          location: constructedLocation,
          documentCount: 1,
          lastUpdated: doc.updated_at,
          updatedBy: 'Loan Processing'
        })
      }
    })
    
    return Array.from(folderMap.values()).sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    )
  }, [documents])

  const filteredFolders = loanFolders.filter(folder =>
    folder.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    folder.loanType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    folder.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle sorting
  const handleSort = (column: 'name' | 'updated' | 'size') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Sort filtered folders
  const sortedFolders = useMemo(() => {
    if (!sortColumn) return filteredFolders

    return [...filteredFolders].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'name':
          comparison = a.leadName.localeCompare(b.leadName)
          break
        case 'updated':
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
          break
        case 'size':
          comparison = a.documentCount - b.documentCount
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredFolders, sortColumn, sortDirection])

  // Render sort icon
  const SortIcon = ({ column }: { column: 'name' | 'updated' | 'size' }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const recentUploads = documents.filter(doc => 
      new Date(doc.created_at) > sevenDaysAgo
    ).length
    
    const pendingDocuments = documents.filter(doc => 
      doc.status === 'pending' || doc.status === 'pending_review'
    ).length
    
    return {
      totalFolders: loanFolders.length,
      totalFiles: documents.length,
      recentUploads,
      pendingDocuments
    }
  }, [documents, loanFolders])

  const handleFolderClick = (leadId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox area
    if ((event.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    navigate(`/documents/loan/${leadId}`)
  }

  const toggleSelectFolder = (leadId: string) => {
    setSelectedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(leadId)) {
        newSet.delete(leadId)
      } else {
        newSet.add(leadId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedFolders.size === filteredFolders.length) {
      setSelectedFolders(new Set())
    } else {
      setSelectedFolders(new Set(filteredFolders.map(f => f.leadId)))
    }
  }

  const handleBulkDelete = () => {
    // Placeholder for bulk delete functionality
    console.log('Bulk delete:', Array.from(selectedFolders))
    setSelectedFolders(new Set())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-32 bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
              <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
          {/* Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse"></div>
            ))}
          </div>
          {/* Content Skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <IBMPageHeader 
          title="Loan Documents"
          subtitle="Document Command Center - Loan Document Management"
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
              {viewMode === 'list' && (
                <Button
                  variant={isCompact ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsCompact(!isCompact)}
                  className="h-8 gap-2"
                >
                  {isCompact ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="text-xs">{isCompact ? 'Normal' : 'Compact'}</span>
                </Button>
              )}
              <Button onClick={() => setShowUploadModal(true)} size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white gap-2">
                <Upload className="h-3 w-3" />
                New
              </Button>
            </div>
          }
        />

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border border-[#0A1628] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Folders</p>
                  <p className="text-2xl font-bold text-primary">{metrics.totalFolders}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-[#0A1628] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-bold text-primary">{metrics.totalFiles}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-[#0A1628] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Recent Uploads</p>
                  <p className="text-2xl font-bold text-primary">{metrics.recentUploads}</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-[#0A1628] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Pending Documents</p>
                  <p className="text-2xl font-bold text-primary">{metrics.pendingDocuments}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Selection Controls */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              className="pl-10 border-[#0A1628]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {selectedFolders.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedFolders.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFolders(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {/* Folder Header */}
          {sortedFolders.length > 0 && (
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div className="col-span-5 flex items-center gap-3">
              <Checkbox
                checked={selectedFolders.size === sortedFolders.length && sortedFolders.length > 0}
                onCheckedChange={toggleSelectAll}
                className="mt-0.5"
                data-checkbox
              />
              <button
                onClick={() => handleSort('name')}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                NAME
                <SortIcon column="name" />
              </button>
            </div>
            <button
              onClick={() => handleSort('updated')}
              className="col-span-4 flex items-center gap-2 hover:text-foreground transition-colors"
            >
              UPDATED
              <SortIcon column="updated" />
            </button>
            <button
              onClick={() => handleSort('size')}
              className="col-span-3 text-right flex items-center justify-end gap-2 hover:text-foreground transition-colors"
            >
              SIZE
              <SortIcon column="size" />
            </button>
          </div>
        )}

        {/* Folder List/Grid */}
        {sortedFolders.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No loan folders found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Try adjusting your search" 
                : "Upload documents to create loan folders"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowUploadModal(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload First Document
              </Button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {sortedFolders.map((folder) => (
              <div
                key={folder.leadId}
                onClick={(e) => handleFolderClick(folder.leadId, e)}
                className={`w-full grid grid-cols-12 gap-4 px-4 ${isCompact ? 'py-2' : 'py-3'} rounded-lg hover:bg-muted/50 transition-colors cursor-pointer items-center group ${
                  selectedFolders.has(folder.leadId) ? 'bg-muted/50 ring-2 ring-primary' : ''
                }`}
              >
                {/* Checkbox and Folder Icon */}
                <div className="col-span-5 flex items-center gap-3">
                  <Checkbox
                    checked={selectedFolders.has(folder.leadId)}
                    onCheckedChange={() => toggleSelectFolder(folder.leadId)}
                    onClick={(e) => e.stopPropagation()}
                    data-checkbox
                  />
                  <div className="relative">
                    <FolderOpen className={`${isCompact ? 'h-6 w-6' : 'h-8 w-8'} text-blue-500 group-hover:text-blue-600 transition-colors`} />
                    <Users className={`absolute -bottom-0.5 -right-0.5 ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-blue-600 bg-white dark:bg-background rounded-full p-0.5`} />
                  </div>
                  <div>
                    <div className={`font-medium text-foreground ${isCompact ? 'text-sm' : ''}`}>
                      {folder.leadName} - {folder.loanType}
                    </div>
                    {folder.location && (
                      <div className="text-xs text-muted-foreground">
                        {folder.location}
                      </div>
                    )}
                  </div>
                </div>

                {/* Updated Info */}
                <div className={`col-span-4 text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>
                  {format(new Date(folder.lastUpdated), 'MMM d, yyyy')} by {folder.updatedBy}
                </div>

                {/* File Count */}
                <div className={`col-span-3 text-right text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>
                  {folder.documentCount} {folder.documentCount === 1 ? 'File' : 'Files'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedFolders.map((folder) => (
              <div
                key={folder.leadId}
                onClick={(e) => handleFolderClick(folder.leadId, e)}
                className={`relative p-4 rounded-lg border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group ${
                  selectedFolders.has(folder.leadId) ? 'border-primary shadow-md ring-2 ring-primary' : 'border-border'
                }`}
              >
                {/* Checkbox */}
                <div className="absolute top-3 right-3 z-10" data-checkbox>
                  <Checkbox
                    checked={selectedFolders.has(folder.leadId)}
                    onCheckedChange={() => toggleSelectFolder(folder.leadId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Folder Icon */}
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="relative">
                    <FolderOpen className="h-16 w-16 text-blue-500 group-hover:text-blue-600 transition-colors" />
                    <Users className="absolute -bottom-1 -right-1 h-5 w-5 text-blue-600 bg-white dark:bg-background rounded-full p-0.5" />
                  </div>
                  
                  {/* Folder Info */}
                  <div className="w-full">
                    <h3 className="font-medium text-foreground truncate mb-1">
                      {folder.leadName}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {folder.loanType}
                    </p>
                    {folder.location && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {folder.location}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="w-full pt-3 border-t border-border space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Files</span>
                      <span className="font-medium">{folder.documentCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(folder.lastUpdated), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State Illustration */}
        {sortedFolders.length === 0 && !searchTerm && (
          <div className="flex justify-center mt-8">
            <div className="text-center space-y-4 max-w-md">
              <div className="relative inline-block">
                <FolderOpen className="h-32 w-32 text-blue-500/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl">📁</div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Select a file or folder to view details.
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={uploadDocument}
      />
    </div>
  )
}

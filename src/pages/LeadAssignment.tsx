import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserPlus, Loader2, BarChart3, Users, Search, Filter, X, CheckCircle2 } from "lucide-react"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription"
import { Badge } from "@/components/ui/badge"
import { LeadScoring } from "@/components/ai/LeadScoring"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface UnassignedLead {
  id: string
  name: string
  email: string
  stage: string
  priority: string
  lead_id: string
}

interface RecentlyAssignedLead {
  id: string
  name: string
  email: string
  stage: string
  priority: string
  lead_id: string
  assigned_to: string
  assigned_to_name: string
  assigned_at: string
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  leadCount: number
}

export default function LeadAssignmentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [unassignedLeads, setUnassignedLeads] = useState<UnassignedLead[]>([])
  const [recentlyAssignedLeads, setRecentlyAssignedLeads] = useState<RecentlyAssignedLead[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<{ [key: string]: string }>({})
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [bulkAssignAgent, setBulkAssignAgent] = useState('')
  const [isBulkAssigning, setIsBulkAssigning] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const { toast } = useToast()

  // Fetch unassigned leads (leads without user assignment)
  const fetchUnassignedLeads = async () => {
    try {
      // Step 1: get unassigned leads ids only (avoid cross-table RLS join issues)
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`id, contact_entity_id, created_at`)
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (leadsError) throw leadsError

      if (!leads || leads.length === 0) {
        setUnassignedLeads([])
        return
      }

      const contactIds = leads.map(l => l.contact_entity_id).filter(Boolean)

      // Step 2: fetch related contact details
      const { data: contacts, error: contactsError } = await supabase
        .from('contact_entities')
        .select('id, name, email, stage, priority')
        .in('id', contactIds as string[])

      if (contactsError) throw contactsError

      const contactsById = new Map((contacts || []).map(c => [c.id, c]))

      const formattedLeads = (leads || []).map(lead => {
        const ce: any = contactsById.get(lead.contact_entity_id)
        return ce ? {
          id: ce.id,
          lead_id: lead.id,
          name: ce.name,
          email: ce.email,
          stage: ce.stage || 'New',
          priority: ce.priority || 'Medium'
        } : null
      }).filter(Boolean) as UnassignedLead[]

      setUnassignedLeads(formattedLeads)
    } catch (error: any) {
      console.error('Error fetching unassigned leads:', error)
      toast({
        title: "Error",
        description: `Failed to load unassigned leads${error?.message ? `: ${error.message}` : ''}`,
        variant: "destructive"
      })
    }
  }

  // Fetch recently assigned leads (assigned in the last 24 hours)
  const fetchRecentlyAssignedLeads = async () => {
    try {
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      // Step 1: Get recently assigned leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`id, contact_entity_id, user_id, assigned_at, created_at`)
        .not('user_id', 'is', null)
        .not('assigned_at', 'is', null)
        .gte('assigned_at', twentyFourHoursAgo.toISOString())
        .order('assigned_at', { ascending: false })
        .limit(50)

      if (leadsError) throw leadsError

      if (!leads || leads.length === 0) {
        setRecentlyAssignedLeads([])
        return
      }

      const contactIds = leads.map(l => l.contact_entity_id).filter(Boolean)
      const userIds = leads.map(l => l.user_id).filter(Boolean)

      // Step 2: Fetch contact details
      const { data: contacts, error: contactsError } = await supabase
        .from('contact_entities')
        .select('id, name, email, stage, priority')
        .in('id', contactIds as string[])

      if (contactsError) throw contactsError

      // Step 3: Fetch user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds as string[])

      if (profilesError) throw profilesError

      const contactsById = new Map((contacts || []).map(c => [c.id, c]))
      const profilesById = new Map((profiles || []).map(p => [p.id, p]))

      const formattedLeads = (leads || []).map(lead => {
        const ce: any = contactsById.get(lead.contact_entity_id)
        const profile: any = profilesById.get(lead.user_id!)
        return ce && profile ? {
          id: ce.id,
          lead_id: lead.id,
          name: ce.name,
          email: ce.email,
          stage: ce.stage || 'New',
          priority: ce.priority || 'Medium',
          assigned_to: lead.user_id!,
          assigned_to_name: `${profile.first_name} ${profile.last_name}`,
          assigned_at: lead.assigned_at!
        } : null
      }).filter(Boolean) as RecentlyAssignedLead[]

      setRecentlyAssignedLeads(formattedLeads)
    } catch (error: any) {
      console.error('Error fetching recently assigned leads:', error)
      toast({
        title: "Error",
        description: `Failed to load recently assigned leads${error?.message ? `: ${error.message}` : ''}`,
        variant: "destructive"
      })
    }
  }

  // Fetch team members with lead counts
  const fetchTeamMembers = async () => {
    try {
      // Get all active team members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)

      if (profilesError) throw profilesError

      // Get lead counts using secure RPC function
      const { data: leadCounts, error: countsError } = await supabase
        .rpc('get_lead_counts')

      if (countsError) throw countsError

      // Combine profiles with lead counts
      const countsMap = new Map((leadCounts || []).map((lc: any) => [lc.user_id, lc.lead_count]))
      
      const membersWithCounts = (profiles || []).map((profile) => ({
        ...profile,
        leadCount: countsMap.get(profile.id) || 0
      }))

      setTeamMembers(membersWithCounts)
    } catch (error) {
      console.error('Error fetching team members:', error)
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      })
    }
  }

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchUnassignedLeads(), fetchRecentlyAssignedLeads(), fetchTeamMembers()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Real-time updates for leads
  useRealtimeSubscription({
    table: 'leads',
    onChange: () => {
      fetchUnassignedLeads()
      fetchRecentlyAssignedLeads()
      fetchTeamMembers()
    }
  })

  // Handle assignment
  const handleAssignment = async (leadId: string) => {
    const agentId = selectedAgent[leadId]
    if (!agentId) {
      toast({
        title: "No agent selected",
        description: "Please select an agent before assigning",
        variant: "destructive"
      })
      return
    }

    const lead = unassignedLeads.find(l => l.id === leadId)
    if (!lead) return

    setAssigning(leadId)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ user_id: agentId })
        .eq('id', lead.lead_id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Lead assigned successfully"
      })

      // Refresh data
      await Promise.all([fetchUnassignedLeads(), fetchRecentlyAssignedLeads(), fetchTeamMembers()])
      
      // Clear selection
      setSelectedAgent(prev => {
        const newState = { ...prev }
        delete newState[leadId]
        return newState
      })
    } catch (error) {
      console.error('Error assigning lead:', error)
      toast({
        title: "Error",
        description: "Failed to assign lead",
        variant: "destructive"
      })
    } finally {
      setAssigning(null)
    }
  }

  // Toggle individual lead selection
  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads)
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId)
    } else {
      newSelection.add(leadId)
    }
    setSelectedLeads(newSelection)
  }

  // Toggle select all filtered leads
  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)))
    }
  }

  // Clear filters
  const clearFilters = () => {
    setFilterPriority('all')
    setFilterStage('all')
    setSearchTerm('')
  }

  const hasActiveFilters = filterPriority !== 'all' || filterStage !== 'all' || searchTerm !== ''

  // Bulk assign leads
  const handleBulkAssign = async () => {
    if (selectedLeads.size === 0) {
      toast({
        title: "No leads selected",
        description: "Please select at least one lead to assign",
        variant: "destructive"
      })
      return
    }

    if (!bulkAssignAgent) {
      toast({
        title: "No agent selected",
        description: "Please select an agent to assign leads to",
        variant: "destructive"
      })
      return
    }

    setIsBulkAssigning(true)
    try {
      const leadIds = Array.from(selectedLeads).map(contactId => {
        const lead = unassignedLeads.find(l => l.id === contactId)
        return lead?.lead_id
      }).filter(Boolean) as string[]

      let successCount = 0
      let failCount = 0

      for (const leadId of leadIds) {
        try {
          const { error } = await supabase
            .from('leads')
            .update({ user_id: bulkAssignAgent })
            .eq('id', leadId)

          if (error) throw error
          successCount++
        } catch (error) {
          console.error('Error assigning lead:', error)
          failCount++
        }
      }

      toast({
        title: "Bulk Assignment Complete",
        description: `Successfully assigned ${successCount} lead${successCount !== 1 ? 's' : ''}${failCount > 0 ? `. Failed: ${failCount}` : ''}`,
      })

      // Refresh data and clear selections
      await Promise.all([fetchUnassignedLeads(), fetchRecentlyAssignedLeads(), fetchTeamMembers()])
      setSelectedLeads(new Set())
      setBulkAssignAgent('')
    } catch (error) {
      console.error('Error in bulk assignment:', error)
      toast({
        title: "Error",
        description: "Failed to complete bulk assignment",
        variant: "destructive"
      })
    } finally {
      setIsBulkAssigning(false)
    }
  }

  // Filter leads
  const filteredLeads = unassignedLeads.filter(lead => {
    const matchesSearch = searchTerm === '' || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesPriority = filterPriority === 'all' || 
      lead.priority.toLowerCase() === filterPriority.toLowerCase()
    
    const matchesStage = filterStage === 'all' || 
      lead.stage.toLowerCase() === filterStage.toLowerCase()

    return matchesSearch && matchesPriority && matchesStage
  })

  return (
    <div className="flex flex-col h-full bg-background">
      <IBMPageHeader 
        title="Lead Assignment"
        subtitle="Assign leads to team members and view performance statistics"
        actions={
          <div className="flex items-center gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <Filter className="h-3 w-3 mr-2" />
                  Filter
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs">
                      !
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium mb-3">Filter Leads</h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Priority</label>
                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Stage</label>
                    <Select value={filterStage} onValueChange={setFilterStage}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        }
      />
      <div className="p-8 space-y-8 animate-fade-in">
        
        <Tabs value={location.pathname} onValueChange={(value) => navigate(value)}>
            <TabsList className="flex w-full bg-black/90 p-0 h-auto rounded-lg overflow-hidden">
              <TabsTrigger 
                value="/leads/assignment" 
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-none border-0 data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white data-[state=inactive]:bg-black/90 data-[state=inactive]:text-white hover:bg-[#0f62fe]/80 transition-colors flex-1"
              >
                <span className="font-medium">Lead Assignment</span>
                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/20 text-xs font-semibold">
                  {filteredLeads.length}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="/leads/recently-assigned" 
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-none border-0 data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white data-[state=inactive]:bg-black/90 data-[state=inactive]:text-white hover:bg-[#0f62fe]/80 transition-colors flex-1"
              >
                <span className="font-medium">Recently Assigned</span>
                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/20 text-xs font-semibold">
                  {recentlyAssignedLeads.length}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="/leads/stats" 
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-none border-0 data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white data-[state=inactive]:bg-black/90 data-[state=inactive]:text-white hover:bg-[#0f62fe]/80 transition-colors flex-1"
              >
                <span className="font-medium">Lead Stats</span>
                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/20 text-xs font-semibold">
                  {teamMembers.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Bulk Actions Bar */}
          {selectedLeads.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLeads(new Set())}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={bulkAssignAgent} onValueChange={setBulkAssignAgent}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Select agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkAssign}
                  disabled={isBulkAssigning || !bulkAssignAgent}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isBulkAssigning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Assign {selectedLeads.size} Lead{selectedLeads.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name or email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-4 px-8 pb-8">
        {location.pathname === '/leads/recently-assigned' ? (
          /* Recently Assigned Leads View */
          <StandardContentCard
            title="Recently Assigned Leads (Last 24 Hours)"
            className="border border-blue-600"
          >
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 py-3 border-b">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))
              ) : recentlyAssignedLeads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No leads assigned in the last 24 hours</p>
                </div>
              ) : (
                recentlyAssignedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0 hover:bg-muted/50 rounded px-3"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10 mt-1">
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                          {lead.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {lead.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">{lead.email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 bg-muted rounded">{lead.stage}</span>
                          <span>•</span>
                          <span>Assigned to: <span className="font-medium text-foreground">{lead.assigned_to_name}</span></span>
                          <span>•</span>
                          <span>{new Date(lead.assigned_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </StandardContentCard>
        ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Unassigned Leads */}
          <StandardContentCard
            title="Unassigned Leads"
            className="h-fit border border-blue-600"
              headerActions={
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-7 text-xs"
                  >
                    {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 py-3 border-b">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-[140px]" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  ))
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">
                      {hasActiveFilters ? 'No leads match your filters' : 'No unassigned leads'}
                    </p>
                    <p className="text-xs mt-1">
                      {hasActiveFilters ? 'Try adjusting your filter criteria' : 'All leads are fully assigned'}
                    </p>
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <div key={lead.id} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{lead.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {lead.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {lead.stage}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={selectedAgent[lead.id] || ""}
                          onValueChange={(value) => setSelectedAgent(prev => ({ ...prev, [lead.id]: value }))}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.first_name} {member.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleAssignment(lead.id)}
                          disabled={assigning === lead.id || !selectedAgent[lead.id]}
                        >
                          {assigning === lead.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
          </StandardContentCard>

          {/* Team Workload */}
          <StandardContentCard
            title="Team Workload"
            className="h-fit border border-blue-600"
              headerActions={
                <span className="text-sm text-muted-foreground">
                  Current lead distribution among team members
                </span>
              }
            >
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No team members found</p>
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{member.first_name} {member.last_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.leadCount} active leads
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold">
                        {member.leadCount}
                      </span>
                    </div>
                  ))
                )}
              </div>
          </StandardContentCard>
        </div>
        )}
        
        {/* Assignment Rules */}
        <StandardContentCard title="Assignment Rules" className="border border-blue-600">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure automatic lead assignment rules
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Default Assignment</label>
                  <Select defaultValue="round-robin">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">Round Robin</SelectItem>
                      <SelectItem value="least-busy">Least Busy</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">High Priority Leads</label>
                  <Select defaultValue="senior">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="senior">Senior Agents</SelectItem>
                      <SelectItem value="available">Next Available</SelectItem>
                      <SelectItem value="specific">Specific Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Max Leads per Agent</label>
                  <Select defaultValue="20">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-2">
                <Button size="sm" className="h-9">Save Assignment Rules</Button>
            </div>
          </div>
        </StandardContentCard>

        {/* AI Lead Scoring Section */}
        <LeadScoring />
      </div>
    </div>
  )
}
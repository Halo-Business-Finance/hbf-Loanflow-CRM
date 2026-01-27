import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"

interface RelatedLead {
  id: string
  stage: string
  priority: string
  loan_amount: number
  loan_type: string
  created_at: string
  contact_entity: {
    name: string
    email: string
    business_name: string
  }
}

interface RelatedLeadsTableProps {
  lenderId: string
}

export function RelatedLeadsTable({ lenderId }: RelatedLeadsTableProps) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<RelatedLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (lenderId) {
      fetchRelatedLeads()
    }
  }, [lenderId])

  const fetchRelatedLeads = async () => {
    try {
      setLoading(true)

      // Fetch contact_entities with this lender_id, then get their leads
      const { data: contactsData, error: contactsError } = await supabase
        .from('contact_entities')
        .select('id, name, email, business_name, stage, priority, loan_amount, loan_type, created_at')
        .eq('lender_id', lenderId)
        .order('created_at', { ascending: false })

      if (contactsError) throw contactsError

      // Now fetch the leads for these contact entities
      if (contactsData && contactsData.length > 0) {
        const contactIds = contactsData.map(c => c.id)
        
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, contact_entity_id')
          .in('contact_entity_id', contactIds)

        if (leadsError) throw leadsError

        // Map the data together
        const relatedLeads = leadsData?.map(lead => {
          const contact = contactsData.find(c => c.id === lead.contact_entity_id)
          return {
            id: lead.id,
            stage: contact?.stage || 'N/A',
            priority: contact?.priority || 'medium',
            loan_amount: contact?.loan_amount || 0,
            loan_type: contact?.loan_type || 'N/A',
            created_at: contact?.created_at || '',
            contact_entity: {
              name: contact?.name || '',
              email: contact?.email || '',
              business_name: contact?.business_name || ''
            }
          }
        }) || []

        setLeads(relatedLeads)
      } else {
        setLeads([])
      }
    } catch (error) {
      console.error('Error fetching related leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStageColor = (stage: string) => {
    if (stage?.toLowerCase().includes('funded')) return 'default'
    if (stage?.toLowerCase().includes('approved')) return 'default'
    if (stage?.toLowerCase().includes('denied')) return 'destructive'
    return 'secondary'
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading related leads...
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leads assigned to this lender yet
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact Name</TableHead>
          <TableHead>Business</TableHead>
          <TableHead>Loan Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id} className="hover:bg-muted/50">
            <TableCell>
              <div className="font-medium">{lead.contact_entity.name}</div>
              <div className="text-sm text-muted-foreground">{lead.contact_entity.email}</div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{lead.contact_entity.business_name || 'N/A'}</div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{lead.loan_type}</div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{formatCurrency(lead.loan_amount)}</div>
            </TableCell>
            <TableCell>
              <Badge variant={getStageColor(lead.stage)}>
                {lead.stage}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getPriorityColor(lead.priority)}>
                {lead.priority}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm text-muted-foreground">
                {format(new Date(lead.created_at), 'MMM d, yyyy')}
              </div>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

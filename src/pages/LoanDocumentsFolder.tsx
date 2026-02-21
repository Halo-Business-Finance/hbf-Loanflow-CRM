import { StandardPageLayout } from '@/components/StandardPageLayout'
import { IBMPageHeader } from '@/components/ui/IBMPageHeader'
import { BorrowerDocumentsWidget } from '@/components/BorrowerDocumentsWidget'
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ibmDb } from '@/lib/ibm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Building2 } from 'lucide-react'

interface LeadInfo {
  id: string
  contact_entity?: {
    name: string
    business_name?: string
    loan_type?: string
    location?: string
  }
}

export default function LoanDocumentsFolder() {
  const { leadId } = useParams<{ leadId: string }>()
  const navigate = useNavigate()
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeadInfo = async () => {
      if (!leadId) return

      try {
        // First try to get info from lead_documents since we know documents exist for this lead_id
        const { data: docData, error: docError } = await ibmDb
          .from('lead_documents')
          .select(`
            contact_entity:contact_entities!contact_entity_id(
              name,
              business_name,
              loan_type,
              location,
              business_city,
              business_state
            )
          `)
          .eq('lead_id', leadId)
          .limit(1)
          .maybeSingle()

        if (docError) throw docError

        if (docData?.contact_entity) {
          const ce = docData.contact_entity as any
          const locationParts: string[] = []
          if (ce.business_city) locationParts.push(ce.business_city)
          if (ce.business_state) locationParts.push(ce.business_state)
          const constructedLocation = locationParts.length > 0 
            ? locationParts.join(', ') 
            : (ce.location || '')

          setLeadInfo({
            id: leadId,
            contact_entity: {
              ...ce,
              location: constructedLocation
            }
          })
        } else {
          // Fallback: try querying leads table
          const { data: leadData, error: leadError } = await ibmDb
            .from('leads')
            .select(`
              id,
              contact_entity:contact_entities!contact_entity_id(
                name,
                business_name,
                loan_type,
                location
              )
            `)
            .eq('id', leadId)
            .maybeSingle()

          if (leadError) throw leadError
          setLeadInfo(leadData as unknown as LeadInfo)
        }
      } catch (error) {
        console.error('Error fetching lead info:', error)
        setLeadInfo(null)
      } finally {
        setLoading(false)
      }
    }

    fetchLeadInfo()
  }, [leadId])

  if (loading) {
    return (
      <StandardPageLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-4"></div>
            <div className="h-4 bg-muted rounded w-96"></div>
          </div>
        </div>
      </StandardPageLayout>
    )
  }

  if (!leadInfo || !leadId) {
    return (
      <StandardPageLayout>
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Loan not found</h2>
          <Button onClick={() => navigate('/documents')}>
            Back to Documents
          </Button>
        </div>
      </StandardPageLayout>
    )
  }

  const businessName = leadInfo.contact_entity?.business_name || leadInfo.contact_entity?.name || 'Unknown Business'
  const loanType = leadInfo.contact_entity?.loan_type || 'Loan'
  const location = leadInfo.contact_entity?.location

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title={`${businessName} - ${loanType}`}
        subtitle={location || 'Loan document management'}
        actions={
          <Button variant="outline" onClick={() => navigate('/documents')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to All Loans
          </Button>
        }
      />
      <div className="p-6">
        <BorrowerDocumentsWidget
          leadId={leadId} 
          contactEntityId={leadInfo.contact_entity?.name || ''} 
        />
      </div>
    </StandardPageLayout>
  )
}

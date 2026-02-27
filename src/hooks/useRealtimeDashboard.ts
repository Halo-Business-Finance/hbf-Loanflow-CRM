import { useState, useEffect } from 'react'
import { ibmDb } from '@/lib/ibm'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeSubscription } from './useRealtimeSubscription'

interface DashboardStats {
  totalLeads: number
  activeLeads: number
  totalClients: number
  totalLoans: number
  pipelineValue: number
  conversionRate: number
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
}

export function useRealtimeDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    activeLeads: 0,
    totalClients: 0,
    totalLoans: 0,
    pipelineValue: 0,
    conversionRate: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch leads (no joins — IBM REST doesn't support them)
      const { data: leadsData } = await ibmDb
        .from('leads')
        .select('id, contact_entity_id, created_at')

      // Collect contact_entity_ids to fetch separately
      const contactIds = (leadsData || [])
        .map((l: any) => l.contact_entity_id)
        .filter(Boolean)

      let contactsMap = new Map<string, any>()

      if (contactIds.length > 0) {
        const { data: contactsData } = await ibmDb
          .from('contact_entities')
          .select('id, stage, priority, loan_amount')
          .in('id', contactIds)

        contactsMap = new Map(
          (contactsData || []).map((c: any) => [c.id, c])
        )
      }

      // Fetch clients
      const { data: clientsData } = await ibmDb
        .from('clients')
        .select('id, total_loans, total_loan_value')

      // Merge leads with their contact entities
      const enrichedLeads = (leadsData || []).map((lead: any) => ({
        ...lead,
        contact_entity: contactsMap.get(lead.contact_entity_id) || null,
      }))

      // Calculate stats
      const totalLeads = enrichedLeads.length
      const activeLeads = enrichedLeads.filter((lead: any) =>
        lead.contact_entity?.stage && !['Loan Funded', 'Archive'].includes(lead.contact_entity.stage)
      ).length

      const totalClients = clientsData?.length || 0
      const totalLoans = (clientsData as any[])?.reduce(
        (sum, client) => sum + (client.total_loans || 0), 0
      ) || 0

      const pipelineValue = enrichedLeads.reduce(
        (sum: number, lead: any) => sum + (lead.contact_entity?.loan_amount || 0), 0
      )

      const convertedLeads = enrichedLeads.filter(
        (lead: any) => lead.contact_entity?.stage === 'Loan Funded'
      ).length

      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      setStats({
        totalLeads,
        activeLeads,
        totalClients,
        totalLoans,
        pipelineValue,
        conversionRate,
        recentActivity: []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useRealtimeSubscription({ table: 'leads', onChange: () => fetchDashboardData() })
  useRealtimeSubscription({ table: 'clients', onChange: () => fetchDashboardData() })
  useRealtimeSubscription({ table: 'contact_entities', onChange: () => fetchDashboardData() })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  return { stats, loading, refetch: fetchDashboardData }
}

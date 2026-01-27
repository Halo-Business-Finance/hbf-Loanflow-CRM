import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
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

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select(`
          id,
          created_at,
          contact_entity:contact_entities!contact_entity_id(
            stage,
            priority,
            loan_amount
          )
        `)

      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, total_loans, total_loan_value')

      // Calculate stats
      const totalLeads = leadsData?.length || 0
      const activeLeads = leadsData?.filter(lead => 
        lead.contact_entity?.stage && !['Loan Funded', 'Archive'].includes(lead.contact_entity.stage)
      ).length || 0
      
      const totalClients = clientsData?.length || 0
      const totalLoans = clientsData?.reduce((sum, client) => sum + (client.total_loans || 0), 0) || 0
      
      const pipelineValue = leadsData?.reduce((sum, lead) => 
        sum + (lead.contact_entity?.loan_amount || 0), 0
      ) || 0
      
      const convertedLeads = leadsData?.filter(lead => 
        lead.contact_entity?.stage === 'Loan Funded'
      ).length || 0
      
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

  // Set up real-time subscriptions
  useRealtimeSubscription({
    table: 'leads',
    onChange: () => {
      fetchDashboardData()
    }
  })

  useRealtimeSubscription({
    table: 'clients',
    onChange: () => {
      fetchDashboardData()
    }
  })

  useRealtimeSubscription({
    table: 'contact_entities',
    onChange: () => {
      fetchDashboardData()
    }
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  return {
    stats,
    loading,
    refetch: fetchDashboardData
  }
}
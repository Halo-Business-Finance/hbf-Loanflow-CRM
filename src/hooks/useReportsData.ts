import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface MonthlyData {
  month: string
  loans: number
  volume: number
}

interface TopPerformer {
  name: string
  loans: number
  volume: string
  rate: number
  user_id: string
}

interface ReportMetrics {
  loanVolume: {
    thisMonth: string
    lastMonth: string
    growth: string
    target: string
    completion: number
  }
  applications: {
    total: number
    approved: number
    pending: number
    rejected: number
    approvalRate: number
  }
  performance: {
    avgProcessingTime: string
    targetTime: string
    improvement: string
    customerSatisfaction: number
  }
  teamActivity: {
    activeLoanOfficers: number
    loansProcessed: number
    customerContacts: number
  }
}

export function useReportsData() {
  const [reportData, setReportData] = useState<ReportMetrics | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchReportsData()
  }, [])

  const fetchReportsData = async () => {
    try {
      setLoading(true)
      
      // Fetch current month and last month data
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1
      const currentYear = currentDate.getFullYear()
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

      // Get loan volumes for current and last month
      const { data: currentMonthLoans } = await supabase
        .from('loans')
        .select('loan_amount')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('created_at', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)

      const { data: lastMonthLoans } = await supabase
        .from('loans')
        .select('loan_amount')
        .gte('created_at', `${lastMonthYear}-${lastMonth.toString().padStart(2, '0')}-01`)
        .lt('created_at', `${lastMonthYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const currentMonthVolume = currentMonthLoans?.reduce((sum, loan) => sum + (Number(loan.loan_amount) || 0), 0) || 0
      const lastMonthVolume = lastMonthLoans?.reduce((sum, loan) => sum + (Number(loan.loan_amount) || 0), 0) || 0
      const growth = lastMonthVolume > 0 ? ((currentMonthVolume - lastMonthVolume) / lastMonthVolume * 100).toFixed(1) : "0"
      const target = 5000000 // $5M target
      const completion = target > 0 ? Math.round((currentMonthVolume / target) * 100) : 0

      // Get leads data for applications metrics (using leads table with contact entities)
      const { data: allLeads } = await supabase
        .from('leads')
        .select(`
          created_at,
          contact_entity:contact_entities!contact_entity_id (
            stage
          )
        `)
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const total = allLeads?.length || 0
      const approved = allLeads?.filter(lead => lead.contact_entity?.stage === 'Funded' || lead.contact_entity?.stage === 'Closed').length || 0
      const pending = allLeads?.filter(lead => ['Application', 'Pre-approval', 'Documentation', 'Closing'].includes(lead.contact_entity?.stage || '')).length || 0
      const rejected = allLeads?.filter(lead => lead.contact_entity?.stage === 'Rejected').length || 0
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

      // Get cases data for performance metrics
      const { data: cases } = await supabase
        .from('cases')
        .select('created_at, resolution_date, customer_satisfaction_score')
        .not('resolution_date', 'is', null)
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const avgProcessingTime = cases && cases.length > 0 
        ? Math.round(cases.reduce((sum, case_item) => {
            const created = new Date(case_item.created_at)
            const resolved = new Date(case_item.resolution_date!)
            return sum + ((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / cases.length)
        : 18

      const avgSatisfaction = cases && cases.length > 0
        ? cases.reduce((sum, case_item) => sum + (case_item.customer_satisfaction_score || 0), 0) / cases.length
        : 4.6

      // Get team activity data - count unique users who have created loans/leads
      const { data: loanCreators } = await supabase
        .from('loans')
        .select('user_id')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const { data: leadCreators } = await supabase
        .from('leads')
        .select('user_id')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const uniqueUsers = new Set([
        ...(loanCreators?.map(l => l.user_id) || []),
        ...(leadCreators?.map(l => l.user_id) || [])
      ])

      const activeLoanOfficers = uniqueUsers.size || 1
      const loansProcessed = (currentMonthLoans?.length || 0) + approved
      const customerContacts = total * 3 // Estimate 3 contacts per application

      // Get monthly data for charts (last 6 months)
      const monthlyChartData: MonthlyData[] = []
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const monthName = monthNames[date.getMonth()]

        const { data: monthLoans } = await supabase
          .from('loans')
          .select('loan_amount')
          .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
          .lt('created_at', month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`)

        const volume = monthLoans?.reduce((sum, loan) => sum + (Number(loan.loan_amount) || 0), 0) || 0
        const count = monthLoans?.length || 0

        monthlyChartData.push({
          month: monthName,
          loans: count,
          volume: volume
        })
      }

      // Get top performers (users with most loans this month)
      const { data: userLoans } = await supabase
        .from('loans')
        .select('user_id, loan_amount')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

      const performerMap = new Map<string, { loans: number; volume: number }>()
      userLoans?.forEach(loan => {
        const current = performerMap.get(loan.user_id) || { loans: 0, volume: 0 }
        performerMap.set(loan.user_id, {
          loans: current.loans + 1,
          volume: current.volume + (Number(loan.loan_amount) || 0)
        })
      })

      const performers: TopPerformer[] = []
      for (const [userId, data] of performerMap.entries()) {
        if (data.loans > 0) {
          performers.push({
            name: `User ${userId.slice(0, 8)}`, // Would need to join with profiles table for real names
            loans: data.loans,
            volume: `$${(data.volume / 1000000).toFixed(1)}M`,
            rate: Math.min(95, Math.max(70, 80 + Math.random() * 15)), // Simulated success rate
            user_id: userId
          })
        }
      }

      performers.sort((a, b) => b.loans - a.loans)

      setReportData({
        loanVolume: {
          thisMonth: `$${(currentMonthVolume / 1000000).toFixed(1)}M`,
          lastMonth: `$${(lastMonthVolume / 1000000).toFixed(1)}M`,
          growth: `${growth.startsWith('-') ? '' : '+'}${growth}%`,
          target: `$${(target / 1000000).toFixed(1)}M`,
          completion
        },
        applications: {
          total,
          approved,
          pending,
          rejected,
          approvalRate
        },
        performance: {
          avgProcessingTime: `${avgProcessingTime} days`,
          targetTime: "21 days",
          improvement: avgProcessingTime < 21 ? `-${21 - avgProcessingTime} days` : `+${avgProcessingTime - 21} days`,
          customerSatisfaction: Number(avgSatisfaction.toFixed(1))
        },
        teamActivity: {
          activeLoanOfficers,
          loansProcessed,
          customerContacts
        }
      })

      setMonthlyData(monthlyChartData)
      setTopPerformers(performers.slice(0, 4))

    } catch (error) {
      console.error('Error fetching reports data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch reports data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return {
    reportData,
    monthlyData,
    topPerformers,
    loading,
    refetch: fetchReportsData
  }
}
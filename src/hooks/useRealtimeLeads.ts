import { useState, useEffect, useRef } from 'react'
import { ibmDb } from '@/lib/ibm'
import { Lead } from '@/types/lead'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useAuth } from '@/components/auth/AuthProvider'

export function useRealtimeLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const fetchingRef = useRef(false)
  const initializedRef = useRef(false)
  const roleRetryRef = useRef(false)

  const fetchLeads = async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      setError(null)
      return
    }

    try {
      if (fetchingRef.current) return
      fetchingRef.current = true
      const silent = !!opts?.silent
      if (!silent && !initializedRef.current) setLoading(true)
      setError(null)
      
      if (!user) {
        console.warn('No authenticated user in context, skipping leads fetch')
        setLeads([])
        setLoading(false)
        return
      }

      console.log('[useRealtimeLeads] Starting leads fetch (RPC first)...')
      let leadRows: any[] | null = null
      let usedPath = 'rpc'
      const { data: rpcRows, error: rpcError } = await ibmDb.rpc('get_accessible_leads')
      if (rpcError) {
        console.warn('[useRealtimeLeads] RPC get_accessible_leads failed, falling back to table select:', rpcError)
        usedPath = 'table'
        const { data, error } = await ibmDb
          .from('leads')
          .select('id, lead_number, created_at, updated_at, user_id, contact_entity_id')
          .order('created_at', { ascending: false })
        if (error) {
          console.error('Error fetching leads (table fallback):', error)
          throw error
        }
        leadRows = data || []
      } else {
        leadRows = (rpcRows as any[]) || []
        leadRows.sort((a: any, b: any) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      }

      console.log('[useRealtimeLeads] Leads query result:', {
        path: usedPath,
        rowCount: leadRows?.length || 0
      })

      const contactEntityIds = (leadRows || [])
        .map((l: any) => l.contact_entity_id)
        .filter((id: string | null) => !!id)

      let contactMap: Record<string, any> = {}
      if (contactEntityIds.length > 0) {
        const uniqueIds = Array.from(new Set(contactEntityIds))
        const { data: contactRows, error: contactError } = await ibmDb
          .from('contact_entities')
          .select('id, name, first_name, last_name, email, phone, business_name, location, loan_amount, loan_type, credit_score, stage, priority, net_operating_income, naics_code, ownership_structure')
          .in('id', uniqueIds)

        if (contactError) {
          console.error('Error fetching contact entities:', contactError)
        }
        
        if (contactRows) {
          contactMap = contactRows.reduce((acc: Record<string, any>, c: any) => {
            acc[c.id] = c
            return acc
          }, {})
        }
      }

      const transformedLeads: Lead[] = (leadRows || []).map((lead: any) => {
        const ce = contactMap[lead.contact_entity_id]
        const computedName = ce?.first_name || ce?.last_name
          ? `${ce?.first_name || ''} ${ce?.last_name || ''}`.trim()
          : (ce?.name || '')

        return {
          id: lead.id,
          lead_number: lead.lead_number,
          name: computedName,
          email: ce?.email === '[SECURED]' ? '***@***.com' : (ce?.email || ''),
          phone: ce?.phone === '[SECURED]' ? '***-***-****' : (ce?.phone || ''),
          business_name: ce?.business_name || '',
          location: ce?.location || '',
          loan_amount: ce?.loan_amount || 0,
          loan_type: ce?.loan_type || '',
          credit_score: ce?.credit_score || 0,
          stage: ce?.stage || 'Initial Contact',
          priority: ce?.priority || 'Medium',
          net_operating_income: ce?.net_operating_income || 0,
          naics_code: ce?.naics_code || '',
          ownership_structure: ce?.ownership_structure || '',
          created_at: lead.created_at,
          updated_at: lead.updated_at,
          user_id: lead.user_id,
          contact_entity_id: lead.contact_entity_id,
          last_contact: lead.updated_at,
          is_converted_to_client: false,
          contact_entity: ce
        }
      })

      console.log(`✅ Loaded ${transformedLeads.length} leads`)
      setLeads(transformedLeads)
      initializedRef.current = true

      if (transformedLeads.length === 0 && !roleRetryRef.current) {
        roleRetryRef.current = true
        setTimeout(() => {
          console.log('[useRealtimeLeads] No leads on first fetch, retrying after short delay...')
          fetchLeads({ silent: true })
        }, 800)
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to load leads'
      console.error('❌ Leads fetch failed:', err)
      setError(errorMsg)
      setLeads([])
      if (!opts?.silent) {
        toast({ title: "Error loading leads", description: errorMsg, variant: "destructive" })
      }
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  // Set up real-time subscription for leads
  useRealtimeSubscription({
    table: 'leads',
    onInsert: () => fetchLeads({ silent: true }),
    onUpdate: () => fetchLeads({ silent: true }),
    onDelete: (payload) => {
      setLeads(prev => prev.filter(lead => lead.id !== payload.old.id))
      toast({ title: "Lead Deleted", description: `Lead has been removed`, variant: "destructive" })
    }
  })

  // Set up real-time subscription for contact entities
  useRealtimeSubscription({
    table: 'contact_entities',
    onUpdate: (payload) => {
      setLeads(prev => prev.map(lead => {
        if (lead.contact_entity_id === payload.new.id) {
          const computedName = payload.new.first_name || payload.new.last_name
            ? `${payload.new.first_name || ''} ${payload.new.last_name || ''}`.trim()
            : (payload.new.name || '')
          
          return {
            ...lead,
            contact_entity: payload.new,
            name: computedName,
            email: payload.new.email,
            phone: payload.new.phone,
            business_name: payload.new.business_name,
            loan_amount: payload.new.loan_amount,
            loan_type: payload.new.loan_type,
            stage: payload.new.stage,
            priority: payload.new.priority
          }
        }
        return lead
      }))
    }
  })

  useEffect(() => {
    if (!authLoading && user) {
      fetchLeads()
    } else if (!authLoading && !user) {
      setLeads([])
      setLoading(false)
    }
  }, [user, authLoading])

  const refetch = () => fetchLeads()
  const refetchSilent = () => fetchLeads({ silent: true })

  return { leads, loading, error, refetch, refetchSilent }
}

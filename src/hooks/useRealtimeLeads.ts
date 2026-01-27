import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
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

  // Fetch initial leads data (optimized two-step query with minimal fields)
  const fetchLeads = async (opts?: { silent?: boolean }) => {
    // Silent no-op if user is not authenticated
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

      // Removed ensure_default_viewer_role RPC to prevent UI flicker and extra calls

      // 1) Fetch leads (RPC first for RLS-safe access), fallback to direct table select
      console.log('[useRealtimeLeads] Starting leads fetch (RPC first)...')
      let leadRows: any[] | null = null
      let usedPath = 'rpc'
      const { data: rpcRows, error: rpcError } = await supabase.rpc('get_accessible_leads')
      if (rpcError) {
        console.warn('[useRealtimeLeads] RPC get_accessible_leads failed, falling back to table select:', rpcError)
        usedPath = 'table'
        const { data, error } = await supabase
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
        // Client-side sort to keep consistent ordering
        leadRows.sort((a: any, b: any) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      }

      console.log('[useRealtimeLeads] Leads query result:', {
        path: usedPath,
        rowCount: leadRows?.length || 0
      })

      // 2) Fetch related contact entities in one batch (only needed fields)
      const contactEntityIds = (leadRows || [])
        .map((l: any) => l.contact_entity_id)
        .filter((id: string | null) => !!id)

      let contactMap: Record<string, any> = {}
      if (contactEntityIds.length > 0) {
        const uniqueIds = Array.from(new Set(contactEntityIds))
        console.log('[useRealtimeLeads] Fetching contact entities for IDs:', uniqueIds)
        const { data: contactRows, error: contactError } = await supabase
          .from('contact_entities')
          .select('id, name, first_name, last_name, email, phone, business_name, location, loan_amount, loan_type, credit_score, stage, priority, net_operating_income, naics_code, ownership_structure')
          .in('id', uniqueIds)

        console.log('[useRealtimeLeads] Contact entities query result:', { 
          rowCount: contactRows?.length || 0, 
          error: contactError ? JSON.stringify(contactError) : null 
        })

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

      // Normalize into Lead interface
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

      // If no leads returned on first run, retry once after role setup settles
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
        toast({
          title: "Error loading leads",
          description: errorMsg,
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  // Set up real-time subscription for leads
  useRealtimeSubscription({
    table: 'leads',
    onInsert: (payload) => {
      console.log('Real-time: New lead added:', payload.new)
      // Refetch to get properly transformed data
      fetchLeads({ silent: true })
    },
    onUpdate: (payload) => {
      console.log('Real-time: Lead updated:', payload.new)
      // Refetch to get properly transformed data
      fetchLeads({ silent: true })
    },
    onDelete: (payload) => {
      console.log('Real-time: Lead deleted:', payload.old)
      setLeads(prev => prev.filter(lead => lead.id !== payload.old.id))
      toast({
        title: "Lead Deleted",
        description: `Lead has been removed`,
        variant: "destructive"
      })
    }
  })

  // Set up real-time subscription for contact entities (linked to leads)
  useRealtimeSubscription({
    table: 'contact_entities',
    onUpdate: (payload) => {
      console.log('Contact entity updated:', payload.new)
      setLeads(prev => prev.map(lead => {
        if (lead.contact_entity_id === payload.new.id) {
          // Compute name from first_name and last_name, fallback to name field
          const computedName = payload.new.first_name || payload.new.last_name
            ? `${payload.new.first_name || ''} ${payload.new.last_name || ''}`.trim()
            : (payload.new.name || '')
          
          return {
            ...lead,
            contact_entity: payload.new,
            // Map contact entity fields to lead for convenience
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
    console.log('[useRealtimeLeads] Effect triggered - authLoading:', authLoading, 'user:', !!user, 'userId:', user?.id)
    // Only fetch leads if user is authenticated and auth is not loading
    if (!authLoading && user) {
      console.log('[useRealtimeLeads] Fetching leads for authenticated user:', user.id)
      fetchLeads()
    } else if (!authLoading && !user) {
      // User is not authenticated, clear leads and stop loading
      console.log('[useRealtimeLeads] No authenticated user, clearing leads')
      setLeads([])
      setLoading(false)
    } else {
      console.log('[useRealtimeLeads] Auth still loading, waiting...')
    }
  }, [user, authLoading])

  const refetch = () => {
    fetchLeads()
  }
  const refetchSilent = () => {
    fetchLeads({ silent: true })
  }

  return {
    leads,
    loading,
    error,
    refetch,
    refetchSilent
  }
}
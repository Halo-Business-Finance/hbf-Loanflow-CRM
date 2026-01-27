import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeSubscriptionOptions {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  onChange?: (payload: any) => void
}

export function useRealtimeSubscription({
  table,
  event = '*',
  schema = 'public',
  onInsert,
  onUpdate,
  onDelete,
  onChange
}: UseRealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Keep the latest handlers in refs to avoid resubscribing on every render
  const insertRef = useRef<typeof onInsert>(onInsert)
  const updateRef = useRef<typeof onUpdate>(onUpdate)
  const deleteRef = useRef<typeof onDelete>(onDelete)
  const changeRef = useRef<typeof onChange>(onChange)

  // Update refs when handlers change (no resubscribe)
  useEffect(() => {
    insertRef.current = onInsert
    updateRef.current = onUpdate
    deleteRef.current = onDelete
    changeRef.current = onChange
  }, [onInsert, onUpdate, onDelete, onChange])

  useEffect(() => {
    // Use a stable channel name per table to avoid churn
    const channelName = `realtime-${schema}-${table}`

    if (channelRef.current) {
      // Clean existing before creating a new one (in case table/event/schema changed)
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: event,
          schema: schema,
          table: table
        },
        (payload: any) => {
          console.log(`Real-time ${payload.eventType} on ${table}:`, payload)

          switch (payload.eventType) {
            case 'INSERT':
              insertRef.current?.(payload)
              break
            case 'UPDATE':
              updateRef.current?.(payload)
              break
            case 'DELETE':
              deleteRef.current?.(payload)
              break
          }

          changeRef.current?.(payload)
        }
      )
      .subscribe((status) => {
        console.log(`Real-time subscription status for ${table}:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        console.log(`Cleaning up real-time subscription for ${table}`)
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [table, event, schema])

  return {
    isConnected: channelRef.current?.state === 'joined'
  }
}
/**
 * Polling-based replacement for Supabase Realtime subscriptions.
 * Polls onChange callback at a configurable interval (default 15s).
 * Drop-in compatible with previous Supabase channel-based API.
 */
import { useEffect, useRef } from 'react'

interface UseRealtimeSubscriptionOptions {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string
  /** Called on INSERT events (polling mode: not distinguishable, use onChange instead) */
  onInsert?: (payload: any) => void
  /** Called on UPDATE events (polling mode: not distinguishable, use onChange instead) */
  onUpdate?: (payload: any) => void
  /** Called on DELETE events (polling mode: not distinguishable, use onChange instead) */
  onDelete?: (payload: any) => void
  /** Called on every poll tick — primary callback for polling mode */
  onChange?: (payload?: any) => void
  /** Polling interval in milliseconds (default: 15000) */
  interval?: number
  /** Set to false to pause polling */
  enabled?: boolean
}

export function useRealtimeSubscription({
  table,
  onChange,
  onInsert,
  onUpdate,
  onDelete,
  interval = 15000,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const changeRef = useRef(onChange)
  const insertRef = useRef(onInsert)
  const updateRef = useRef(onUpdate)
  const deleteRef = useRef(onDelete)

  // Keep refs current without restarting the interval
  useEffect(() => {
    changeRef.current = onChange
    insertRef.current = onInsert
    updateRef.current = onUpdate
    deleteRef.current = onDelete
  }, [onChange, onInsert, onUpdate, onDelete])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      // In polling mode we can't distinguish event types, so we call
      // the generic onChange plus all specific handlers with a synthetic payload.
      const syntheticPayload = { eventType: 'POLL', table }
      changeRef.current?.(syntheticPayload)
      insertRef.current?.(syntheticPayload)
      updateRef.current?.(syntheticPayload)
      deleteRef.current?.(syntheticPayload)
    }

    console.log(`[Polling] Starting ${interval}ms poll for table: ${table}`)
    const id = setInterval(tick, interval)

    return () => {
      console.log(`[Polling] Stopping poll for table: ${table}`)
      clearInterval(id)
    }
  }, [table, interval, enabled])

  return { isConnected: enabled }
}

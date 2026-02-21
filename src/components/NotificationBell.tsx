import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { NotificationCenter } from "./NotificationCenter"
import { ibmDb } from "@/lib/ibm"
const supabase = ibmDb; // IBM migration shim
import { getAuthSession } from '@/lib/auth-utils'
import { useAuth } from "@/components/auth/AuthProvider"
import { useCollaborationNotifications } from "@/hooks/useCollaborationNotifications"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
  related_id?: string
  related_type?: string
  scheduled_for?: string
  borrower_name?: string
  company_name?: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const [hasError, setHasError] = useState(false)
  const { notifications: collaborationNotifications, refresh: refreshCollaboration } = useCollaborationNotifications()

  const fetchNotifications = async () => {
    if (!user) return

    try {
      // Ensure we have a valid session before making requests
      const session = await getAuthSession()
      if (!session) {
        console.warn('No valid session for notifications')
        setHasError(true)
        return
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      // Fetch related contact entities for the notifications
      const relatedIds = (data || [])
        .filter(n => n.related_id && n.related_type === 'lead')
        .map(n => n.related_id)

      let contactEntityMap = new Map()
      if (relatedIds.length > 0) {
        const { data: contactData } = await supabase
          .from('leads')
          .select(`
            id,
            contact_entities!inner(
              name,
              business_name,
              first_name,
              last_name
            )
          `)
          .in('id', relatedIds)

        if (contactData) {
          contactData.forEach(lead => {
            const contact = (lead as any).contact_entities
            contactEntityMap.set(lead.id, contact)
          })
        }
      }

      const allNotifications = (data || []).map(n => {
        const contactEntity = n.related_id ? contactEntityMap.get(n.related_id) : null
        const borrowerName = contactEntity 
          ? (contactEntity.name || `${contactEntity.first_name || ''} ${contactEntity.last_name || ''}`.trim())
          : null
        const companyName = contactEntity?.business_name

        return {
          ...n,
          borrower_name: borrowerName,
          company_name: companyName
        }
      })
      
      // Show both past notifications and future reminders
      // Sort by scheduled_for if it exists, otherwise by created_at
      const sortedNotifications = allNotifications.sort((a, b) => {
        const aTime = a.scheduled_for || a.created_at
        const bTime = b.scheduled_for || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      }).slice(0, 20)
      
      setNotifications(sortedNotifications as any)
      const unread = sortedNotifications.filter(n => !n.is_read).length || 0
      setUnreadCount(unread)
      setHasError(false)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      // Check if it's a SecurityError
      if (error instanceof Error && error.name === 'SecurityError') {
        console.warn('SecurityError accessing notifications - session may need refresh')
        setHasError(true)
      }
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
      
      if (error) {
        console.error('Error marking notification as read:', error)
        return
      }
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      
      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  useEffect(() => {
    // Add delay to ensure auth is fully initialized
    const initNotifications = async () => {
      try {
        await fetchNotifications()

        // Set up real-time subscription for new notifications
        if (user && !hasError) {
          const channel = supabase
            .channel('notifications')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
              },
              async (payload) => {
                console.log('Notification event:', payload.eventType, payload.new)
                
                if (payload.eventType === 'INSERT') {
                  const newNotification = payload.new as Notification
                  
                  // Fetch related contact entity data if exists
                  let enrichedNotification = { ...newNotification }
                  if (newNotification.related_id && newNotification.related_type === 'lead') {
                    const { data: leadData } = await supabase
                      .from('leads')
                      .select(`
                        id,
                        contact_entities!inner(
                          name,
                          business_name,
                          first_name,
                          last_name
                        )
                      `)
                      .eq('id', newNotification.related_id)
                      .single()
                    
                    if (leadData) {
                      const contact = (leadData as any).contact_entities
                      enrichedNotification.borrower_name = contact.name || 
                        `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      enrichedNotification.company_name = contact.business_name
                    }
                  }
                  
                  setNotifications(prev => [enrichedNotification as any, ...prev.slice(0, 19)])
                  if (!enrichedNotification.is_read) {
                    setUnreadCount(prev => prev + 1)
                  }
                } else if (payload.eventType === 'UPDATE') {
                  const updatedNotification = payload.new as Notification
                  setNotifications(prev => {
                    const updated = prev.map(n => n.id === updatedNotification.id ? updatedNotification as any : n)
                    // Recalculate unread count
                    const newUnreadCount = updated.filter(n => !n.is_read).length
                    setUnreadCount(newUnreadCount)
                    return updated
                  })
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = (payload.old as any).id
                  setNotifications(prev => {
                    const filtered = prev.filter(n => n.id !== deletedId)
                    // Recalculate unread count
                    const newUnreadCount = filtered.filter(n => !n.is_read).length
                    setUnreadCount(newUnreadCount)
                    return filtered
                  })
                }
              }
            )
            .subscribe()

          return () => {
            supabase.removeChannel(channel)
          }
        }
      } catch (error) {
        console.error('Error initializing notifications:', error)
      }
    }

    const timer = setTimeout(initNotifications, 100)
    return () => clearTimeout(timer)
  }, [user, hasError])

  // Update unread count when collaboration notifications change
  useEffect(() => {
    const generalUnread = notifications.filter(n => !n.is_read).length
    const collaborationUnread = collaborationNotifications.filter(n => n.status === 'pending').length
    setUnreadCount(generalUnread + collaborationUnread)
  }, [notifications, collaborationNotifications])

  if (!user || hasError) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors relative"
        >
          <Bell className="w-6 h-6" fill="rgb(234, 179, 8)" stroke="rgb(234, 179, 8)" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs bg-primary text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-96 p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <NotificationCenter
          notifications={notifications}
          collaborationNotifications={collaborationNotifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onRefresh={() => {
            fetchNotifications();
            refreshCollaboration();
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
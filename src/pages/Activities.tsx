import React, { useState, useEffect } from 'react'
import { StandardKPICard } from '@/components/StandardKPICard'
import { StandardContentCard } from '@/components/StandardContentCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow, format } from 'date-fns'
import { 
  Bell, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  UserPlus, 
  FileText, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Clock,
  Users,
  Phone,
  Mail,
  RefreshCw,
  Trash2,
  Edit,
  Check,
  X
} from 'lucide-react'
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
interface Notification {
  id: string
  message: string
  timestamp: Date
  type: 'warning' | 'success' | 'info'
  notificationType?: string  // The actual type from database (call_reminder, email_reminder, etc.)
  scheduled_for?: Date
  related_id?: string
  related_type?: string
  borrower_name?: string
  company_name?: string
}

interface ActivityItem {
  id: string
  action: string
  details: string
  timestamp: Date
  user: string
}

export default function Activities() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actualTodaysActions, setActualTodaysActions] = useState(0)
  const [scheduledReminders, setScheduledReminders] = useState(0)
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editReminderType, setEditReminderType] = useState<'call' | 'email' | 'follow_up'>('follow_up')
  const [editDate, setEditDate] = useState<Date>()
  const [editTime, setEditTime] = useState("09:00")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch real notifications from database
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (notificationError) {
        console.error('Error fetching notifications:', notificationError)
      }

      // Count scheduled reminders (future scheduled_for dates)
      const now = new Date()
      const scheduledCount = (notificationData || []).filter(n => 
        n.scheduled_for && new Date(n.scheduled_for) > now && !n.is_read
      ).length

      // Fetch related contact entities for the notifications
      const relatedIds = (notificationData || [])
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

      // Convert database notifications to our format, prioritizing scheduled items
      const dbNotifications: Notification[] = (notificationData || [])
        .sort((a, b) => {
          // Prioritize unread scheduled items
          const aScheduled = a.scheduled_for && new Date(a.scheduled_for) > now && !a.is_read
          const bScheduled = b.scheduled_for && new Date(b.scheduled_for) > now && !b.is_read
          if (aScheduled && !bScheduled) return -1
          if (!aScheduled && bScheduled) return 1
          
          // Then sort by scheduled_for or created_at
          const aTime = a.scheduled_for || a.created_at
          const bTime = b.scheduled_for || b.created_at
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })
        .slice(0, 10)
        .map(n => {
          const contactEntity = n.related_id ? contactEntityMap.get(n.related_id) : null
          const borrowerName = contactEntity 
            ? (contactEntity.name || `${contactEntity.first_name || ''} ${contactEntity.last_name || ''}`.trim())
            : null
          const companyName = contactEntity?.business_name

          return {
            id: n.id,
            message: n.message || n.title,
            timestamp: new Date(n.scheduled_for || n.created_at),
            type: n.is_read ? 'success' : (n.scheduled_for ? 'warning' : 'info'),
            notificationType: n.type,  // Preserve the actual notification type from database
            scheduled_for: n.scheduled_for ? new Date(n.scheduled_for) : undefined,
            related_id: n.related_id,
            related_type: n.related_type,
            borrower_name: borrowerName || undefined,
            company_name: companyName || undefined
          }
        })

      // Fetch real activities from audit logs with user profile information
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles!audit_logs_user_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (auditError) {
        console.error('Error fetching audit logs:', auditError)
      }

      // Convert audit logs to activities format
      const dbActivities: ActivityItem[] = (auditData || []).map(a => {
        const profile = (a as any).profiles
        const userName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
          : 'System'
        
        return {
          id: a.id,
          action: a.action === 'lead_updated' 
            ? 'Lead Updated' 
            : a.action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'System Action',
          details: a.table_name 
            ? `Updated ${a.table_name.replace(/_/g, ' ')}`
            : 'Activity performed',
          timestamp: new Date(a.created_at),
          user: userName
        }
      })

      // Calculate live metrics
      const allActivities = dbActivities
      const allNotifications = dbNotifications
      
      const todaysActions = allActivities.filter(activity => {
        const today = new Date()
        const activityDate = activity.timestamp
        return activityDate.toDateString() === today.toDateString()
      }).length

      setActualTodaysActions(todaysActions)
      setScheduledReminders(scheduledCount)
      setNotifications(allNotifications)
      setActivities(allActivities)
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load activities and notifications",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'info': return <Info className="h-4 w-4 text-blue-600" />
      default: return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Lead Created': return <UserPlus className="h-4 w-4 text-blue-600" />
      case 'Document Uploaded': return <FileText className="h-4 w-4 text-green-600" />
      case 'Deal Closed': return <TrendingUp className="h-4 w-4 text-purple-600" />
      case 'Follow-up Scheduled': return <Calendar className="h-4 w-4 text-orange-600" />
      case 'Call Made': return <Phone className="h-4 w-4 text-blue-600" />
      case 'Email Sent': return <Mail className="h-4 w-4 text-green-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const reminderTypes = [
    {
      id: 'call' as const,
      label: 'Call Reminder',
      icon: Phone,
      description: 'Schedule a phone call',
      color: 'bg-navy'
    },
    {
      id: 'email' as const,
      label: 'Email Reminder',
      icon: Mail,
      description: 'Send an email follow-up',
      color: 'bg-green-500'
    },
    {
      id: 'follow_up' as const,
      label: 'General Follow-up',
      icon: Bell,
      description: 'General reminder to follow up',
      color: 'bg-purple-500'
    }
  ]

  const timeOptions = [
    { value: "09:00", label: "9:00 AM" },
    { value: "10:00", label: "10:00 AM" },
    { value: "11:00", label: "11:00 AM" },
    { value: "12:00", label: "12:00 PM" },
    { value: "13:00", label: "1:00 PM" },
    { value: "14:00", label: "2:00 PM" },
    { value: "15:00", label: "3:00 PM" },
    { value: "16:00", label: "4:00 PM" },
    { value: "17:00", label: "5:00 PM" },
    { value: "18:00", label: "6:00 PM" },
    { value: "19:00", label: "7:00 PM" },
    { value: "20:00", label: "8:00 PM" }
  ]

  const handleEditNotification = (notification: Notification) => {
    setEditingNotificationId(notification.id)
    setEditTitle(notification.message.split(' - ')[0] || notification.message)
    setEditMessage(notification.message)
    setEditReminderType('follow_up')
    setEditDate(notification.scheduled_for || new Date())
    setEditTime("09:00")
  }

  const handleSaveEdit = async () => {
    if (!editingNotificationId || !editDate) return
    
    try {
      const reminderDateTime = new Date(editDate)
      const [hours, minutes] = editTime.split(':')
      reminderDateTime.setHours(parseInt(hours), parseInt(minutes))

      const { error } = await supabase
        .from('notifications')
        .update({
          title: editTitle,
          message: editMessage,
          type: `${editReminderType}_reminder`,
          scheduled_for: reminderDateTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingNotificationId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Notification updated successfully",
      })

      setEditingNotificationId(null)
      setEditTitle('')
      setEditMessage('')
      setEditReminderType('follow_up')
      setEditDate(undefined)
      setEditTime("09:00")
      fetchData()
    } catch (error) {
      console.error('Error updating notification:', error)
      toast({
        title: "Error",
        description: "Failed to update notification",
        variant: "destructive",
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingNotificationId(null)
    setEditTitle('')
    setEditMessage('')
    setEditReminderType('follow_up')
    setEditDate(undefined)
    setEditTime("09:00")
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Notification deleted successfully",
      })

      setDeleteConfirmId(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8 space-y-8 animate-fade-in">
          <div className="space-y-1 animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-2"></div>
            <div className="h-5 bg-muted rounded w-96"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-card rounded-lg p-6 border border-blue-600">
                <div className="h-6 bg-muted rounded w-24 mb-4"></div>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-8 w-8 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        <IBMPageHeader 
          title="Activity Command Center"
          subtitle="Monitor system notifications, user activities, and important updates in real-time"
          actions={
            <Button onClick={fetchData} variant="outline" size="sm" className="h-8 text-xs font-medium">
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh Data
            </Button>
          }
        />

        {/* Content */}
        <div className="space-y-6">
        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StandardKPICard
            title="Total Activities"
            value={activities.length}
            className="border border-blue-600"
          />
          
          <StandardKPICard
            title="Notifications"
            value={notifications.length}
            className="border border-blue-600"
          />
          
          <StandardKPICard
            title="Today's Activities"
            value={actualTodaysActions}
            className="border border-blue-600"
          />
          
          <StandardKPICard
            title="Scheduled Reminders"
            value={scheduledReminders}
            className="border border-blue-600"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Call Notifications */}
          <StandardContentCard 
            title="Call Reminders"
            headerActions={<Phone className="h-5 w-5 text-navy" />}
          >
            <div className="space-y-4">
              {notifications
                .filter(n => n.notificationType?.includes('call'))
                .slice(0, 5)
                .map((notification) => (
                <div key={notification.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                  <Phone className="h-4 w-4 text-navy mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {notification.borrower_name && (
                          <p className="text-sm font-semibold text-foreground">
                            {notification.borrower_name}
                          </p>
                        )}
                        {notification.company_name && (
                          <p className="text-xs text-muted-foreground">
                            {notification.company_name}
                          </p>
                        )}
                        <p className="text-sm text-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditNotification(notification)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {notification.scheduled_for && notification.scheduled_for > new Date() 
                          ? format(notification.scheduled_for, 'MMM d, yyyy • h:mm a')
                          : format(notification.timestamp, 'MMM d, yyyy • h:mm a')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.filter(n => n.notificationType?.includes('call')).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No call reminders</p>
              )}
            </div>
          </StandardContentCard>

          {/* Email Notifications */}
          <StandardContentCard 
            title="Email Reminders"
            headerActions={<Mail className="h-5 w-5 text-green-600" />}
          >
            <div className="space-y-4">
              {notifications
                .filter(n => n.notificationType?.includes('email'))
                .slice(0, 5)
                .map((notification) => (
                <div key={notification.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                  <Mail className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {notification.borrower_name && (
                          <p className="text-sm font-semibold text-foreground">
                            {notification.borrower_name}
                          </p>
                        )}
                        {notification.company_name && (
                          <p className="text-xs text-muted-foreground">
                            {notification.company_name}
                          </p>
                        )}
                        <p className="text-sm text-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditNotification(notification)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {notification.scheduled_for && notification.scheduled_for > new Date() 
                          ? format(notification.scheduled_for, 'MMM d, yyyy • h:mm a')
                          : format(notification.timestamp, 'MMM d, yyyy • h:mm a')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.filter(n => n.notificationType?.includes('email')).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No email reminders</p>
              )}
            </div>
          </StandardContentCard>

          {/* General Follow-up Notifications */}
          <StandardContentCard 
            title="General Follow-ups"
            headerActions={<Bell className="h-5 w-5 text-purple-600" />}
          >
            <div className="space-y-4">
              {notifications
                .filter(n => n.notificationType?.includes('follow_up'))
                .slice(0, 5)
                .map((notification) => (
                <div key={notification.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                  <Bell className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {notification.borrower_name && (
                          <p className="text-sm font-semibold text-foreground">
                            {notification.borrower_name}
                          </p>
                        )}
                        {notification.company_name && (
                          <p className="text-xs text-muted-foreground">
                            {notification.company_name}
                          </p>
                        )}
                        <p className="text-sm text-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditNotification(notification)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {notification.scheduled_for && notification.scheduled_for > new Date() 
                          ? format(notification.scheduled_for, 'MMM d, yyyy • h:mm a')
                          : format(notification.timestamp, 'MMM d, yyyy • h:mm a')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.filter(n => n.notificationType?.includes('follow_up')).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No follow-up reminders</p>
              )}
            </div>
          </StandardContentCard>

        {/* Recent Activities */}
        <StandardContentCard 
          title="Recent Activities"
          headerActions={<Activity className="h-5 w-5 text-blue-600" />}
        >
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activities</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  {getActionIcon(activity.action)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {activity.action}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {activity.user}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.details}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(activity.timestamp)} ago
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </StandardContentCard>

        {/* Activity Timeline */}
        <StandardContentCard 
          title="Activity Timeline"
          headerActions={<Clock className="h-5 w-5 text-green-600" />}
        >
          <div className="space-y-6">
            {[...activities, ...notifications.map(n => ({
              id: n.id,
              action: 'System Notification',
              details: n.message,
              timestamp: n.timestamp,
              user: 'System'
            }))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8).map((item, index) => (
              <div key={item.id} className="flex items-center space-x-4 relative">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    {getActionIcon(item.action)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(item.timestamp)} ago
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.details}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{item.user}</Badge>
                </div>
                {index < 7 && (
                  <div className="absolute left-4 top-8 w-px h-6 bg-border"></div>
                )}
              </div>
            ))}
          </div>
        </StandardContentCard>
      </div>

      {/* Edit Notification Modal */}
      {editingNotificationId && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={handleCancelEdit}
        >
          <div 
            className="w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full shadow-xl border animate-in slide-in-from-top-4 duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-base font-semibold dark:text-white">
                  Edit Notification
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>For:</span>
                  <span className="font-medium text-foreground">{editTitle || 'Notification'}</span>
                </div>

                {/* Reminder Type Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Reminder Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {reminderTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <Button
                          key={type.id}
                          variant={editReminderType === type.id ? "default" : "outline"}
                          className="justify-start h-auto p-3"
                          onClick={() => setEditReminderType(type.id)}
                        >
                          <div className={`w-3 h-3 rounded-full ${type.color} mr-3`} />
                          <Icon className="h-4 w-4 mr-2" />
                          <div className="text-left">
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                {/* Date Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">When?</Label>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(editDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={setEditDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Selection */}
                {editDate && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Time</Label>
                    <Select value={editTime} onValueChange={setEditTime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time.value} value={time.value}>
                            {time.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom Note */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Custom Note (Optional)</Label>
                  <Textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    placeholder="Add any specific details for this reminder..."
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={!editDate}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteNotification(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </div>
    </div>
  )
}
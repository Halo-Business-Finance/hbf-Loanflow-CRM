import { formatDistanceToNow } from "date-fns"
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Target, 
  Users, 
  Clock,
  Check,
  RefreshCw,
  Bell,
  ClipboardList,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useNavigate } from "react-router-dom"
import { CollaborationNotification } from "@/hooks/useCollaborationNotifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

interface NotificationCenterProps {
  notifications: Notification[]
  collaborationNotifications: CollaborationNotification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onRefresh: () => void
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_assignment':
      return <ClipboardList className="w-4 h-4 text-blue-500" />
    case 'escalation':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />
    case 'lead_status_change':
    case 'lead_created':
      return <Target className="w-4 h-4 text-navy" />
    case 'client_created':
    case 'client_updated':
      return <Users className="w-4 h-4 text-green-500" />
    case 'follow_up_reminder':
    case 'call_reminder':
    case 'email_reminder':
      return <Clock className="w-4 h-4 text-orange-500" />
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />
    default:
      return <Info className="w-4 h-4 text-navy" />
  }
}

export function NotificationCenter({
  notifications,
  collaborationNotifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onRefresh
}: NotificationCenterProps) {
  const navigate = useNavigate()

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }

    // Navigate to relevant page based on notification type
    if (notification.related_type === 'lead' && notification.related_id) {
      navigate(`/leads/${notification.related_id}`)
    } else if (notification.related_type === 'client' && notification.related_id) {
      navigate(`/existing-borrowers/${notification.related_id}`)
    }
  }

  const handleCollaborationClick = (notification: CollaborationNotification) => {
    // Navigate based on collaboration type
    if (notification.type === 'task_assignment') {
      navigate('/activities/tasks')
    } else if (notification.type === 'escalation' && notification.related_id) {
      navigate(`/leads/${notification.related_id}`)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const collaborationCount = collaborationNotifications.filter(n => n.status === 'pending').length
  const totalUnread = unreadCount + collaborationCount

  return (
    <div className="w-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAllAsRead}
                className="text-xs"
              >
                <Check className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        {totalUnread > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {totalUnread} pending item{totalUnread !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Tabs for different notification types */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger 
            value="all" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            All {totalUnread > 0 && `(${totalUnread})`}
          </TabsTrigger>
          <TabsTrigger 
            value="tasks" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Tasks {collaborationCount > 0 && `(${collaborationCount})`}
          </TabsTrigger>
          <TabsTrigger 
            value="general" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            General {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="m-0">
          <ScrollArea className="h-96">
            {notifications.length === 0 && collaborationNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No notifications yet</p>
                <p className="text-sm mt-1">We'll notify you when something important happens</p>
              </div>
            ) : (
              <div className="p-0">
                {/* Collaboration Notifications */}
                {collaborationNotifications.map((notification, index) => (
                  <div key={`collab-${notification.id}`}>
                    <div
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                        notification.status === 'pending' && "bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500"
                      )}
                      onClick={() => handleCollaborationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className={cn(
                                "text-sm font-medium",
                                notification.status === 'pending' && "font-semibold"
                              )}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  notification.priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                                  notification.priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                                  notification.priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
                                  notification.priority === 'low' && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                )}>
                                  {notification.priority}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {notification.status}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {new Date(notification.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.due_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {new Date(notification.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </div>
                ))}

                {/* General Notifications */}
                {notifications.map((notification, index) => (
                  <div key={notification.id}>
                    <div
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                        !notification.is_read && "bg-navy/5 border-l-4 border-l-navy"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              {notification.borrower_name && (
                                <p className="text-xs font-semibold text-foreground">
                                  {notification.borrower_name}
                                </p>
                              )}
                              {notification.company_name && (
                                <p className="text-xs text-muted-foreground">
                                  {notification.company_name}
                                </p>
                              )}
                              <h4 className={cn(
                                "text-sm font-medium mt-1",
                                !notification.is_read && "font-semibold"
                              )}>
                                {notification.title}
                              </h4>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {notification.scheduled_for 
                                ? new Date(notification.scheduled_for).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                                : new Date(notification.created_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                              }
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-navy rounded-full mt-2"></div>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tasks" className="m-0">
          <ScrollArea className="h-96">
            {collaborationNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pending tasks or escalations</p>
              </div>
            ) : (
              <div className="p-0">
                {collaborationNotifications.map((notification, index) => (
                  <div key={notification.id}>
                    <div
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                        notification.status === 'pending' && "bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500"
                      )}
                      onClick={() => handleCollaborationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className={cn(
                                "text-sm font-medium",
                                notification.status === 'pending' && "font-semibold"
                              )}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  notification.priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                                  notification.priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                                  notification.priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
                                  notification.priority === 'low' && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                )}>
                                  {notification.priority}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {notification.status}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {new Date(notification.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.due_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {new Date(notification.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < collaborationNotifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="general" className="m-0">
          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No general notifications</p>
              </div>
            ) : (
              <div className="p-0">
                {notifications.map((notification, index) => (
                  <div key={notification.id}>
                    <div
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                        !notification.is_read && "bg-navy/5 border-l-4 border-l-navy"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              {notification.borrower_name && (
                                <p className="text-xs font-semibold text-foreground">
                                  {notification.borrower_name}
                                </p>
                              )}
                              {notification.company_name && (
                                <p className="text-xs text-muted-foreground">
                                  {notification.company_name}
                                </p>
                              )}
                              <h4 className={cn(
                                "text-sm font-medium mt-1",
                                !notification.is_read && "font-semibold"
                              )}>
                                {notification.title}
                              </h4>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {notification.scheduled_for 
                                ? new Date(notification.scheduled_for).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                                : new Date(notification.created_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                              }
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-navy rounded-full mt-2"></div>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
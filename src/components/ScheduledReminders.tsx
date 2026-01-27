import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Bell, Phone, Mail, Trash2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth/AuthProvider"

interface Reminder {
  id: string
  title: string
  message: string
  type: string
  scheduled_for: string
  created_at: string
  user_id: string
  user_name?: string
}

interface ScheduledRemindersProps {
  entityId: string
  entityType: 'lead' | 'client'
}

export function ScheduledReminders({ entityId, entityType }: ScheduledRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    fetchReminders()
  }, [entityId])

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          title,
          message,
          type,
          scheduled_for,
          created_at,
          user_id
        `)
        .eq('related_id', entityId)
        .eq('related_type', entityType)
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })

      if (error) throw error

      // Fetch user names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds)
        
        const profileMap = new Map(
          profiles?.map(p => [
            p.id,
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User'
          ]) || []
        )

        setReminders(
          data.map(reminder => ({
            ...reminder,
            user_name: profileMap.get(reminder.user_id)
          }))
        )
      } else {
        setReminders([])
      }
    } catch (error) {
      console.error('Error fetching reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', reminderId)

      if (error) throw error

      toast({
        title: "Reminder Deleted",
        description: "The reminder has been removed",
      })

      fetchReminders()
    } catch (error) {
      console.error('Error deleting reminder:', error)
      toast({
        title: "Error",
        description: "Failed to delete reminder",
        variant: "destructive",
      })
    }
  }

  const getReminderIcon = (type: string) => {
    if (type.includes('call')) return <Phone className="w-4 h-4 text-[#0f62fe]" />
    if (type.includes('email')) return <Mail className="w-4 h-4 text-[#0f62fe]" />
    return <Bell className="w-4 h-4 text-[#0f62fe]" />
  }

  const getReminderTypeLabel = (type: string) => {
    if (type.includes('call')) return 'Call Reminder'
    if (type.includes('email')) return 'Email Reminder'
    return 'Follow-up Reminder'
  }

  if (loading) {
    return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-foreground">
          Scheduled Reminders
        </CardTitle>
      </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading reminders...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-foreground">
          Scheduled Reminders
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No scheduled reminders
          </p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3 p-3 bg-background rounded-lg border hover:shadow-sm transition-shadow"
              >
                <div className="flex-shrink-0">
                  {getReminderIcon(reminder.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {getReminderTypeLabel(reminder.type)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reminder.message}
                      </p>
                    </div>
                    {user?.id === reminder.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#0f62fe] hover:bg-[#0f62fe]/10 hover:text-[#0f62fe]"
                        onClick={() => deleteReminder(reminder.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="font-medium">
                        {format(new Date(reminder.scheduled_for), 'MMM d, yyyy')}
                      </span>
                      <span>at</span>
                      <span className="font-medium">
                        {format(new Date(reminder.scheduled_for), 'h:mm a')}
                      </span>
                    </div>
                    {reminder.user_name && (
                      <>
                        <span>•</span>
                        <span>Set by {reminder.user_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

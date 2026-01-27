import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Clock, Phone, Mail, Calendar, AlertCircle, LucideIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { format, isToday, isBefore, startOfDay } from "date-fns"
import { useNavigate } from "react-router-dom"

interface Task {
  id: string
  title: string
  message: string
  type: string
  created_at: string
  related_id?: string
  related_type?: string
  priority: 'high' | 'medium' | 'low'
  dueDate?: Date
}

export function TodaysTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  const fetchTasks = async () => {
    if (!user) return

    try {
      console.log('Fetching tasks for user:', user.id)
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: true })
        .limit(10)

      console.log('Notifications query result:', { notifications, error })

      if (notifications) {
        const tasksData: Task[] = notifications.map(notification => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          created_at: notification.created_at,
          related_id: notification.related_id,
          related_type: notification.related_type,
          priority: getPriority(notification.type),
          dueDate: new Date(notification.created_at)
        }))

        setTasks(tasksData)
        console.log('Mapped tasks data:', tasksData)
      } else {
        console.log('No notifications found')
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriority = (type: string): 'high' | 'medium' | 'low' => {
    if (type.includes('follow_up') || type.includes('reminder')) return 'high'
    if (type.includes('lead_created') || type.includes('client_created')) return 'medium'
    return 'low'
  }

  const getIcon = (type: string): LucideIcon => {
    if (type.includes('call') || type.includes('follow_up')) return Phone
    if (type.includes('email')) return Mail
    if (type.includes('reminder')) return Clock
    return Calendar
  }

  const handleTaskClick = (task: Task) => {
    if (task.related_type === 'lead' && task.related_id) {
      navigate(`/leads/${task.related_id}`)
    } else if (task.related_type === 'client') {
      navigate('/clients')
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [user])

  // Separate tasks into categories
  const overdueTasks = tasks.filter(task => {
    const taskDate = new Date(task.created_at)
    const daysDiff = Math.floor((new Date().getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysDiff > 1
    console.log('Checking overdue for task:', task.title, 'DaysDiff:', daysDiff, 'IsOverdue:', isOverdue)
    return isOverdue
  })

  const todaysTasks = tasks.filter(task => {
    const taskDate = new Date(task.created_at)
    const daysDiff = Math.floor((new Date().getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
    // Show tasks from today and yesterday (not yet overdue)
    const isTaskRelevant = daysDiff <= 1
    console.log('Filtering task:', task.title, 'Date:', taskDate, 'DaysDiff:', daysDiff, 'IsRelevant:', isTaskRelevant)
    return isTaskRelevant
  })

  console.log('Final filtered results:', { todaysTasks, overdueTasks, totalTasks: tasks.length })

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="dark:text-white no-underline">
            <span className="inline-block border-b-2 border-primary dark:border-white pb-1 no-underline">Today's Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="dark:text-white no-underline">
          <span className="inline-block border-b-2 border-primary dark:border-white pb-1 no-underline">Today's Tasks</span>
          {(todaysTasks.length + overdueTasks.length) > 0 && (
            <span className="ml-auto text-sm font-medium">
              {todaysTasks.length + overdueTasks.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tasks for today</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Overdue Tasks */}
            {overdueTasks.map(task => {
              const IconComponent = getIcon(task.type)
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{task.message}</div>
                    <div className="text-xs text-destructive">
                      Overdue - {format(new Date(task.created_at), 'MMM d')}
                    </div>
                  </div>
                  <span className="text-xs">
                    Overdue
                  </span>
                </div>
              )
            })}

            {/* Today's Tasks */}
            {todaysTasks.map(task => {
              const IconComponent = getIcon(task.type)
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <IconComponent className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{task.message}</div>
                  </div>
                  <span className="text-xs capitalize">
                    {task.priority}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
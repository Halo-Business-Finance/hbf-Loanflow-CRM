import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';

export interface CollaborationNotification {
  id: string;
  type: 'task_assignment' | 'escalation';
  title: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  is_read?: boolean;
  related_id?: string;
  related_type?: string;
  assigned_by?: string;
  escalated_from?: string;
  due_date?: string;
}

export function useCollaborationNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CollaborationNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) { setLoading(false); return; }

    try {
      const { data: tasks, error: tasksError } = await ibmDb
        .from('task_assignments')
        .select('id, title, description, task_type, priority, status, created_at, assigned_by, related_entity_id, related_entity_type, due_date')
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      const { data: escalations, error: escalationsError } = await ibmDb
        .from('application_escalations')
        .select('id, application_id, escalated_from, reason, priority, status, created_at')
        .eq('escalated_to', user.id)
        .in('status', ['pending', 'reviewed'])
        .order('created_at', { ascending: false });

      if (escalationsError) throw escalationsError;

      const taskNotifications: CollaborationNotification[] = (tasks || []).map((task: any) => ({
        id: task.id, type: 'task_assignment' as const,
        title: task.title, message: task.description || `New ${task.task_type} task assigned to you`,
        priority: task.priority, status: task.status, created_at: task.created_at,
        assigned_by: task.assigned_by,
        related_id: task.related_entity_id || undefined,
        related_type: task.related_entity_type || undefined,
        due_date: task.due_date || undefined,
      }));

      const escalationNotifications: CollaborationNotification[] = (escalations || []).map((esc: any) => ({
        id: esc.id, type: 'escalation' as const,
        title: 'Application Escalated', message: esc.reason,
        priority: esc.priority, status: esc.status, created_at: esc.created_at,
        escalated_from: esc.escalated_from,
        related_id: esc.application_id, related_type: 'application',
      }));

      const allNotifications = [...taskNotifications, ...escalationNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching collaboration notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (!user) return;

    // Poll every 30 seconds instead of realtime subscriptions
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return { notifications, loading, refresh: fetchNotifications };
}

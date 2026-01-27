import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch task assignments assigned to current user
      const { data: tasks, error: tasksError } = await supabase
        .from('task_assignments')
        .select(`
          id,
          title,
          description,
          task_type,
          priority,
          status,
          created_at,
          assigned_by,
          related_entity_id,
          related_entity_type,
          due_date
        `)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch escalations assigned to current user
      const { data: escalations, error: escalationsError } = await supabase
        .from('application_escalations')
        .select(`
          id,
          application_id,
          escalated_from,
          reason,
          priority,
          status,
          created_at
        `)
        .eq('escalated_to', user.id)
        .in('status', ['pending', 'reviewed'])
        .order('created_at', { ascending: false });

      if (escalationsError) throw escalationsError;

      // Transform tasks to notifications
      const taskNotifications: CollaborationNotification[] = (tasks || []).map(task => ({
        id: task.id,
        type: 'task_assignment' as const,
        title: task.title,
        message: task.description || `New ${task.task_type} task assigned to you`,
        priority: task.priority,
        status: task.status,
        created_at: task.created_at,
        assigned_by: task.assigned_by,
        related_id: task.related_entity_id || undefined,
        related_type: task.related_entity_type || undefined,
        due_date: task.due_date || undefined,
      }));

      // Transform escalations to notifications
      const escalationNotifications: CollaborationNotification[] = (escalations || []).map(esc => ({
        id: esc.id,
        type: 'escalation' as const,
        title: 'Application Escalated',
        message: esc.reason,
        priority: esc.priority,
        status: esc.status,
        created_at: esc.created_at,
        escalated_from: esc.escalated_from,
        related_id: esc.application_id,
        related_type: 'application',
      }));

      // Combine and sort
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

    // Subscribe to task assignments
    const taskChannel = supabase
      .channel('task_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Subscribe to escalations
    const escalationChannel = supabase
      .channel('escalations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_escalations',
          filter: `escalated_to=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(escalationChannel);
    };
  }, [user]);

  return {
    notifications,
    loading,
    refresh: fetchNotifications,
  };
}

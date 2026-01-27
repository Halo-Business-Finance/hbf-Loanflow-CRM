import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface TaskAssignment {
  id: string;
  title: string;
  description?: string;
  task_type: 'review' | 'approval' | 'document_check' | 'escalation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to: string;
  assigned_by: string;
  related_entity_id?: string;
  related_entity_type?: string;
  due_date?: string;
  completed_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface Escalation {
  id: string;
  application_id: string;
  escalated_from: string;
  escalated_to: string;
  reason: string;
  priority: 'high' | 'urgent' | 'critical';
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  resolution?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export function useCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const assignTask = async (params: {
    title: string;
    description?: string;
    task_type: TaskAssignment['task_type'];
    priority: TaskAssignment['priority'];
    assigned_to: string;
    related_entity_id?: string;
    related_entity_type?: string;
    due_date?: string;
    metadata?: any;
  }) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to assign tasks',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .insert({
          ...params,
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Task Assigned',
        description: `Task "${params.title}" has been assigned successfully`,
      });

      return data;
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const escalateApplication = async (params: {
    application_id: string;
    escalated_to: string;
    reason: string;
    priority: Escalation['priority'];
  }) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to escalate applications',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('application_escalations')
        .insert({
          ...params,
          escalated_from: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Application Escalated',
        description: 'The application has been escalated successfully',
      });

      return data;
    } catch (error) {
      console.error('Error escalating application:', error);
      toast({
        title: 'Error',
        description: 'Failed to escalate application',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskAssignment['status']) => {
    setLoading(true);
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Updated',
        description: `Task status updated to ${status}`,
      });

      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resolveEscalation = async (escalationId: string, resolution: string, status: 'resolved' | 'rejected') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('application_escalations')
        .update({
          status,
          resolution,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalationId);

      if (error) throw error;

      toast({
        title: 'Escalation Resolved',
        description: 'The escalation has been resolved',
      });

      return true;
    } catch (error) {
      console.error('Error resolving escalation:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve escalation',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    assignTask,
    escalateApplication,
    updateTaskStatus,
    resolveEscalation,
    loading,
  };
}

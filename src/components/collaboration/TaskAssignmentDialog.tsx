import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCollaboration } from '@/hooks/useCollaboration';
import { ibmDb } from '@/lib/ibm';
import { toast } from 'sonner';

interface TaskAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedEntityId?: string;
  relatedEntityType?: string;
  defaultTitle?: string;
  onSuccess?: () => void;
}

interface User {
  id: string;
  email: string;
}

export function TaskAssignmentDialog({
  open,
  onOpenChange,
  relatedEntityId,
  relatedEntityType,
  defaultTitle = '',
  onSuccess,
}: TaskAssignmentDialogProps) {
  const { assignTask, loading } = useCollaboration();
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: '',
    task_type: 'review' as const,
    priority: 'medium' as const,
    assigned_to: '',
    due_date: '',
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, title: defaultTitle }));
  }, [defaultTitle]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles to get user information
      const { data, error } = await ibmDb
        .from('profiles')
        .select('id, email')
        .order('email');

      if (error) throw error;
      
      setUsers((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await assignTask({
        ...formData,
        related_entity_id: relatedEntityId,
        related_entity_type: relatedEntityType,
      });

      if (result) {
        onOpenChange(false);
        setFormData({
          title: '',
          description: '',
          task_type: 'review',
          priority: 'medium',
          assigned_to: '',
          due_date: '',
        });
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
          <DialogDescription>
            Assign a task to a team member for collaboration
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide task details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task_type">Task Type</Label>
              <Select
                value={formData.task_type}
                onValueChange={(value: any) => setFormData({ ...formData, task_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="document_check">Document Check</SelectItem>
                  <SelectItem value="escalation">Escalation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date (Optional)</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

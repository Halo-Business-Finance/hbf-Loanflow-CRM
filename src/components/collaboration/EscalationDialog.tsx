import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface EscalationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationName?: string;
  onSuccess?: () => void;
}

interface User {
  id: string;
  email: string;
}

export function EscalationDialog({
  open,
  onOpenChange,
  applicationId,
  applicationName = 'this application',
  onSuccess,
}: EscalationDialogProps) {
  const { escalateApplication, loading } = useCollaboration();
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    escalated_to: '',
    reason: '',
    priority: 'high' as const,
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles with manager/admin roles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email');

      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await escalateApplication({
        application_id: applicationId,
        ...formData,
      });

      if (result) {
        onOpenChange(false);
        setFormData({
          escalated_to: '',
          reason: '',
          priority: 'high',
        });
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error escalating application:', error);
      toast.error('Failed to escalate application. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Escalate Application</DialogTitle>
          </div>
          <DialogDescription>
            Escalate {applicationName} to a senior team member for review
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="escalated_to">Escalate To</Label>
            <Select
              value={formData.escalated_to}
              onValueChange={(value) => setFormData({ ...formData, escalated_to: value })}
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
            <Label htmlFor="priority">Priority Level</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Escalation</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Explain why this application needs escalation..."
              rows={4}
              required
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
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Escalating...' : 'Escalate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

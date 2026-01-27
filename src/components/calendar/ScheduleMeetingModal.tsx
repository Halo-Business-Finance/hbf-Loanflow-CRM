import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { User, Building2, Search } from 'lucide-react';

interface TeamUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ClientContact {
  id: string;
  name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  type: 'client' | 'lead';
}

interface ScheduleMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  onSuccess?: () => void;
  preselectedClient?: { id: string; name: string; type: 'client' | 'lead' };
}

export function ScheduleMeetingModal({ 
  open, 
  onOpenChange, 
  selectedDate,
  onSuccess,
  preselectedClient
}: ScheduleMeetingModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [clients, setClients] = useState<ClientContact[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'meeting',
    scheduledDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
    scheduledTime: '09:00',
    assignedUserId: '',
    clientId: preselectedClient?.id || '',
    clientType: preselectedClient?.type || '' as 'client' | 'lead' | '',
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchClients();
      if (preselectedClient) {
        setFormData(prev => ({
          ...prev,
          clientId: preselectedClient.id,
          clientType: preselectedClient.type,
        }));
      }
    }
  }, [open, preselectedClient]);

  const fetchUsers = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_active')
        .eq('is_active', true)
        .neq('id', currentUser?.id || '')
        .order('first_name', { ascending: true });

      if (error) throw error;
      
      const activeUsers = (data || []).filter(u => u.first_name || u.last_name);
      setUsers(activeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .neq('id', currentUser?.id || '')
          .order('first_name', { ascending: true });
        
        if (fallbackError) throw fallbackError;
        const activeUsers = (data || []).filter(u => u.first_name || u.last_name);
        setUsers(activeUsers);
      } catch (fallbackError) {
        console.error('Error in fallback fetch:', fallbackError);
      }
    }
  };

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch from contact_entities (leads/contacts)
      const { data: contacts, error } = await supabase
        .from('contact_entities')
        .select('id, name, business_name, email, phone')
        .order('name', { ascending: true })
        .limit(100);

      if (error) throw error;

      const clientList: ClientContact[] = (contacts || []).map(c => ({
        id: c.id,
        name: c.name,
        business_name: c.business_name,
        email: c.email,
        phone: c.phone,
        type: 'lead' as const,
      }));

      setClients(clientList);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    return (
      client.name.toLowerCase().includes(search) ||
      (client.business_name?.toLowerCase().includes(search)) ||
      client.email.toLowerCase().includes(search)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const scheduledFor = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);

      // Create notification for the current user
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: formData.title,
          message: formData.message,
          type: formData.type,
          scheduled_for: scheduledFor.toISOString(),
          related_id: formData.clientId || null,
          related_type: formData.clientType || null,
        });

      if (error) throw error;

      // If a user is assigned and it's a team meeting, create a notification for them too
      if (formData.assignedUserId && formData.assignedUserId !== user.id) {
        const { error: assignedError } = await supabase
          .from('notifications')
          .insert({
            user_id: formData.assignedUserId,
            title: formData.title,
            message: formData.message,
            type: formData.type,
            scheduled_for: scheduledFor.toISOString(),
          });

        if (assignedError) {
          console.error('Error creating notification for assigned user:', assignedError);
        }
      }

      toast.success('Event scheduled successfully');
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'meeting',
        scheduledDate: '',
        scheduledTime: '09:00',
        assignedUserId: '',
        clientId: '',
        clientType: '',
      });
      setClientSearch('');
    } catch (error) {
      console.error('Error scheduling event:', error);
      toast.error('Failed to schedule event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Event</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client/Lead Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Link to Client/Lead
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={formData.clientId}
              onValueChange={(value) => {
                const client = clients.find(c => c.id === value);
                setFormData(prev => ({ 
                  ...prev, 
                  clientId: value,
                  clientType: client?.type || '',
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-[200px]">
                <SelectItem value="">None</SelectItem>
                {filteredClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex flex-col">
                      <span>{client.name}</span>
                      {client.business_name && (
                        <span className="text-xs text-muted-foreground">{client.business_name}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(formData.type === 'meeting' || formData.type === 'call') && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Assign to Team Member
              </Label>
              <Select
                value={formData.assignedUserId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assignedUserId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={users.length > 0 ? "Select a team member" : "No team members available"} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50 max-h-[200px]">
                  {users.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No active team members found
                    </div>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The selected team member will also receive this event
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Description (Optional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Add event details or notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

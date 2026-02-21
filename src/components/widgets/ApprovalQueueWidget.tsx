import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, AlertTriangle, Clock, UserPlus } from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { TaskAssignmentDialog } from '@/components/collaboration/TaskAssignmentDialog';
import { EscalationDialog } from '@/components/collaboration/EscalationDialog';

interface QueueItem {
  id: string;
  name: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  stage: string;
  created_at: string;
  risk_level?: 'low' | 'medium' | 'high';
}

export function ApprovalQueueWidget() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const { data, error } = await ibmDb
        .from('contact_entities')
        .select('id, name, business_name, loan_amount, loan_type, stage, created_at')
        .in('stage', ['Pre-approval', 'Documentation', 'Underwriting'])
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw error;

      // Assign risk levels based on loan amount (simplified logic)
      const queueWithRisk = ((data as any[]) || []).map(item => ({
        ...item,
        risk_level: 
          (item.loan_amount || 0) > 500000 ? 'high' :
          (item.loan_amount || 0) > 200000 ? 'medium' : 'low'
      })) as QueueItem[];

      setQueue(queueWithRisk);
    } catch (error) {
      console.error('Error fetching approval queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await ibmDb
        .from('contact_entities')
        .update({ stage: 'Closing', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Application Approved',
        description: 'Application moved to closing stage',
      });
      fetchQueue();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve application',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await ibmDb
        .from('contact_entities')
        .update({ stage: 'Rejected', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Application Rejected',
        description: 'Application has been rejected',
        variant: 'destructive',
      });
      fetchQueue();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject application',
        variant: 'destructive',
      });
    }
  };

  const getRiskBadge = (risk?: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
      case 'medium':
        return <Badge variant="default" className="text-xs">Medium Risk</Badge>;
      case 'low':
        return <Badge variant="secondary" className="text-xs">Low Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-normal text-[#161616]">
            Approval Queue
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {queue.length} Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[#525252]">Loading queue...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm text-[#525252]">Queue is clear!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border border-[#e0e0e0] rounded-lg hover:bg-[#f4f4f4] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-[#161616]">
                          {item.business_name || item.name}
                        </p>
                        {getRiskBadge(item.risk_level)}
                      </div>
                      <p className="text-xs text-[#525252]">{item.name}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div>
                      <span className="text-[#525252]">Amount:</span>
                      <span className="ml-1 text-[#161616] font-medium">
                        {formatCurrency(item.loan_amount || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#525252]">Type:</span>
                      <span className="ml-1 text-[#161616]">{item.loan_type || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-[#525252]" />
                    <span className="text-xs text-[#525252]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(item.id)}
                      className="flex-1 h-8 text-xs border-red-600 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedItem(item);
                        setTaskDialogOpen(true);
                      }}
                      className="flex-1 h-8 text-xs"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedItem(item);
                        setEscalationDialogOpen(true);
                      }}
                      className="flex-1 h-8 text-xs border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Escalate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <TaskAssignmentDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        relatedEntityId={selectedItem?.id}
        relatedEntityType="contact_entity"
        defaultTitle={`Review approval for ${selectedItem?.business_name || selectedItem?.name}`}
        onSuccess={fetchQueue}
      />

      <EscalationDialog
        open={escalationDialogOpen}
        onOpenChange={setEscalationDialogOpen}
        applicationId={selectedItem?.id || ''}
        applicationName={selectedItem?.business_name || selectedItem?.name}
        onSuccess={fetchQueue}
      />
    </Card>
  );
}

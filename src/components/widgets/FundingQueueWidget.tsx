import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, CheckCircle, Clock, UserPlus, AlertTriangle } from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { TaskAssignmentDialog } from '@/components/collaboration/TaskAssignmentDialog';
import { EscalationDialog } from '@/components/collaboration/EscalationDialog';

interface FundingItem {
  id: string;
  name: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  stage: string;
  priority?: string;
  updated_at: string;
}

export function FundingQueueWidget() {
  const [queue, setQueue] = useState<FundingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FundingItem | null>(null);

  useEffect(() => {
    fetchFundingQueue();
  }, []);

  const fetchFundingQueue = async () => {
    try {
      const { data, error } = await ibmDb
        .from('contact_entities')
        .select('id, name, business_name, loan_amount, loan_type, stage, priority, updated_at')
        .in('stage', ['Approved', 'Closing'])
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      setQueue((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching funding queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async (id: string, amount: number) => {
    try {
      const { error } = await ibmDb
        .from('contact_entities')
        .update({ stage: 'Loan Funded', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Loan Funded',
        description: `Successfully funded ${formatCurrency(amount)}`,
      });
      fetchFundingQueue();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fund loan',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
      case 'medium':
        return <Badge variant="default" className="text-xs">Medium</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Normal</Badge>;
    }
  };

  const totalFunding = queue.reduce((sum, item) => sum + (item.loan_amount || 0), 0);

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#161616]" />
            <CardTitle className="text-base font-normal text-[#161616]">
              Funding Queue
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {queue.length} Ready
          </Badge>
        </div>
        {queue.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#e0e0e0]">
            <p className="text-xs text-[#525252]">Total Funding Required</p>
            <p className="text-lg font-semibold text-[#161616]">
              {formatCurrency(totalFunding)}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[#525252]">Loading funding queue...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm text-[#525252]">No loans pending funding</p>
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
                      <p className="font-medium text-sm text-[#161616] mb-1">
                        {item.business_name || item.name}
                      </p>
                      <p className="text-xs text-[#525252]">{item.name}</p>
                    </div>
                    {getPriorityBadge(item.priority)}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[#525252]">Funding Amount</span>
                      <span className="font-semibold text-[#161616]">
                        {formatCurrency(item.loan_amount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#525252]">
                      <span>{item.loan_type || 'N/A'}</span>
                      <span>•</span>
                      <span>{item.stage}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-3 w-3 text-[#525252]" />
                    <span className="text-xs text-[#525252]">
                      Last updated: {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleFund(item.id, item.loan_amount || 0)}
                    className="w-full h-8 text-xs bg-[#0f62fe] hover:bg-[#0353e9] text-white mb-2"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Fund Loan
                  </Button>

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
        defaultTitle={`Fund loan for ${selectedItem?.business_name || selectedItem?.name}`}
        onSuccess={fetchFundingQueue}
      />

      <EscalationDialog
        open={escalationDialogOpen}
        onOpenChange={setEscalationDialogOpen}
        applicationId={selectedItem?.id || ''}
        applicationName={selectedItem?.business_name || selectedItem?.name}
        onSuccess={fetchFundingQueue}
      />
    </Card>
  );
}

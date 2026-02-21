import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Circle, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { TaskAssignmentDialog } from '@/components/collaboration/TaskAssignmentDialog';
import { EscalationDialog } from '@/components/collaboration/EscalationDialog';

interface TimelineTask {
  id: string;
  name: string;
  business_name?: string;
  stage: string;
  created_at: string;
  updated_at: string;
  daysInStage: number;
  status: 'overdue' | 'urgent' | 'normal' | 'completed';
}

export function TaskTimelineWidget() {
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await ibmDb
        .from('contact_entities')
        .select('id, name, business_name, stage, created_at, updated_at')
        .in('stage', ['Application', 'Pre-approval', 'Documentation'])
        .order('created_at', { ascending: true })
        .limit(15);

      if (error) throw error;

      const now = new Date();
      const tasksWithStatus = ((data as any[]) || []).map((item: any) => {
        const updatedDate = new Date(item.updated_at);
        const daysInStage = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: 'overdue' | 'urgent' | 'normal' | 'completed' = 'normal';
        if (daysInStage > 7) status = 'overdue';
        else if (daysInStage > 5) status = 'urgent';
        
        return {
          ...item,
          daysInStage,
          status,
        };
      });

      setTasks(tasksWithStatus as TimelineTask[]);
    } catch (error) {
      console.error('Error fetching timeline tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: TimelineTask['status']) => {
    switch (status) {
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'urgent':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Circle className="h-4 w-4 text-[#0f62fe]" />;
    }
  };

  const getStatusBadge = (status: TimelineTask['status'], days: number) => {
    if (status === 'overdue') {
      return <Badge variant="destructive" className="text-xs">{days}d Overdue</Badge>;
    }
    if (status === 'urgent') {
      return <Badge variant="default" className="text-xs bg-orange-500">{days}d Urgent</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{days}d</Badge>;
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-normal text-[#161616]">
            Processing Timeline
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {tasks.filter(t => t.status !== 'completed').length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[#525252]">Loading timeline...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm text-[#525252]">All tasks completed!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="relative pl-6">
              {/* Timeline line */}
              <div className="absolute left-2 top-0 bottom-0 w-px bg-[#e0e0e0]" />
              
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <div key={task.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-6 mt-1">
                      {getStatusIcon(task.status)}
                    </div>
                    
                    <div className="p-3 border border-[#e0e0e0] rounded-lg hover:bg-[#f4f4f4] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-[#161616]">
                            {task.business_name || task.name}
                          </p>
                          <p className="text-xs text-[#525252]">{task.name}</p>
                        </div>
                        {getStatusBadge(task.status, task.daysInStage)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-[#525252] mb-2">
                        <span>Stage: <span className="text-[#161616]">{task.stage}</span></span>
                        <span>•</span>
                        <span>Started: {new Date(task.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTask(task);
                            setTaskDialogOpen(true);
                          }}
                          className="h-7 text-xs"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                        {task.status === 'overdue' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTask(task);
                              setEscalationDialogOpen(true);
                            }}
                            className="h-7 text-xs border-orange-500 text-orange-600 hover:bg-orange-50"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Escalate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <TaskAssignmentDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        relatedEntityId={selectedTask?.id}
        relatedEntityType="contact_entity"
        defaultTitle={`Process ${selectedTask?.business_name || selectedTask?.name}`}
        onSuccess={fetchTasks}
      />

      <EscalationDialog
        open={escalationDialogOpen}
        onOpenChange={setEscalationDialogOpen}
        applicationId={selectedTask?.id || ''}
        applicationName={selectedTask?.business_name || selectedTask?.name}
        onSuccess={fetchTasks}
      />
    </Card>
  );
}

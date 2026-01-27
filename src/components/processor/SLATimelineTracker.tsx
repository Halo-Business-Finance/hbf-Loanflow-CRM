import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Timer,
  Target,
  BarChart3
} from 'lucide-react';
import { differenceInHours, differenceInDays, format, addDays, addHours } from 'date-fns';

interface SLAMilestone {
  id: string;
  name: string;
  targetHours: number;
  actualHours?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  startedAt?: Date;
  completedAt?: Date;
  dueAt: Date;
}

interface LoanSLA {
  loanId: string;
  borrowerName: string;
  loanType: string;
  submittedAt: Date;
  targetCloseDate: Date;
  currentStage: string;
  overallProgress: number;
  milestones: SLAMilestone[];
  status: 'on_track' | 'at_risk' | 'delayed';
}

const mockLoans: LoanSLA[] = [
  {
    loanId: 'LN-2024-001',
    borrowerName: 'John Smith',
    loanType: 'SBA 7(a)',
    submittedAt: addDays(new Date(), -10),
    targetCloseDate: addDays(new Date(), 20),
    currentStage: 'Underwriting',
    overallProgress: 45,
    status: 'on_track',
    milestones: [
      { id: '1', name: 'Initial Review', targetHours: 24, actualHours: 18, status: 'completed', startedAt: addDays(new Date(), -10), completedAt: addDays(new Date(), -9), dueAt: addDays(new Date(), -9) },
      { id: '2', name: 'Document Collection', targetHours: 72, actualHours: 65, status: 'completed', startedAt: addDays(new Date(), -9), completedAt: addDays(new Date(), -6), dueAt: addDays(new Date(), -6) },
      { id: '3', name: 'Underwriting', targetHours: 120, status: 'in_progress', startedAt: addDays(new Date(), -6), dueAt: addDays(new Date(), -1) },
      { id: '4', name: 'Approval', targetHours: 48, status: 'pending', dueAt: addDays(new Date(), 1) },
      { id: '5', name: 'Closing Prep', targetHours: 96, status: 'pending', dueAt: addDays(new Date(), 5) },
      { id: '6', name: 'Funding', targetHours: 24, status: 'pending', dueAt: addDays(new Date(), 6) }
    ]
  },
  {
    loanId: 'LN-2024-002',
    borrowerName: 'Jane Doe',
    loanType: 'Commercial RE',
    submittedAt: addDays(new Date(), -15),
    targetCloseDate: addDays(new Date(), 5),
    currentStage: 'Approval',
    overallProgress: 70,
    status: 'at_risk',
    milestones: [
      { id: '1', name: 'Initial Review', targetHours: 24, actualHours: 30, status: 'completed', startedAt: addDays(new Date(), -15), completedAt: addDays(new Date(), -14), dueAt: addDays(new Date(), -14) },
      { id: '2', name: 'Document Collection', targetHours: 72, actualHours: 96, status: 'completed', startedAt: addDays(new Date(), -14), completedAt: addDays(new Date(), -10), dueAt: addDays(new Date(), -11) },
      { id: '3', name: 'Underwriting', targetHours: 120, actualHours: 144, status: 'completed', startedAt: addDays(new Date(), -10), completedAt: addDays(new Date(), -4), dueAt: addDays(new Date(), -5) },
      { id: '4', name: 'Approval', targetHours: 48, status: 'in_progress', startedAt: addDays(new Date(), -4), dueAt: addHours(new Date(), -12) },
      { id: '5', name: 'Closing Prep', targetHours: 96, status: 'pending', dueAt: addDays(new Date(), 3) },
      { id: '6', name: 'Funding', targetHours: 24, status: 'pending', dueAt: addDays(new Date(), 4) }
    ]
  },
  {
    loanId: 'LN-2024-003',
    borrowerName: 'Mike Johnson',
    loanType: 'Equipment',
    submittedAt: addDays(new Date(), -20),
    targetCloseDate: addDays(new Date(), -2),
    currentStage: 'Closing Prep',
    overallProgress: 85,
    status: 'delayed',
    milestones: [
      { id: '1', name: 'Initial Review', targetHours: 24, actualHours: 20, status: 'completed', startedAt: addDays(new Date(), -20), completedAt: addDays(new Date(), -19), dueAt: addDays(new Date(), -19) },
      { id: '2', name: 'Document Collection', targetHours: 72, actualHours: 80, status: 'completed', startedAt: addDays(new Date(), -19), completedAt: addDays(new Date(), -16), dueAt: addDays(new Date(), -16) },
      { id: '3', name: 'Underwriting', targetHours: 120, actualHours: 140, status: 'completed', startedAt: addDays(new Date(), -16), completedAt: addDays(new Date(), -10), dueAt: addDays(new Date(), -11) },
      { id: '4', name: 'Approval', targetHours: 48, actualHours: 72, status: 'completed', startedAt: addDays(new Date(), -10), completedAt: addDays(new Date(), -7), dueAt: addDays(new Date(), -8) },
      { id: '5', name: 'Closing Prep', targetHours: 96, status: 'overdue', startedAt: addDays(new Date(), -7), dueAt: addDays(new Date(), -3) },
      { id: '6', name: 'Funding', targetHours: 24, status: 'pending', dueAt: addDays(new Date(), -2) }
    ]
  }
];

export function SLATimelineTracker() {
  const [loans] = useState<LoanSLA[]>(mockLoans);
  const [selectedLoan, setSelectedLoan] = useState<LoanSLA | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_track':
        return <Badge variant="default" className="bg-green-500">On Track</Badge>;
      case 'at_risk':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">At Risk</Badge>;
      case 'delayed':
        return <Badge variant="destructive">Delayed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMilestoneStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Timer className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const onTrackCount = loans.filter(l => l.status === 'on_track').length;
  const atRiskCount = loans.filter(l => l.status === 'at_risk').length;
  const delayedCount = loans.filter(l => l.status === 'delayed').length;

  const avgCycleTime = Math.round(loans.reduce((sum, loan) => {
    const days = differenceInDays(loan.targetCloseDate, loan.submittedAt);
    return sum + days;
  }, 0) / loans.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              SLA & Timeline Tracker
            </CardTitle>
            <CardDescription>
              Monitor turn times and identify bottlenecks
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <BarChart3 className="mr-2 h-4 w-4" />
            View Reports
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{onTrackCount}</div>
              <div className="text-xs text-muted-foreground">On Track</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{atRiskCount}</div>
              <div className="text-xs text-muted-foreground">At Risk</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">{delayedCount}</div>
              <div className="text-xs text-muted-foreground">Delayed</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{avgCycleTime}</div>
              <div className="text-xs text-muted-foreground">Avg Days to Close</div>
            </CardContent>
          </Card>
        </div>

        {/* Loan List */}
        <div className="space-y-4">
          {loans.map(loan => (
            <div 
              key={loan.loanId}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedLoan?.loanId === loan.loanId ? 'ring-2 ring-primary' : ''
              } ${
                loan.status === 'delayed' ? 'border-red-500/50' :
                loan.status === 'at_risk' ? 'border-yellow-500/50' :
                'border-border'
              }`}
              onClick={() => setSelectedLoan(selectedLoan?.loanId === loan.loanId ? null : loan)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{loan.loanId}</span>
                    {getStatusBadge(loan.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {loan.borrowerName} • {loan.loanType}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    Target: {format(loan.targetCloseDate, 'MMM d, yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current: {loan.currentStage}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Overall Progress</span>
                  <span>{loan.overallProgress}%</span>
                </div>
                <Progress value={loan.overallProgress} className="h-2" />
              </div>

              {/* Expanded Milestone View */}
              {selectedLoan?.loanId === loan.loanId && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">Milestone Timeline</h4>
                  <div className="space-y-3">
                    {loan.milestones.map((milestone, index) => {
                      const hoursRemaining = milestone.status === 'in_progress' 
                        ? differenceInHours(milestone.dueAt, new Date())
                        : null;
                      
                      return (
                        <div key={milestone.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            {getMilestoneStatusIcon(milestone.status)}
                            {index < loan.milestones.length - 1 && (
                              <div className={`w-0.5 h-8 mt-1 ${
                                milestone.status === 'completed' ? 'bg-green-500' : 'bg-border'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${
                                milestone.status === 'overdue' ? 'text-red-500' :
                                milestone.status === 'completed' ? 'text-green-500' :
                                milestone.status === 'in_progress' ? 'text-blue-500' :
                                'text-muted-foreground'
                              }`}>
                                {milestone.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Target: {milestone.targetHours}h
                                {milestone.actualHours && ` • Actual: ${milestone.actualHours}h`}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {milestone.status === 'completed' && milestone.completedAt && (
                                <>Completed {format(milestone.completedAt, 'MMM d, h:mm a')}</>
                              )}
                              {milestone.status === 'in_progress' && hoursRemaining !== null && (
                                <span className={hoursRemaining < 0 ? 'text-red-500' : ''}>
                                  {hoursRemaining < 0 
                                    ? `Overdue by ${Math.abs(hoursRemaining)} hours`
                                    : `${hoursRemaining} hours remaining`
                                  }
                                </span>
                              )}
                              {milestone.status === 'overdue' && (
                                <span className="text-red-500">
                                  Due: {format(milestone.dueAt, 'MMM d, h:mm a')}
                                </span>
                              )}
                              {milestone.status === 'pending' && (
                                <>Due: {format(milestone.dueAt, 'MMM d, h:mm a')}</>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

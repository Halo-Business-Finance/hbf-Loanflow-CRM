import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sparkles, 
  FileText, 
  DollarSign, 
  Home, 
  Shield, 
  Scale, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Copy,
  Download
} from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';

interface Condition {
  id: string;
  category: 'Documentation' | 'Financial' | 'Property' | 'Insurance' | 'Legal' | 'Prior-to-Funding';
  title: string;
  description: string;
  priority: 'Required' | 'Recommended' | 'Optional';
  dueDate?: string;
  responsibleParty: string;
}

interface GeneratedConditions {
  conditions: Condition[];
  summary: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface LoanApplication {
  id: string;
  name?: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  credit_score?: number;
  income?: number;
  debt_to_income_ratio?: number;
  years_in_business?: number;
  collateral_value?: number;
  purpose_of_loan?: string;
}

interface AutoConditionGeneratorProps {
  application?: LoanApplication | null;
  onConditionsGenerated?: (conditions: GeneratedConditions) => void;
}

export function AutoConditionGenerator({ application, onConditionsGenerated }: AutoConditionGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generatedConditions, setGeneratedConditions] = useState<GeneratedConditions | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Documentation': return <FileText className="h-4 w-4" />;
      case 'Financial': return <DollarSign className="h-4 w-4" />;
      case 'Property': return <Home className="h-4 w-4" />;
      case 'Insurance': return <Shield className="h-4 w-4" />;
      case 'Legal': return <Scale className="h-4 w-4" />;
      case 'Prior-to-Funding': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Required': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Recommended': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Optional': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-500/20 text-green-400';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'High': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const generateConditions = async () => {
    if (!application) {
      toast({
        title: "No Application Selected",
        description: "Please select an application to generate conditions for.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await ibmDb.rpc('generate_conditions', {
        application
      });

      if (error) {
        throw error;
      }

      if ((data as any).error) {
        throw new Error((data as any).error);
      }

      setGeneratedConditions(data as any);
      setSelectedConditions(new Set((data as any).conditions.filter((c: Condition) => c.priority === 'Required').map((c: Condition) => c.id)));
      
      if (onConditionsGenerated) {
        onConditionsGenerated(data as GeneratedConditions);
      }

      toast({
        title: "Conditions Generated",
        description: `Generated ${(data as any).conditions.length} conditions for this application.`
      });
    } catch (error) {
      console.error('Error generating conditions:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate conditions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCondition = (id: string) => {
    const newSelected = new Set(selectedConditions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedConditions(newSelected);
  };

  const copyConditions = () => {
    if (!generatedConditions) return;
    
    const selected = generatedConditions.conditions.filter(c => selectedConditions.has(c.id));
    const text = selected.map(c => 
      `[${c.category}] ${c.title}\n${c.description}\nPriority: ${c.priority} | Responsible: ${c.responsibleParty}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${selected.length} conditions copied.`
    });
  };

  const exportConditions = () => {
    if (!generatedConditions) return;
    
    const selected = generatedConditions.conditions.filter(c => selectedConditions.has(c.id));
    const csvContent = [
      ['Category', 'Title', 'Description', 'Priority', 'Responsible Party', 'Due Date'].join(','),
      ...selected.map(c => 
        [c.category, `"${c.title}"`, `"${c.description}"`, c.priority, c.responsibleParty, c.dueDate || ''].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conditions-${application?.name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: `${selected.length} conditions exported to CSV.`
    });
  };

  const groupedConditions = generatedConditions?.conditions.reduce((acc, condition) => {
    if (!acc[condition.category]) {
      acc[condition.category] = [];
    }
    acc[condition.category].push(condition);
    return acc;
  }, {} as Record<string, Condition[]>) || {};

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Condition Generator</CardTitle>
          </div>
          {generatedConditions && (
            <Badge className={getRiskColor(generatedConditions.riskLevel)}>
              {generatedConditions.riskLevel} Risk
            </Badge>
          )}
        </div>
        {application && (
          <p className="text-sm text-muted-foreground mt-1">
            Generating conditions for: {application.business_name || application.name}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!generatedConditions ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {application 
                ? "Click generate to create AI-powered underwriting conditions based on the application data."
                : "Select an application from the pending list to generate conditions."}
            </p>
            <Button 
              onClick={generateConditions} 
              disabled={loading || !application}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Application...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Conditions
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                {generatedConditions.riskLevel === 'High' ? (
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                ) : generatedConditions.riskLevel === 'Medium' ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">Risk Assessment Summary</p>
                  <p className="text-sm text-muted-foreground">{generatedConditions.summary}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyConditions} className="gap-1">
                <Copy className="h-3 w-3" />
                Copy Selected ({selectedConditions.size})
              </Button>
              <Button variant="outline" size="sm" onClick={exportConditions} className="gap-1">
                <Download className="h-3 w-3" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={generateConditions} disabled={loading} className="gap-1 ml-auto">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Regenerate
              </Button>
            </div>

            {/* Conditions List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {Object.entries(groupedConditions).map(([category, conditions]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {getCategoryIcon(category)}
                      {category}
                      <Badge variant="outline" className="text-xs">
                        {conditions.length}
                      </Badge>
                    </div>
                    <div className="space-y-2 ml-6">
                      {conditions.map((condition) => (
                        <div 
                          key={condition.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            selectedConditions.has(condition.id) 
                              ? 'bg-primary/5 border-primary/30' 
                              : 'bg-card border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={selectedConditions.has(condition.id)}
                              onCheckedChange={() => toggleCondition(condition.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{condition.title}</span>
                                <Badge className={`text-xs ${getPriorityColor(condition.priority)}`}>
                                  {condition.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{condition.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>Responsible: {condition.responsibleParty}</span>
                                {condition.dueDate && <span>Due: {condition.dueDate}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

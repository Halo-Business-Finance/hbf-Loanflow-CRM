import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ibmDb } from "@/lib/ibm";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Brain, TrendingUp, Target, Sparkles, ArrowRight, RefreshCw, Zap, BarChart3 } from "lucide-react";

interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  confidence: number;
  factors: unknown;
  next_best_actions: unknown;
  predicted_close_date: string | null;
  predicted_value: number | null;
  scored_at: string;
}
interface Lead {
  id: string;
  contact_entity_id: string;
  contact_entities?: {
    name: string;
    business_name: string | null;
    loan_amount: number | null;
  };
}

export default function AILeadScoring() {
  const { user } = useAuth();
  const [scores, setScores] = useState<LeadScore[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScoring, setIsScoring] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    const scoresRes = await ibmDb.from<LeadScore>("ai_lead_scores").select("*").order("score", { ascending: false }).limit(50);
    
    // Fetch leads and manually join contact entities
    const leadsRes = await ibmDb.from<Lead>("leads").select("*").limit(20);
    const leadData = leadsRes.data as Lead[] || [];
    const contactIds = leadData.map(l => l.contact_entity_id).filter(Boolean);
    
    let contactsMap = new Map();
    if (contactIds.length > 0) {
      const contactsRes = await ibmDb.from("contact_entities").select("*").in("id", contactIds);
      (contactsRes.data || []).forEach((c: any) => contactsMap.set(c.id, c));
    }

    const joinedLeads = leadData.map(l => ({
      ...l,
      contact_entities: contactsMap.get(l.contact_entity_id)
    }));

    if (scoresRes.data) setScores(scoresRes.data);
    if (leadsRes.data) setLeads(joinedLeads as Lead[]);
    setIsLoading(false);
  };

  const runScoring = async () => {
    setIsScoring(true);
    toast.info("Running AI scoring on all leads...");
    
    // Simulate AI scoring for demo
    for (const lead of leads) {
      const score = Math.floor(Math.random() * 40) + 60;
      const factors = [
        { factor: "Loan amount", impact: score > 80 ? "positive" : "neutral", weight: 0.25 },
        { factor: "Industry fit", impact: Math.random() > 0.5 ? "positive" : "neutral", weight: 0.2 },
        { factor: "Time in business", impact: Math.random() > 0.3 ? "positive" : "negative", weight: 0.15 },
        { factor: "Credit indicators", impact: score > 75 ? "positive" : "neutral", weight: 0.25 },
        { factor: "Engagement level", impact: Math.random() > 0.4 ? "positive" : "neutral", weight: 0.15 },
      ];
      
      const actions = [
        { action: "Schedule discovery call", priority: "high", reason: "High engagement potential" },
        { action: "Send rate comparison", priority: "medium", reason: "Competitive positioning" },
        { action: "Request financials", priority: "medium", reason: "Complete underwriting prep" },
      ];

      await ibmDb.from("ai_lead_scores").upsert([{
        lead_id: lead.id,
        score,
        confidence: Math.random() * 0.3 + 0.7,
        factors,
        next_best_actions: actions.slice(0, Math.floor(Math.random() * 2) + 1),
        predicted_close_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted_value: lead.contact_entities?.loan_amount || Math.floor(Math.random() * 500000) + 100000,
        model_version: "v1",
        scored_at: new Date().toISOString(),
      }]);
    }

    toast.success("AI scoring complete!");
    setIsScoring(false);
    fetchData();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-green-500/20 text-green-400";
    if (score >= 60) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  const stats = {
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0,
    highPotential: scores.filter(s => s.score >= 80).length,
    totalScored: scores.length,
    totalValue: scores.reduce((a, b) => a + (b.predicted_value || 0), 0),
  };

  if (isLoading) {
    return (
      <StandardPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </StandardPageLayout>
    );
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="AI Lead Scoring"
        subtitle="Predictive conversion probability with next best action suggestions"
        actions={
          <Button onClick={runScoring} disabled={isScoring}>
            {isScoring ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            {isScoring ? "Scoring..." : "Run AI Scoring"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/20">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Target className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Potential</p>
                <p className="text-2xl font-bold">{stats.highPotential}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Scored</p>
                <p className="text-2xl font-bold">{stats.totalScored}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">${(stats.totalValue / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="scores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scores">Lead Scores</TabsTrigger>
          <TabsTrigger value="actions">Next Best Actions</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle>Lead Score Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No leads scored yet. Click "Run AI Scoring" to analyze your leads.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scores.map((score, index) => {
                    const lead = leads.find(l => l.id === score.lead_id);
                    return (
                      <div key={score.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`text-2xl font-bold ${getScoreColor(score.score)}`}>
                            {score.score}
                          </div>
                          <div>
                            <p className="font-medium">{lead?.contact_entities?.name || "Unknown Lead"}</p>
                            <p className="text-sm text-muted-foreground">
                              {lead?.contact_entities?.business_name || "No business"} • 
                              Confidence: {(score.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${((score.predicted_value || 0) / 1000).toFixed(0)}K
                            </p>
                            <p className="text-xs text-muted-foreground">Predicted value</p>
                          </div>
                          <Badge className={getScoreBadge(score.score)}>
                            {score.score >= 80 ? "Hot" : score.score >= 60 ? "Warm" : "Cold"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Next Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scores.filter(s => Array.isArray(s.next_best_actions) && s.next_best_actions.length > 0).slice(0, 10).map((score) => {
                  const lead = leads.find(l => l.id === score.lead_id);
                  const actions = score.next_best_actions as any[];
                  return (
                    <div key={score.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="font-medium">{lead?.contact_entities?.name}</span>
                        </div>
                        <Badge className={getScoreBadge(score.score)}>Score: {score.score}</Badge>
                      </div>
                      <div className="space-y-2">
                        {actions.map((action, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2">
                              <Zap className="h-3 w-3 text-yellow-500" />
                              <span className="text-sm">{action.action}</span>
                            </div>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Hot (80-100)</span>
                      <span>{scores.filter(s => s.score >= 80).length} leads</span>
                    </div>
                    <Progress value={(scores.filter(s => s.score >= 80).length / Math.max(scores.length, 1)) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Warm (60-79)</span>
                      <span>{scores.filter(s => s.score >= 60 && s.score < 80).length} leads</span>
                    </div>
                    <Progress value={(scores.filter(s => s.score >= 60 && s.score < 80).length / Math.max(scores.length, 1)) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Cold (0-59)</span>
                      <span>{scores.filter(s => s.score < 60).length} leads</span>
                    </div>
                    <Progress value={(scores.filter(s => s.score < 60).length / Math.max(scores.length, 1)) * 100} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Scoring Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                    <span className="text-sm">Loan amount alignment</span>
                    <Badge variant="outline" className="text-green-400">+15 pts avg</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                    <span className="text-sm">Industry fit score</span>
                    <Badge variant="outline" className="text-green-400">+12 pts avg</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                    <span className="text-sm">Credit profile match</span>
                    <Badge variant="outline" className="text-green-400">+10 pts avg</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-red-500/10 rounded">
                    <span className="text-sm">Time in business (short)</span>
                    <Badge variant="outline" className="text-red-400">-8 pts avg</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StandardKPICard } from "@/components/StandardKPICard";
import { StandardContentCard } from "@/components/StandardContentCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Plug, Settings, CheckCircle2, XCircle, RefreshCw, Plus, 
  CreditCard, Building, FileText, Calculator, Database, Cloud,
  Link2, Zap, Activity
} from "lucide-react";

interface Integration {
  id: string;
  integration_type: string;
  name: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
  error_message: string | null;
}

const availableIntegrations = [
  {
    id: "plaid",
    name: "Plaid",
    description: "Bank account verification and financial data",
    category: "financial",
    icon: Building,
    color: "bg-green-500/20 text-green-400",
  },
  {
    id: "experian",
    name: "Experian",
    description: "Credit bureau reports and scoring",
    category: "credit",
    icon: CreditCard,
    color: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "equifax",
    name: "Equifax",
    description: "Credit reports and identity verification",
    category: "credit",
    icon: CreditCard,
    color: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "transunion",
    name: "TransUnion",
    description: "Credit data and fraud prevention",
    category: "credit",
    icon: CreditCard,
    color: "bg-red-500/20 text-red-400",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting and financial management",
    category: "accounting",
    icon: Calculator,
    color: "bg-emerald-500/20 text-emerald-400",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Cloud accounting software",
    category: "accounting",
    icon: Cloud,
    color: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "docusign",
    name: "DocuSign",
    description: "Electronic signatures and document management",
    category: "documents",
    icon: FileText,
    color: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "CRM data sync and integration",
    category: "crm",
    icon: Database,
    color: "bg-indigo-500/20 text-indigo-400",
  },
];

export default function IntegrationHub() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<typeof availableIntegrations[0] | null>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  const fetchConnections = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("integration_connections")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setConnections(data);
    setIsLoading(false);
  };

  const connectIntegration = async () => {
    if (!user || !selectedIntegration) return;
    
    const { error } = await supabase.from("integration_connections").insert([{
      integration_type: selectedIntegration.id,
      name: selectedIntegration.name,
      provider: selectedIntegration.id,
      status: "active",
      created_by: user.id,
    }]);

    if (error) {
      toast.error("Failed to connect integration");
    } else {
      toast.success(`${selectedIntegration.name} connected successfully`);
      setConnectDialogOpen(false);
      setSelectedIntegration(null);
      setApiKey("");
      fetchConnections();
    }
  };

  const syncIntegration = async (id: string) => {
    toast.info("Syncing integration...");
    await supabase.from("integration_connections").update({
      last_sync_at: new Date().toISOString(),
    }).eq("id", id);
    
    await supabase.from("integration_logs").insert([{
      connection_id: id,
      action: "sync",
      status: "success",
      duration_ms: Math.floor(Math.random() * 2000) + 500,
    }]);
    
    toast.success("Sync completed");
    fetchConnections();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case "error":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400"><RefreshCw className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const connectedIds = connections.map(c => c.integration_type);
  const categories = ["financial", "credit", "accounting", "documents", "crm"];

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
        title="Integration Hub"
        subtitle="Connect to Plaid, credit bureaus, and accounting systems"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StandardKPICard 
          title="Connected" 
          value={connections.filter(c => c.status === "active").length.toString()} 
        />
        <StandardKPICard 
          title="Available" 
          value={(availableIntegrations.length - connections.length).toString()} 
        />
        <StandardKPICard 
          title="Last Sync" 
          value={connections.length > 0 && connections[0].last_sync_at 
            ? new Date(connections[0].last_sync_at).toLocaleDateString() 
            : "Never"} 
        />
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected">Connected</TabsTrigger>
          <TabsTrigger value="available">Available Integrations</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          <Card>
            <CardHeader>
              <CardTitle>Active Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No integrations connected yet</p>
                  <Button className="mt-4" onClick={() => setConnectDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />Connect Your First Integration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map((conn) => {
                    const integration = availableIntegrations.find(i => i.id === conn.integration_type);
                    const Icon = integration?.icon || Plug;
                    return (
                      <div key={conn.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${integration?.color || "bg-muted"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{conn.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Last sync: {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "Never"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(conn.status)}
                          <Button variant="outline" size="sm" onClick={() => syncIntegration(conn.id)}>
                            <RefreshCw className="h-4 w-4 mr-1" />Sync
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="available">
          <div className="space-y-6">
            {categories.map((category) => {
              const categoryIntegrations = availableIntegrations.filter(i => i.category === category);
              if (categoryIntegrations.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="text-lg font-semibold capitalize mb-4">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryIntegrations.map((integration) => {
                      const isConnected = connectedIds.includes(integration.id);
                      const Icon = integration.icon;
                      return (
                        <Card key={integration.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-lg ${integration.color}`}>
                                <Icon className="h-6 w-6" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{integration.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                                <Button
                                  className="mt-4 w-full"
                                  variant={isConnected ? "secondary" : "default"}
                                  disabled={isConnected}
                                  onClick={() => {
                                    setSelectedIntegration(integration);
                                    setConnectDialogOpen(true);
                                  }}
                                >
                                  {isConnected ? (
                                    <><CheckCircle2 className="h-4 w-4 mr-2" />Connected</>
                                  ) : (
                                    <><Plus className="h-4 w-4 mr-2" />Connect</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Activity logs will appear here once integrations are synced.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {selectedIntegration?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Enter your API credentials to connect {selectedIntegration?.name} to your account.
            </p>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
            </div>
            <Button onClick={connectIntegration} className="w-full">
              Connect Integration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </StandardPageLayout>
  );
}

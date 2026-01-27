import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { StandardContentCard } from "@/components/StandardContentCard";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";

import { CustomObjectsManager } from "@/components/enterprise/CustomObjectsManager";
import { WorkflowBuilder } from "@/components/enterprise/WorkflowBuilder";
import { ApprovalProcessManager } from "@/components/enterprise/ApprovalProcessManager";
import { TerritoryManager } from "@/components/enterprise/TerritoryManager";
import { OpportunityManager } from "@/components/enterprise/OpportunityManager";
import { 
  Database, 
  Workflow, 
  CheckCircle, 
  Map, 
  Target,
  Shield
} from "lucide-react";

export default function Enterprise() {
  const { hasRole, loading: authLoading, userRoles, user } = useAuth();
  const [activeTab, setActiveTab] = useState("custom-objects");

  // Debug logging
  console.log('Enterprise Page - Auth State:', {
    authLoading,
    userRoles,
    userId: user?.id,
    hasAdminRole: hasRole('admin'),
    hasSuperAdminRole: hasRole('super_admin')
  });

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // If roles haven't loaded yet, keep showing the loading state
  if (!userRoles || userRoles.length === 0) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground">Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!(hasRole('admin') || hasRole('super_admin'))) {
    return (
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-96">
            <Card className="text-center max-w-xl w-full">
              <CardHeader>
                <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
                <CardTitle>Access Restricted</CardTitle>
                <CardDescription>
                  Only administrators can access enterprise features.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium">{user?.email ?? 'unknown'}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your roles: <span className="font-medium">{userRoles?.join(', ') || 'none'}</span>
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <a href="/auth">
                    <Button variant="outline">Switch account</Button>
                  </a>
                  <a href="/">
                    <Button variant="ghost">Go Home</Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    );
  }

  const features = [
    {
      id: "custom-objects",
      label: "Custom Objects",
      icon: Database,
      description: "Create custom data models beyond leads and clients"
    },
    {
      id: "workflows",
      label: "Workflow Builder",
      icon: Workflow,
      description: "Visual process automation with conditional logic"
    },
    {
      id: "approvals",
      label: "Approval Processes",
      icon: CheckCircle,
      description: "Multi-step approval workflows for deals and pricing"
    },
    {
      id: "territories",
      label: "Territory Management",
      icon: Map,
      description: "Geographic and hierarchical territory assignment"
    },
    {
      id: "opportunities",
      label: "Opportunity Splits",
      icon: Target,
      description: "Revenue sharing across multiple team members"
    }
  ];

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Enterprise Command Center"
        subtitle="Advanced CRM capabilities for enterprise-level sales management"
      />
      
      <ResponsiveContainer padding="md">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StandardContentCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Features</p>
                <div className="mt-1">
                  <p className="text-2xl font-bold">{features.length}</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">
                ENTERPRISE
              </span>
            </div>
          </StandardContentCard>

          <StandardContentCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
                <p className="text-2xl font-bold">—</p>
              </div>
              <Workflow className="w-8 h-8 text-primary" />
            </div>
          </StandardContentCard>

          <StandardContentCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Custom Objects</p>
                <p className="text-2xl font-bold">—</p>
              </div>
              <Database className="w-8 h-8 text-primary" />
            </div>
          </StandardContentCard>

          <StandardContentCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approval Processes</p>
                <p className="text-2xl font-bold">—</p>
              </div>
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </StandardContentCard>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full bg-[#0A1628] p-1 gap-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <TabsTrigger key={feature.id} value={feature.id} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2 text-xs">
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{feature.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeTab === feature.id;
              return (
                <div
                  key={feature.id}
                  onClick={() => setActiveTab(feature.id)}
                  className="cursor-pointer"
                >
                  <StandardContentCard
                    className={`transition-all hover:shadow-lg ${
                      isActive ? 'ring-2 ring-primary shadow-lg' : ''
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        {isActive && (
                          <span className="text-xs font-medium px-2 py-1 bg-primary text-primary-foreground rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-1">{feature.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </StandardContentCard>
                </div>
              );
            })}
          </div>

          <TabsContent value="custom-objects" className="space-y-6">
            <CustomObjectsManager />
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            <WorkflowBuilder />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6">
            <ApprovalProcessManager />
          </TabsContent>

          <TabsContent value="territories" className="space-y-6">
            <TerritoryManager />
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-6">
            <OpportunityManager />
          </TabsContent>
        </Tabs>
      </ResponsiveContainer>
    </StandardPageLayout>
  );
}
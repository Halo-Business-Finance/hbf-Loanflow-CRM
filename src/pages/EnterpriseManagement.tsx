import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BankPartnerCollaboration } from '@/components/partnerships/BankPartnerCollaboration';
import { AdvancedAnalytics } from '@/components/analytics/AdvancedAnalytics';
import { TeamCollaboration } from '@/components/collaboration/TeamCollaboration';
import { WorkflowAutomation } from '@/components/operations/WorkflowAutomation';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { 
  Handshake, 
  BarChart3, 
  Users, 
  Zap,
  Building2,
  TrendingUp
} from 'lucide-react';

export default function EnterpriseManagement() {
  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Enterprise Management Center"
        subtitle="Advanced business intelligence, collaboration, and partner management"
      />

      <div className="p-6 space-y-6">
        {/* Enterprise Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Partnerships</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Handshake className="w-5 h-5" />
                    <p className="text-lg font-bold">12</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Analytics Insights</p>
                  <p className="text-2xl font-bold text-primary">94%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Collaboration</p>
                  <p className="text-2xl font-bold text-primary">24/7</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Automated Workflows</p>
                  <p className="text-2xl font-bold text-primary">47</p>
                </div>
                <Zap className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="partnerships" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="partnerships">Bank Partnerships</TabsTrigger>
            <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
            <TabsTrigger value="collaboration">Team Collaboration</TabsTrigger>
            <TabsTrigger value="automation">Workflow Automation</TabsTrigger>
          </TabsList>

          <TabsContent value="partnerships" className="space-y-6">
            <BankPartnerCollaboration />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AdvancedAnalytics />
          </TabsContent>

          <TabsContent value="collaboration" className="space-y-6">
            <TeamCollaboration />
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <WorkflowAutomation />
          </TabsContent>
        </Tabs>
      </div>
    </StandardPageLayout>
  );
}
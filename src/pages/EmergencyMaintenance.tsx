import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmergencyShutdown } from '@/components/security/EmergencyShutdown';
import { EmergencyEventHistory } from '@/components/EmergencyEventHistory';
import { SystemMonitoring } from '@/components/SystemMonitoring';
import { useRoleBasedAccess } from '@/hooks/useRoleBasedAccess';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';

export default function EmergencyMaintenance() {
  const { canAccessAdminFeatures } = useRoleBasedAccess();
  const [activeTab, setActiveTab] = useState("shutdown");

  // Only admins can access this page
  if (!canAccessAdminFeatures) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Lock className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl text-destructive">Access Denied</CardTitle>
              <CardDescription className="text-lg">
                You do not have permission to access Emergency Maintenance controls
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  This page is restricted to security administrators only. 
                  Emergency shutdown controls require elevated privileges to prevent unauthorized system lockdowns.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <IBMPageHeader 
          title="Emergency Maintenance Control"
          subtitle="Monitor and manage emergency shutdown system for critical security incidents"
          actions={
            <Button size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white border-2 border-[#001f3f]">
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh Status
            </Button>
          }
        />

        {/* Content Area */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 gap-1">
              <TabsTrigger 
                value="shutdown" 
                className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Emergency Shutdown</span>
              </TabsTrigger>
              <TabsTrigger 
                value="monitoring" 
                className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>System Monitoring</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Event History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shutdown" className="space-y-6">
              <EmergencyShutdown />
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              <SystemMonitoring />
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <EmergencyEventHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
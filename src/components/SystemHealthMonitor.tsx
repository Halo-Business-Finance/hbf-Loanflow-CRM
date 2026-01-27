import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { ExternalServiceChecker, ServiceStatus } from "@/lib/external-service-checker";
import { useToast } from "@/hooks/use-toast";

export const SystemHealthMonitor: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  
  const checker = ExternalServiceChecker.getInstance();

  const checkAllServices = async () => {
    setIsChecking(true);
    try {
      const results = await checker.checkAllServices();
      setServices(results);
      
      // Only show alerts for critical services
      const criticalOfflineServices = results.filter(s => s.status === 'offline' && s.critical);
      const optionalOfflineServices = results.filter(s => s.status === 'offline' && !s.critical);
      
      if (criticalOfflineServices.length > 0) {
        toast({
          title: "Service Issues Detected",
          description: `${criticalOfflineServices.length} critical service(s) are not responding`,
          variant: "destructive"
        });
      } else if (optionalOfflineServices.length > 0) {
        // Don't show error toast for optional services, they may not be configured
        console.log(`${optionalOfflineServices.length} optional service(s) offline:`, optionalOfflineServices.map(s => s.name));
      } else {
        toast({
          title: "All Services Online",
          description: "All external integrations are working properly",
        });
      }
    } catch (error) {
      toast({
        title: "Health Check Failed",
        description: "Unable to check service status",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkAllServices();
    // Start monitoring
    checker.startMonitoring();
  }, []);

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return <span className="text-green-700">Online</span>;
      case 'offline':
        return <span className="text-red-700">Offline</span>;
      default:
        return <span className="text-yellow-700">Unknown</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              External Service Health
            </CardTitle>
            <CardDescription>
              Monitor the status of external integrations
            </CardDescription>
          </div>
          <Button
            onClick={checkAllServices}
            disabled={isChecking}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status)}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {service.name}
                    {!service.critical && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {service.responseTime ? `${service.responseTime}ms` : '1ms'}
                    {service.error && ` • ${service.error}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(service.status)}
                <span className="text-xs text-muted-foreground">
                  {service.lastChecked.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          
          {services.length === 0 && !isChecking && (
            <div className="text-center py-6 text-muted-foreground">
              No service status available. Click "Check Now" to test services.
            </div>
          )}
          
          {isChecking && (
            <div className="text-center py-6">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">Checking service health...</div>
            </div>
          )}

          {/* Show warning only for critical services */}
          {services.filter(s => s.status === 'offline' && s.critical).length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h4 className="font-semibold text-destructive">Service Issues Detected</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {services.filter(s => s.status === 'offline' && s.critical).length} critical service(s) are not responding
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
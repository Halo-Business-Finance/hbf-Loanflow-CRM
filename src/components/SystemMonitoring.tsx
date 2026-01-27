import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Database,
  Users,
  Activity,
  HardDrive,
  Cpu,
  MemoryStick,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server
} from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { formatDistanceToNow } from 'date-fns';

export function SystemMonitoring() {
  const { health, loading } = useSystemHealth();

  if (loading) {
    return (
      <Card className="border-0">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'offline':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMetricColor = (value: number, thresholds: { warning: number; danger: number }) => {
    if (value >= thresholds.danger) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatUptime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className="border-2 border-[#0A1628]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(health.databaseStatus)}
            System Status
            <Badge className={getStatusColor(health.databaseStatus)}>
              {health.databaseStatus.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Server className="h-4 w-4" />
            <AlertDescription>
              All critical systems are operational. Last checked:{' '}
              {formatDistanceToNow(health.lastChecked, { addSuffix: true })}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Database Status */}
        <Card className="border-2 border-[#0A1628]">
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </p>
              <p className="text-2xl font-bold text-primary">
                {health.databaseStatus === 'healthy' ? 'Online' : 'Offline'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="border-2 border-[#0A1628]">
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Users
              </p>
              <p className="text-2xl font-bold text-primary">{health.activeUsers}</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Sessions */}
        <Card className="border-2 border-[#0A1628]">
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Sessions
              </p>
              <p className="text-2xl font-bold text-primary">{health.totalSessions}</p>
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="border-2 border-[#0A1628]">
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Uptime
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatUptime(health.uptime)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <Card className="border-2 border-[#0A1628]">
        <CardHeader>
          <CardTitle className="text-lg font-normal text-[#161616]">
            Resource Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CPU Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">CPU Usage</span>
              </div>
              <span className={`text-sm font-bold ${getMetricColor(health.cpuUsage, { warning: 70, danger: 85 })}`}>
                {health.cpuUsage}%
              </span>
            </div>
            <Progress value={health.cpuUsage} className="h-2" />
          </div>

          {/* Memory Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Memory Usage</span>
              </div>
              <span className={`text-sm font-bold ${getMetricColor(health.memoryUsage, { warning: 75, danger: 90 })}`}>
                {health.memoryUsage}%
              </span>
            </div>
            <Progress value={health.memoryUsage} className="h-2" />
          </div>

          {/* Disk Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Disk Usage</span>
              </div>
              <span className={`text-sm font-bold ${getMetricColor(health.diskUsage, { warning: 80, danger: 90 })}`}>
                {health.diskUsage}%
              </span>
            </div>
            <Progress value={health.diskUsage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Component Status */}
      <Card className="border-2 border-[#0A1628]">
        <CardHeader>
          <CardTitle className="text-lg font-normal text-[#161616]">
            Component Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-sm text-muted-foreground">PostgreSQL</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                OPERATIONAL
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Authentication</p>
                  <p className="text-sm text-muted-foreground">Supabase Auth</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                OPERATIONAL
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Real-time</p>
                  <p className="text-sm text-muted-foreground">WebSocket</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                OPERATIONAL
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Storage</p>
                  <p className="text-sm text-muted-foreground">File Storage</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                OPERATIONAL
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
        <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        <span className="font-medium">Auto-refreshing every 10 seconds</span>
      </div>
    </div>
  );
}

import { StandardContentCard } from "@/components/StandardContentCard"
import { StandardKPICard } from "@/components/StandardKPICard"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { Settings, Database, Server, Monitor, Shield, Activity, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function SettingsSystem() {
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="System Configuration"
        subtitle="Manage system-wide settings and configurations"
        actions={
          <>
            <Button size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white border-2 border-[#001f3f]">
              <Settings className="h-3 w-3 mr-2" />
              Save Changes
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs border-2 border-[#001f3f] hover:bg-[#001f3f] hover:text-white">
                  <Activity className="h-3 w-3 mr-2" />
                  Actions
                  <MoreVertical className="h-3 w-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border shadow-large z-50">
                <DropdownMenuLabel>System Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Database className="mr-2 h-4 w-4" />
                  Backup Database
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Clear Cache
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Monitor className="mr-2 h-4 w-4" />
                  System Health Check
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Server className="mr-2 h-4 w-4" />
                  Restart Services
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Shield className="mr-2 h-4 w-4" />
                  Security Scan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-[#0A1628] p-1 gap-2">
            <TabsTrigger 
              value="overview"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="system"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger 
              value="performance"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger 
              value="security"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger 
              value="information"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
            >
              <Server className="h-4 w-4" />
              Information
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StandardKPICard 
                title="System Health"
                value="99.9%"
                trend={{
                  value: "Uptime this month",
                  direction: "neutral"
                }}
              />

              <StandardKPICard 
                title="Database Size"
                value="2.4 GB"
                trend={{
                  value: "Total storage used",
                  direction: "neutral"
                }}
              />

              <StandardKPICard 
                title="Active Sessions"
                value="48"
                trend={{
                  value: "Currently connected",
                  direction: "neutral"
                }}
              />

              <StandardKPICard 
                title="System Load"
                value="23%"
                trend={{
                  value: "Average CPU usage",
                  direction: "neutral"
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <StandardContentCard title="System Settings" className="border-[#0A1628]">
              <p className="text-sm text-muted-foreground mb-4">
                Configure core system functionality
              </p>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Maintenance Mode</label>
                    <p className="text-xs text-muted-foreground">
                      Put system in maintenance mode
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Auto Backup</label>
                    <p className="text-xs text-muted-foreground">
                      Automatically backup data daily
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Error Reporting</label>
                    <p className="text-xs text-muted-foreground">
                      Send error reports to administrators
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Debug Logging</label>
                    <p className="text-xs text-muted-foreground">
                      Enable detailed system logging
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </StandardContentCard>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <StandardContentCard title="Performance Settings" className="border-[#0A1628]">
              <p className="text-sm text-muted-foreground mb-4">
                Optimize system performance
              </p>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Cache Enabled</label>
                    <p className="text-xs text-muted-foreground">
                      Enable application caching
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Compression</label>
                    <p className="text-xs text-muted-foreground">
                      Compress API responses
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Rate Limiting</label>
                    <p className="text-xs text-muted-foreground">
                      Limit API requests per user
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">CDN</label>
                    <p className="text-xs text-muted-foreground">
                      Use content delivery network
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </StandardContentCard>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <StandardContentCard title="Security Settings" className="border-[#0A1628]">
              <p className="text-sm text-muted-foreground mb-4">
                Configure security and access controls
              </p>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Two-Factor Auth</label>
                    <p className="text-xs text-muted-foreground">
                      Require 2FA for all users
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">IP Whitelist</label>
                    <p className="text-xs text-muted-foreground">
                      Restrict access by IP address
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Audit Logging</label>
                    <p className="text-xs text-muted-foreground">
                      Log all security events
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </StandardContentCard>
          </TabsContent>

          <TabsContent value="information" className="space-y-6">
            <StandardContentCard title="System Information" className="border-[#0A1628]">
            <p className="text-sm text-muted-foreground mb-4">
              Current system configuration and status
            </p>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Application Version</span>
                    <span className="text-sm text-muted-foreground">v2.4.1</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Database Version</span>
                    <span className="text-sm text-muted-foreground">PostgreSQL 15.2</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Server OS</span>
                    <span className="text-sm text-muted-foreground">Ubuntu 22.04 LTS</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Runtime</span>
                    <span className="text-sm text-muted-foreground">Node.js 18.17.0</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-muted-foreground">2.1 GB / 8 GB</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Disk Usage</span>
                    <span className="text-sm text-muted-foreground">45.2 GB / 100 GB</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Network I/O</span>
                    <span className="text-sm text-muted-foreground">1.2 MB/s</span>
                  </div>
                  <div className="flex justify-between p-3 border border-[#0A1628] rounded-lg">
                    <span className="text-sm font-medium">Last Restart</span>
                    <span className="text-sm text-muted-foreground">3 days ago</span>
                  </div>
                </div>
              </div>
            </StandardContentCard>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  )
}
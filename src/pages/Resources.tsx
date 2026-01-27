import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { StandardContentCard } from "@/components/StandardContentCard";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { 
  BookOpen, 
  FileText, 
  Video, 
  Download,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Settings,
  Users,
  HelpCircle,
  Search
} from "lucide-react";

interface ResourceOverview {
  totalResources: number;
  documentationScore: number;
  supportTickets: number;
  knowledgeBaseArticles: number;
  videoTutorials: number;
  userGuides: number;
  complianceDocuments: number;
}

export default function Resources() {
  const [overview] = useState<ResourceOverview>({
    totalResources: 0,
    documentationScore: 0,
    supportTickets: 0,
    knowledgeBaseArticles: 0,
    videoTutorials: 0,
    userGuides: 0,
    complianceDocuments: 0
  });

  const documentationItems = [
    { name: "User Manual", type: "PDF", category: "Core", url: "https://docs.lovable.dev/", status: "Updated" },
    { name: "API Documentation", type: "Web", category: "Technical", url: "https://supabase.com/docs", status: "Current" },
    { name: "Best Practices Guide", type: "PDF", category: "Training", url: "https://docs.lovable.dev/tips-tricks/troubleshooting", status: "Updated" },
    { name: "Security Protocols", type: "PDF", category: "Compliance", url: "https://docs.lovable.dev/", status: "Critical" },
    { name: "Integration Handbook", type: "PDF", category: "Technical", url: "https://supabase.com/docs", status: "Updated" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return 'destructive';
      case 'Updated': return 'default';
      case 'Current': return 'secondary';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PDF': return Download;
      case 'Video': return Video;
      case 'Web': return ExternalLink;
      default: return FileText;
    }
  };

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Resources"
        subtitle="Access documentation, training materials, and support resources"
      />

      <ResponsiveContainer>
        <div className="space-y-6">
          {/* Resource Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StandardContentCard className="hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Total Resources</p>
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{overview.totalResources}</p>
              </div>
            </StandardContentCard>

            <StandardContentCard className="hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Documentation Score</p>
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold text-primary">{overview.documentationScore}%</p>
              </div>
            </StandardContentCard>

            <StandardContentCard className="hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Support Tickets</p>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold text-primary">{overview.supportTickets}</p>
              </div>
            </StandardContentCard>
          </div>

          {/* Alerts */}
          <div className="space-y-3">
            {overview.supportTickets > 0 && (
              <Alert className="border-l-4 border-l-secondary">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You have {overview.supportTickets} open support ticket(s) requiring attention.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Main Resource Dashboard Tabs */}
          <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col">
            <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <BookOpen className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="documentation" 
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <FileText className="h-4 w-4" />
                Documentation
              </TabsTrigger>
              <TabsTrigger
                value="support" 
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <HelpCircle className="h-4 w-4" />
                Support
              </TabsTrigger>
              <TabsTrigger 
                value="tools" 
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Settings className="h-4 w-4" />
                Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Quick Actions */}
                <StandardContentCard title="Quick Resource Actions">
                  <p className="text-sm text-muted-foreground mb-4">
                    Immediate access to essential resources
                  </p>
                  <div className="space-y-2">
                    <Button className="w-full justify-start" variant="ghost" onClick={() => window.open('https://docs.lovable.dev/', '_blank')}>
                      <Search className="w-4 h-4 mr-2" />
                      Search Knowledge Base
                    </Button>
                    <Button className="w-full justify-start" variant="ghost" onClick={() => window.open('https://www.youtube.com/playlist?list=PLbVHz4urQBZkJiAWdG8HWoJTdgEysigIO', '_blank')}>
                      <Video className="w-4 h-4 mr-2" />
                      Watch Video Tutorials
                    </Button>
                    <Button className="w-full justify-start" variant="ghost" onClick={() => window.open('https://docs.lovable.dev/user-guides/quickstart', '_blank')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download User Guides
                    </Button>
                    <Button className="w-full justify-start" variant="ghost" onClick={() => window.open('https://discord.com/channels/1119885301872070706/1280461670979993613', '_blank')}>
                      <Users className="w-4 h-4 mr-2" />
                      Community Support
                    </Button>
                  </div>
                </StandardContentCard>

                {/* Resource Health */}
                <StandardContentCard title="Resource System Health">
                  <p className="text-sm text-muted-foreground mb-4">
                    Real-time status of resource components
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Knowledge Base</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Online</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Video Platform</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Available</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Support Portal</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Operational</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Community Forum</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Download Center</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Accessible</span>
                      </div>
                    </div>
                  </div>
                </StandardContentCard>
              </div>

              {/* Recent Activity */}
              <StandardContentCard title="Recent Resource Activity">
                <p className="text-sm text-muted-foreground mb-4">
                  Latest updates and resource interactions
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">New documentation published</p>
                      <p className="text-xs text-muted-foreground truncate">API Integration Guide v2.1 • 2 hours ago</p>
                    </div>
                    <span className="text-sm font-medium">New</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors">
                    <Video className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Training module completed</p>
                      <p className="text-xs text-muted-foreground truncate">Advanced Security Features • 5 hours ago</p>
                    </div>
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors">
                    <Download className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Resource downloaded</p>
                      <p className="text-xs text-muted-foreground truncate">Compliance Checklist Template • 1 day ago</p>
                    </div>
                    <span className="text-sm font-medium">Downloaded</span>
                  </div>
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="documentation" className="mt-6">
              <StandardContentCard title="Documentation Library">
                <p className="text-sm text-muted-foreground mb-4">
                  Comprehensive documentation and reference materials
                </p>
                <div className="space-y-4">
                  {documentationItems.map((item, index) => {
                    const TypeIcon = getTypeIcon(item.type);
                    return (
                      <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                        <TypeIcon className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-sm font-medium">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.type} • {item.category}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => window.open(item.url, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="support" className="mt-6">
              <StandardContentCard title="Support & Help">
                <p className="text-sm text-muted-foreground mb-4">
                  Get assistance and connect with support resources
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Contact Support</h4>
                    <Button className="w-full justify-start" onClick={() => window.open('https://docs.lovable.dev/tips-tricks/troubleshooting', '_blank')}>
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Submit Support Ticket
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://discord.com/channels/1119885301872070706/1280461670979993613', '_blank')}>
                      <Users className="w-4 h-4 mr-2" />
                      Community Forum
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold">Self-Service</h4>
                    <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://docs.lovable.dev/', '_blank')}>
                      <Search className="w-4 h-4 mr-2" />
                      Search FAQ
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://docs.lovable.dev/tips-tricks/troubleshooting', '_blank')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Troubleshooting Guide
                    </Button>
                  </div>
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="tools" className="mt-6">
              <StandardContentCard title="Resource Management Tools">
                <p className="text-sm text-muted-foreground mb-4">
                  Advanced tools for managing and organizing resources
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-20 flex-col" onClick={() => window.open('https://docs.lovable.dev/', '_blank')}>
                    <Download className="w-6 h-6 mb-2" />
                    <span>Bulk Download</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col" onClick={() => window.open('https://docs.lovable.dev/', '_blank')}>
                    <Search className="w-6 h-6 mb-2" />
                    <span>Advanced Search</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col" onClick={() => window.open('https://docs.lovable.dev/', '_blank')}>
                    <Settings className="w-6 h-6 mb-2" />
                    <span>Preferences</span>
                  </Button>
                </div>
              </StandardContentCard>
            </TabsContent>
          </Tabs>
        </div>
      </ResponsiveContainer>
    </StandardPageLayout>
  );
}
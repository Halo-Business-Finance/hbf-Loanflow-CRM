import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { SmartDocumentCategorizer } from "@/components/automation/SmartDocumentCategorizer";
import { AutomatedReminders } from "@/components/automation/AutomatedReminders";
import { BulkLeadAssignment } from "@/components/automation/BulkLeadAssignment";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { AuditTrailExport } from "@/components/compliance/AuditTrailExport";
import { DocumentRetentionManager } from "@/components/compliance/DocumentRetentionManager";
import { Brain, Bell, Users, ClipboardCheck, Shield, Archive } from "lucide-react";

export default function Automation() {
  return (
    <div className="space-y-6">
      <IBMPageHeader
        title="Automation & Compliance"
        subtitle="Smart tools to streamline workflow and maintain regulatory compliance"
      />

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Document AI</span>
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Reminders</span>
          </TabsTrigger>
          <TabsTrigger value="assignment" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Bulk Assign</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="retention" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Retention</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <SmartDocumentCategorizer />
        </TabsContent>

        <TabsContent value="reminders">
          <AutomatedReminders />
        </TabsContent>

        <TabsContent value="assignment">
          <BulkLeadAssignment />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceChecklist />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrailExport />
        </TabsContent>

        <TabsContent value="retention">
          <DocumentRetentionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

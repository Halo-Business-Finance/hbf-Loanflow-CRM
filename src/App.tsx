import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AsyncErrorBoundary } from "@/components/AsyncErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess";

// Lazy load CSP headers - not critical for initial render
const CSPHeaders = lazy(() => import("@/components/security/CSPHeaders").then(m => ({ default: m.CSPHeaders })));

// Lazy load layout component (biggest bundle reduction - sidebar, topbar, etc.)
const IBMCloudLayout = lazy(() => import("@/components/layouts/IBMCloudLayout").then(m => ({ default: m.IBMCloudLayout })));

// Lazy load auth pages
const AuthPage = lazy(() => import("@/components/auth/AuthPage").then(m => ({ default: m.AuthPage })));
const CallbackHandler = lazy(() => import("@/components/auth/CallbackHandler").then(m => ({ default: m.CallbackHandler })));

// Lazy-loading wrapper for keyboard shortcuts
function KeyboardShortcutsProvider() {
  useEffect(() => {
    import("@/hooks/useKeyboardShortcuts").then(({ useKeyboardShortcuts }) => {
      // Hook is imported but we need to call it in a component context
      // This is a workaround - the hook will be loaded when needed
    });
  }, []);
  return null;
}

// Security hook provider - must be called directly, not lazy loaded
import { useEnhancedSecurity } from "@/hooks/useEnhancedSecurity";

function SecurityProvider() {
  useEnhancedSecurity();
  return null;
}

// Lazy load page components for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const NewLead = lazy(() => import("./pages/NewLead"));
const LeadStats = lazy(() => import("./pages/LeadStats"));
const LeadAssignment = lazy(() => import("./pages/LeadAssignment"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const LeadDocuments = lazy(() => import("./pages/LeadDocuments"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const PipelineAnalytics = lazy(() => import("./pages/PipelineAnalytics"));
const StageManagement = lazy(() => import("./pages/StageManagement"));
const Underwriter = lazy(() => import("./pages/Underwriter"));
const Clients = lazy(() => import("./pages/Clients"));
const BorrowerDetails = lazy(() => import("./pages/BorrowerDetails"));
const LoanHistory = lazy(() => import("./pages/LoanHistory"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Documents = lazy(() => import("./pages/Documents"));
const LoanDocumentsFolder = lazy(() => import("./pages/LoanDocumentsFolder"));
const Activities = lazy(() => import("./pages/Activities"));
const Reports = lazy(() => import("./pages/Reports"));
const Support = lazy(() => import("./pages/Support"));
const Settings = lazy(() => import("./pages/Settings"));
const UserDirectory = lazy(() => import("./pages/UserDirectory"));
const Resources = lazy(() => import("./pages/Resources"));
const Lenders = lazy(() => import('./pages/Lenders'));
const LenderAnalytics = lazy(() => import('./pages/LenderAnalytics'));
const LenderDetail = lazy(() => import('./pages/LenderDetail'));
const NewLender = lazy(() => import('./pages/NewLender'));
const NewLenderContact = lazy(() => import('./pages/NewLenderContact'));
const ServiceProviderDetail = lazy(() => import('./pages/ServiceProviderDetail'));
const ServiceProviders = lazy(() => import('./pages/ServiceProviders'));
const NewServiceProvider = lazy(() => import('./pages/NewServiceProvider'));
const Enterprise = lazy(() => import("./pages/Enterprise"));
const AdvancedAnalytics = lazy(() => import("./pages/AdvancedAnalytics"));
const Integrations = lazy(() => import("./pages/Integrations"));
const AITools = lazy(() => import("./pages/AITools"));


const Security = lazy(() => import("./pages/Security"));
const EmergencyMaintenance = lazy(() => import("./pages/EmergencyMaintenance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DocumentTemplates = lazy(() => import("./pages/DocumentTemplates"));
const ActivitiesCalendar = lazy(() => import("./pages/ActivitiesCalendar"));
const ActivitiesTasks = lazy(() => import("./pages/ActivitiesTasks"));
const SecurityAccess = lazy(() => import("./pages/SecurityAccess"));
const SecurityAudit = lazy(() => import("./pages/SecurityAudit"));
const SecurityThreats = lazy(() => import("./pages/SecurityThreats"));
const SecurityCompliance = lazy(() => import("./pages/SecurityCompliance"));
const SettingsSystem = lazy(() => import("./pages/SettingsSystem"));
const Messages = lazy(() => import("./pages/Messages"));
const LeadAccessDiagnostics = lazy(() => import("./pages/LeadAccessDiagnostics"));
const RoleDiagnostics = lazy(() => import("./pages/RoleDiagnostics"));
const Automation = lazy(() => import("./pages/Automation"));
const AdvancedReports = lazy(() => import("./pages/AdvancedReports"));
const ReportBuilder = lazy(() => import("./pages/ReportBuilder"));
const SLAManagement = lazy(() => import("./pages/SLAManagement"));
const AILeadScoring = lazy(() => import("./pages/AILeadScoring"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const IntegrationHub = lazy(() => import("./pages/IntegrationHub"));
const MultiEntityManagement = lazy(() => import("./pages/MultiEntityManagement"));
const ComplianceDashboard = lazy(() => import("./pages/ComplianceDashboard"));

// Lazy load dashboard components for code splitting (with named export handling)
const LoanCloserDashboard = lazy(() => import("@/components/dashboards/LoanCloserDashboard").then(m => ({ default: m.LoanCloserDashboard })));
const LoanProcessorDashboard = lazy(() => import("@/components/dashboards/LoanProcessorDashboard").then(m => ({ default: m.LoanProcessorDashboard })));
const UnderwriterDashboard = lazy(() => import("@/components/dashboards/UnderwriterDashboard").then(m => ({ default: m.UnderwriterDashboard })));
const LoanOriginatorDashboard = lazy(() => import("@/components/dashboards/LoanOriginatorDashboard").then(m => ({ default: m.LoanOriginatorDashboard })));
const DataIntegrityDashboard = lazy(() => import("@/components/DataIntegrityDashboard").then(m => ({ default: m.DataIntegrityDashboard })));

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const {
    hasMinimumRole,
    canProcessLoans,
    canFundLoans,
    canUnderwriteLoans,
    canCloseLoans,
    canAccessAdminFeatures
  } = useRoleBasedAccess();
  
  // Only block UI while determining auth state for unauthenticated users
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
 
  // If no user after auth check, only allow auth routes
  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        }>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<CallbackHandler />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // User is authenticated - show full app
  return (
    <BrowserRouter>
      <KeyboardShortcutsProvider />
      <SecurityProvider />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }>
        <Routes>
        {/* Public routes - always accessible */}
        <Route path="/auth" element={<AuthPage />} errorElement={<RouteErrorBoundary />} />
        <Route path="/auth/callback" element={<CallbackHandler />} errorElement={<RouteErrorBoundary />} />
        
        {/* Protected routes - require authentication */}
        <Route path="/" element={<Navigate to="/loan-originator" replace />} errorElement={<RouteErrorBoundary />} />
        <Route path="/loan-originator" element={<IBMCloudLayout key="dashboard-layout"><LoanOriginatorDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/dashboard" element={<IBMCloudLayout><Dashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/leads" element={<IBMCloudLayout><Leads /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/new" element={<IBMCloudLayout><NewLead /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/stats" element={<IBMCloudLayout><LeadStats /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/assignment" element={<IBMCloudLayout><LeadAssignment /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/recently-assigned" element={<IBMCloudLayout><LeadAssignment /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/:id" element={<IBMCloudLayout><LeadDetail /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/leads/:leadId/documents" element={<IBMCloudLayout><LeadDocuments /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/existing-borrowers" element={<IBMCloudLayout><Clients /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/existing-borrowers/details" element={<IBMCloudLayout><BorrowerDetails /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/existing-borrowers/history" element={<IBMCloudLayout><LoanHistory /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/existing-borrowers/:id" element={<IBMCloudLayout><ClientDetail /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/pipeline" element={<IBMCloudLayout><Pipeline /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/pipeline/analytics" element={<IBMCloudLayout><PipelineAnalytics /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/pipeline/stages" element={<IBMCloudLayout><StageManagement /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        {/* Documents routes */}
        <Route path="/documents" element={<IBMCloudLayout><Documents /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/documents/loan/:leadId" element={<IBMCloudLayout><LoanDocumentsFolder /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/documents/templates" element={<IBMCloudLayout><DocumentTemplates /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/activities" element={<IBMCloudLayout><Activities /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/activities/calendar" element={<IBMCloudLayout><ActivitiesCalendar /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/activities/tasks" element={<IBMCloudLayout><ActivitiesTasks /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/messages" element={<IBMCloudLayout><Messages /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/reports" element={<IBMCloudLayout><Reports /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/advanced-reports" element={<IBMCloudLayout><AdvancedReports /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/report-builder" element={<IBMCloudLayout><ReportBuilder /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/report-builder/:id" element={<IBMCloudLayout><ReportBuilder /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/support" element={<IBMCloudLayout><Support /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/user-directory" element={<IBMCloudLayout><UserDirectory /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        {/* Lenders routes */}
        <Route path="/lenders" element={<IBMCloudLayout><Lenders /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/lenders/analytics" element={<IBMCloudLayout><LenderAnalytics /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/lenders/new" element={<IBMCloudLayout><NewLender /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/lenders/:id" element={<IBMCloudLayout><LenderDetail /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/lenders/:id/contacts/new" element={<IBMCloudLayout><NewLenderContact /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        {/* Service Providers routes (Title & Escrow) */}
        <Route path="/service-providers" element={<IBMCloudLayout><ServiceProviders /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/service-providers/new" element={<IBMCloudLayout><NewServiceProvider /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/service-providers/:id" element={<IBMCloudLayout><ServiceProviderDetail /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/settings" element={<IBMCloudLayout key="settings-layout"><Settings /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/settings/system" element={<IBMCloudLayout><SettingsSystem /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        <Route path="/security" element={<IBMCloudLayout><Security /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/access" element={<IBMCloudLayout><SecurityAccess /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/audit" element={<IBMCloudLayout><SecurityAudit /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/threats" element={<IBMCloudLayout><SecurityThreats /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/compliance" element={<IBMCloudLayout><SecurityCompliance /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/lead-diagnostics" element={<IBMCloudLayout><LeadAccessDiagnostics /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/security/role-diagnostics" element={<IBMCloudLayout><RoleDiagnostics /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />

        {/* Role-based Dashboard Routes */}
        {canCloseLoans && <Route path="/dashboards/closer" element={<IBMCloudLayout><LoanCloserDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />}
        {canProcessLoans && <Route path="/dashboards/processor" element={<IBMCloudLayout><LoanProcessorDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />}
        {canUnderwriteLoans && <Route path="/dashboards/underwriter" element={<IBMCloudLayout><UnderwriterDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />}
        
        {/* Enterprise Dashboard Routes */}
        {canAccessAdminFeatures && <Route path="/dashboards/data-integrity" element={<IBMCloudLayout><DataIntegrityDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />}
        
        <Route path="/enterprise" element={<IBMCloudLayout><Enterprise /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/automation" element={<IBMCloudLayout><Automation /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/sla-management" element={<IBMCloudLayout><SLAManagement /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/ai-lead-scoring" element={<IBMCloudLayout><AILeadScoring /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/executive-dashboard" element={<IBMCloudLayout><ExecutiveDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/partner-portal" element={<IBMCloudLayout><PartnerPortal /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/integration-hub" element={<IBMCloudLayout><IntegrationHub /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/multi-entity" element={<IBMCloudLayout><MultiEntityManagement /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/compliance-dashboard" element={<IBMCloudLayout><ComplianceDashboard /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/analytics/advanced" element={<IBMCloudLayout><AdvancedAnalytics /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/integrations" element={<IBMCloudLayout><Integrations /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/ai-tools" element={<IBMCloudLayout><AITools /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        
        
        <Route path="/resources" element={<IBMCloudLayout><Resources /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="/emergency-maintenance" element={<IBMCloudLayout><EmergencyMaintenance /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        <Route path="*" element={<IBMCloudLayout><NotFound /></IBMCloudLayout>} errorElement={<RouteErrorBoundary />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const App = () => {
  // Removed console.log for production security
  
  return (
    <AsyncErrorBoundary onError={(error) => {
      import('@/lib/production-logger').then(({ logger }) => {
        logger.error('AsyncErrorBoundary caught error', error);
      })
    }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="loanflow-theme-v2">
          <Suspense fallback={null}>
            <CSPHeaders />
          </Suspense>
          {/* Security enhancement providers temporarily disabled */}
          <AuthProvider>
            {/* Temporarily disabled security enhancement providers to prevent auto-refresh */}
            {/* <SecurityEnhancementProvider>
              <EnhancedSecurityProvider> */}
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <AuthenticatedApp />
                </TooltipProvider>
            {/* </EnhancedSecurityProvider>
            </SecurityEnhancementProvider> */}
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AsyncErrorBoundary>
  );
};

export default App;

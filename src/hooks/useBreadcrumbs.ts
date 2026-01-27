import { useLocation, useParams } from 'react-router-dom';
import { useMemo } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Route mapping for human-readable labels
const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  'loan-originator': 'Dashboard',
  'dashboard': 'Dashboard',
  'dashboards': '', // Skip this segment to avoid duplication
  'processor': 'Loan Processor',
  'closer': 'Loan Closer',
  'leads': 'Leads',
  'new-lead': 'New Lead',
  'lead-assignment': 'Lead Assignment',
  'lead-stats': 'Lead Statistics',
  'pipeline': 'Pipeline',
  'pipeline-analytics': 'Pipeline Analytics',
  'clients': 'Clients',
  'activities': 'Activities',
  'activities-calendar': 'Calendar',
  'activities-tasks': 'Tasks',
  'messages': 'Messages',
  'documents': 'Documents',
  'document-templates': 'Document Templates',
  'reports': 'Reports',
  'enterprise': 'Enterprise',
  'enterprise-management': 'Enterprise Management',
  'collaborative-crm': 'Collaborative CRM',
  'ai-tools': 'AI Tools',
  'underwriter': 'Underwriter',
  'underwriter-documents': 'Documents',
  'underwriter-risk': 'Risk Assessment',
  'security': 'Security',
  'security-access': 'Access Control',
  'security-audit': 'Security Audit',
  'security-compliance': 'Compliance',
  'security-threats': 'Threat Detection',
  'settings': 'Settings',
  'settings-users': 'User Management',
  'settings-system': 'System Settings',
  'integrations': 'Integrations',
  'support': 'Support',
  'resources': 'Resources',
  'api-docs': 'API Documentation',
  'user-directory': 'User Directory',
  'users-leads': 'User Leads',
  'stage-management': 'Stage Management',
  'loan-history': 'Loan History',
  'emergency-maintenance': 'Emergency Maintenance',
  'lead-access-diagnostics': 'Lead Access Diagnostics',
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const params = useParams();

  return useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    // Always start with Dashboard
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' }
    ];

    // If we're on the home page or '/loan-originator', just return Dashboard
    if (pathSegments.length === 0 || (pathSegments.length === 1 && (pathSegments[0] === 'loan-originator' || pathSegments[0] === 'dashboard' || routeLabels[pathSegments[0]] === 'Dashboard'))) {
      return [{ label: 'Dashboard' }];
    }

    // Build breadcrumbs from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Check if this segment is a dynamic parameter (UUID pattern)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
      
      if (isUuid) {
        // For UUIDs, try to use a more friendly label
        const previousSegment = pathSegments[index - 1];
        if (previousSegment === 'leads') {
          breadcrumbs.push({ label: 'Lead Details' });
        } else if (previousSegment === 'clients') {
          breadcrumbs.push({ label: 'Client Details' });
        } else if (previousSegment === 'borrowers') {
          breadcrumbs.push({ label: 'Borrower Details' });
        } else {
          breadcrumbs.push({ label: 'Details' });
        }
      } else {
        // Use the route label mapping or format the segment
        const label = routeLabels[segment] || formatSegment(segment);
        
        // Skip empty labels (used for segments we want to hide)
        if (!label) {
          return;
        }
        
        // Avoid duplicate 'Dashboard' crumb when first segment resolves to Dashboard
        if (index === 0 && label === 'Dashboard') {
          return;
        }
        
        // Don't add href for the last item (current page)
        if (index === pathSegments.length - 1) {
          breadcrumbs.push({ label });
        } else {
          breadcrumbs.push({ label, href: currentPath });
        }
      }
    });

    // De-duplicate if the last crumb equals the first (e.g., "Dashboard > Dashboard")
    if (breadcrumbs.length > 1) {
      const first = breadcrumbs[0].label.trim().toLowerCase();
      const last = breadcrumbs[breadcrumbs.length - 1].label.trim().toLowerCase();
      if (first === last) {
        breadcrumbs.pop();
      }
    }

    return breadcrumbs;
  }, [location.pathname]);
}

function formatSegment(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

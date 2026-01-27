import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { secureStorage } from '@/lib/secure-storage';
export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  component: string;
  defaultRoles: string[];
  category: 'metrics' | 'activity' | 'tools' | 'communication';
  size: 'small' | 'medium' | 'large';
  icon: string;
}

export const AVAILABLE_WIDGETS: WidgetConfig[] = [
  {
    id: 'messages',
    name: 'Messages',
    description: 'Recent messages and communications',
    component: 'CompactMessagesWidget',
    defaultRoles: ['loan_originator', 'loan_processor', 'closer', 'funder', 'underwriter', 'manager', 'admin'],
    category: 'communication',
    size: 'medium',
    icon: 'MessageSquare'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Upcoming events and appointments',
    component: 'CompactCalendarWidget',
    defaultRoles: ['loan_originator', 'loan_processor', 'closer', 'funder', 'underwriter', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'Calendar'
  },
  {
    id: 'schedule',
    name: "Today's Schedule",
    description: 'Tasks and appointments for today',
    component: 'TodaysScheduleWidget',
    defaultRoles: ['loan_originator', 'loan_processor', 'closer', 'funder', 'underwriter', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'Clock'
  },
  {
    id: 'lead_scoring',
    name: 'AI Lead Scoring',
    description: 'AI-powered lead analysis and scoring',
    component: 'LeadScoring',
    defaultRoles: ['loan_originator', 'manager', 'admin'],
    category: 'tools',
    size: 'large',
    icon: 'Brain'
  },
  {
    id: 'quote_generator',
    name: 'Quote Generator',
    description: 'Generate loan quotes for clients',
    component: 'QuoteGenerator',
    defaultRoles: ['loan_originator', 'manager', 'admin'],
    category: 'tools',
    size: 'large',
    icon: 'FileText'
  },
  {
    id: 'commission_calculator',
    name: 'Commission Calculator',
    description: 'Track and calculate commissions',
    component: 'CommissionCalculator',
    defaultRoles: ['loan_originator', 'manager', 'admin'],
    category: 'metrics',
    size: 'large',
    icon: 'DollarSign'
  },
  {
    id: 'document_checklist',
    name: 'Document Checklist',
    description: 'Track required documents',
    component: 'DocumentChecklistWidget',
    defaultRoles: ['loan_processor', 'underwriter', 'closer', 'manager', 'admin'],
    category: 'tools',
    size: 'medium',
    icon: 'FileCheck'
  },
  {
    id: 'sla_tracker',
    name: 'SLA Timeline',
    description: 'Service level agreement tracking',
    component: 'SLATimelineTracker',
    defaultRoles: ['loan_processor', 'manager', 'admin'],
    category: 'metrics',
    size: 'medium',
    icon: 'Timer'
  },
  {
    id: 'risk_assessment',
    name: 'Risk Assessment',
    description: 'Loan risk analysis dashboard',
    component: 'RiskAssessmentWidget',
    defaultRoles: ['underwriter', 'manager', 'admin'],
    category: 'tools',
    size: 'large',
    icon: 'Shield'
  },
  {
    id: 'closing_calendar',
    name: 'Closing Calendar',
    description: 'Upcoming loan closings',
    component: 'ClosingCalendarWidget',
    defaultRoles: ['closer', 'funder', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'CalendarCheck'
  },
  {
    id: 'funding_queue',
    name: 'Funding Queue',
    description: 'Loans ready for funding',
    component: 'FundingQueueWidget',
    defaultRoles: ['funder', 'closer', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'Wallet'
  },
  {
    id: 'approval_queue',
    name: 'Approval Queue',
    description: 'Pending approvals',
    component: 'ApprovalQueueWidget',
    defaultRoles: ['underwriter', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'CheckCircle'
  },
  {
    id: 'task_timeline',
    name: 'Task Timeline',
    description: 'Task progress and deadlines',
    component: 'TaskTimelineWidget',
    defaultRoles: ['loan_processor', 'closer', 'manager', 'admin'],
    category: 'activity',
    size: 'medium',
    icon: 'ListTodo'
  }
];

const STORAGE_KEY = 'dashboard_widget_preferences';

interface WidgetPreferences {
  enabledWidgets: string[];
  widgetOrder: string[];
  lastUpdated: string;
}

export function useDashboardWidgets() {
  const { hasRole } = useAuth();
  const [preferences, setPreferences] = useState<WidgetPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get user's primary role for default widgets
  const getUserRole = useCallback((): string => {
    const roles = ['super_admin', 'admin', 'manager', 'underwriter', 'closer', 'funder', 'loan_processor', 'loan_originator'];
    for (const role of roles) {
      if (hasRole(role)) return role;
    }
    return 'loan_originator';
  }, [hasRole]);

  // Get default widgets for role
  const getDefaultWidgetsForRole = useCallback((role: string): string[] => {
    return AVAILABLE_WIDGETS
      .filter(widget => widget.defaultRoles.includes(role))
      .map(widget => widget.id);
  }, []);

  // Load preferences from secure storage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Use secure encrypted storage instead of plain localStorage
        const stored = await secureStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as WidgetPreferences;
          setPreferences(parsed);
        } else {
          // Set defaults based on role
          const role = getUserRole();
          const defaultWidgets = getDefaultWidgetsForRole(role);
          setPreferences({
            enabledWidgets: defaultWidgets,
            widgetOrder: defaultWidgets,
            lastUpdated: new Date().toISOString()
          });
        }
      } catch {
        const role = getUserRole();
        const defaultWidgets = getDefaultWidgetsForRole(role);
        setPreferences({
          enabledWidgets: defaultWidgets,
          widgetOrder: defaultWidgets,
          lastUpdated: new Date().toISOString()
        });
      }
      setIsLoading(false);
    };

    loadPreferences();
  }, [getUserRole, getDefaultWidgetsForRole]);

  // Save preferences to secure storage
  const savePreferences = useCallback(async (newPrefs: WidgetPreferences) => {
    try {
      await secureStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    } catch {
      // Fallback silently - preferences will be reset on next load
    }
    setPreferences(newPrefs);
  }, []);

  // Toggle widget
  const toggleWidget = useCallback((widgetId: string) => {
    if (!preferences) return;

    const isEnabled = preferences.enabledWidgets.includes(widgetId);
    const newEnabled = isEnabled
      ? preferences.enabledWidgets.filter(id => id !== widgetId)
      : [...preferences.enabledWidgets, widgetId];

    const newOrder = isEnabled
      ? preferences.widgetOrder.filter(id => id !== widgetId)
      : [...preferences.widgetOrder, widgetId];

    savePreferences({
      enabledWidgets: newEnabled,
      widgetOrder: newOrder,
      lastUpdated: new Date().toISOString()
    });
  }, [preferences, savePreferences]);

  // Reorder widgets
  const reorderWidgets = useCallback((newOrder: string[]) => {
    if (!preferences) return;

    savePreferences({
      ...preferences,
      widgetOrder: newOrder,
      lastUpdated: new Date().toISOString()
    });
  }, [preferences, savePreferences]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const role = getUserRole();
    const defaultWidgets = getDefaultWidgetsForRole(role);
    savePreferences({
      enabledWidgets: defaultWidgets,
      widgetOrder: defaultWidgets,
      lastUpdated: new Date().toISOString()
    });
  }, [getUserRole, getDefaultWidgetsForRole, savePreferences]);

  // Get enabled widgets in order
  const enabledWidgets = preferences?.widgetOrder
    .filter(id => preferences.enabledWidgets.includes(id))
    .map(id => AVAILABLE_WIDGETS.find(w => w.id === id))
    .filter(Boolean) as WidgetConfig[] || [];

  // Get available widgets for the user's role
  const availableWidgets = AVAILABLE_WIDGETS.filter(widget => {
    const role = getUserRole();
    return widget.defaultRoles.includes(role) || 
           widget.defaultRoles.includes('admin') ||
           hasRole('admin') || 
           hasRole('super_admin');
  });

  return {
    enabledWidgets,
    availableWidgets,
    preferences,
    isLoading,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    isWidgetEnabled: (id: string) => preferences?.enabledWidgets.includes(id) ?? false
  };
}

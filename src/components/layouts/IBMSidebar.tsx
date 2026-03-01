import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Shield,
  Database,
  Briefcase,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Building2,
  UserCog,
  CheckSquare,
  Link2,
  Sparkles,
  BookOpen,
  Layers,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Mail,
  Megaphone,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Menu,
  Workflow,
  Castle,
  Target,
  MessageSquare,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IBMSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemData {
  icon: LucideIcon;
  label: string;
  to?: string;
  subItems?: NavItemData[];
}

interface NavItemProps extends NavItemData {
  collapsed: boolean;
}

const navItems: NavItemData[] = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    to: '/loan-originator',
    subItems: [
      { icon: LayoutDashboard, label: 'Loan Originator Dashboard', to: '/loan-originator' },
      { icon: FileSpreadsheet, label: 'Loan Processor Dashboard', to: '/dashboards/processor' },
      { icon: CheckSquare, label: 'Loan Underwriter Dashboard', to: '/dashboards/underwriter' },
      { icon: HandCoins, label: 'Loan Closer Dashboard', to: '/dashboards/closer' },
    ]
  },
  { 
    icon: Users, 
    label: 'Leads', 
    to: '/leads',
    subItems: [
      { icon: Users, label: 'All Leads', to: '/leads' },
      { icon: Users, label: 'Create New Lead', to: '/leads/new' },
      { icon: UserCog, label: 'Lead Assignment', to: '/leads/assignment' },
    ]
  },
  { 
    icon: Activity, 
    label: 'Activities', 
    to: '/activities',
    subItems: [
      { icon: Activity, label: 'All Activities', to: '/activities' },
      { icon: Activity, label: 'Calendar', to: '/activities/calendar' },
      { icon: Activity, label: 'Tasks', to: '/activities/tasks' },
    ]
  },
  { icon: Mail, label: 'Messages', to: '/messages' },
  { 
    icon: Workflow, 
    label: 'Loan Pipeline', 
    to: '/pipeline',
    subItems: [
      { icon: Workflow, label: 'Pipeline Management', to: '/pipeline' },
      { icon: TrendingUp, label: 'Pipeline Analytics', to: '/pipeline/analytics' },
    ]
  },
  { 
    icon: Briefcase, 
    label: 'Existing Borrowers', 
    to: '/existing-borrowers',
    subItems: [
      { icon: Briefcase, label: 'All Borrowers', to: '/existing-borrowers' },
      { icon: Briefcase, label: 'Borrower Details', to: '/existing-borrowers/details' },
      { icon: Briefcase, label: 'Loan History', to: '/existing-borrowers/history' },
    ]
  },
  { 
    icon: FileText,
    label: 'Loan Documents',
    to: '/documents',
    subItems: [
      { icon: FileText, label: 'All Loan Documents', to: '/documents' },
      { icon: FileText, label: 'Document Templates', to: '/documents/templates' },
    ]
  },
  { icon: UserCog, label: 'User Directory', to: '/user-directory' },
  { icon: Landmark, label: 'Banks & Lenders', to: '/lenders' },
  { icon: Castle, label: 'Title & Escrow', to: '/service-providers' },
  {
    icon: Megaphone,
    label: 'Marketing Hub',
    to: '/marketing',
    subItems: [
      { icon: Megaphone, label: 'Marketing Analytics', to: '/marketing' },
      { icon: Mail, label: 'Email Campaigns', to: '/marketing/campaigns' },
      { icon: FileText, label: 'Email Templates', to: '/marketing/email-templates' },
      { icon: Workflow, label: 'Drip Automations', to: '/marketing/automations' },
      { icon: MessageSquare, label: 'SMS Marketing', to: '/marketing/sms' },
      { icon: FileText, label: 'SMS Templates', to: '/marketing/sms-templates' },
      { icon: Target, label: 'Lead Capture', to: '/marketing/lead-capture' },
      { icon: TrendingUp, label: 'Conversion Funnel', to: '/marketing/funnel' },
    ]
  },
  {
    icon: Building2, 
    label: 'Enterprise', 
    to: '/enterprise',
    subItems: [
      { icon: BarChart3, label: 'Reports', to: '/reports' },
      { icon: Building2, label: 'Enterprise Command Center', to: '/enterprise' },
      { icon: TrendingUp, label: 'Advanced Analytics', to: '/analytics/advanced' },
      { icon: Link2, label: 'Integrations', to: '/integrations' },
      { icon: Sparkles, label: 'AI Tools', to: '/ai-tools' },
      { icon: BookOpen, label: 'Resources', to: '/resources' },
      { icon: Layers, label: 'Stage Management', to: '/pipeline/stages' },
      { icon: CheckSquare, label: 'Compliance', to: '/compliance-dashboard' },
    ]
  },
  { 
    icon: Shield, 
    label: 'Security', 
    to: '/security',
    subItems: [
      { icon: Shield, label: 'Security Overview', to: '/security' },
      { icon: UserCog, label: 'Access Management', to: '/security/access' },
      { icon: FileText, label: 'Audit Logs', to: '/security/audit' },
      { icon: AlertTriangle, label: 'Threat Detection', to: '/security/threats' },
      { icon: CheckSquare, label: 'Compliance', to: '/security/compliance' },
      { icon: Database, label: 'System Configuration', to: '/settings/system' },
      { icon: FileCheck, label: 'Data Integrity', to: '/dashboards/data-integrity' },
      { icon: AlertTriangle, label: 'Emergency Maintenance', to: '/emergency-maintenance' },
      { icon: CheckSquare, label: 'Role Diagnostics', to: '/security/role-diagnostics' },
    ]
  },
];

function NavItem({ icon: Icon, label, to, collapsed, subItems }: NavItemProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const isActive = to ? (location.pathname === to || location.pathname.startsWith(to + '/')) : false;
  const hasActiveSubItem = subItems?.some(item => 
    item.to && (location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
  );

  React.useEffect(() => {
    if (hasActiveSubItem && !collapsed) {
      setIsOpen(true);
    }
  }, [hasActiveSubItem, collapsed]);

  const handleClick = (e: React.MouseEvent) => {
    if (subItems && subItems.length > 0 && !collapsed) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(!isOpen);
    }
  };

  const isHighlighted = isActive || hasActiveSubItem;
  const hasChildren = subItems && subItems.length > 0;
  const FolderIconEl = isOpen && hasChildren ? FolderOpen : Folder;

  // Collapsed with sub-items
  if (hasChildren && collapsed && to) {
    return (
      <NavLink
        to={to}
        className={cn(
          'flex items-center h-10 text-xs transition-all duration-200 relative group',
          'justify-center w-full px-0 rounded-sm',
          isHighlighted
            ? 'bg-primary/10 text-primary dark:text-primary'
            : 'text-muted-foreground dark:text-gray-400 hover:bg-primary/5 hover:text-foreground dark:hover:text-white'
        )}
      >
        <div className="w-12 flex items-center justify-center">
          <FolderIconEl className={cn('h-4 w-4 flex-shrink-0', isHighlighted ? 'text-primary' : 'text-amber-500 dark:text-amber-400')} />
        </div>
      </NavLink>
    );
  }

  // Expanded parent with sub-items
  if (hasChildren) {
    return (
      <div className="mb-0.5">
        <div
          onClick={handleClick}
          className={cn(
            'flex items-center h-10 text-xs transition-all duration-200 relative group cursor-pointer',
            collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-3',
            'rounded-sm',
            isHighlighted
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground dark:text-gray-400 hover:bg-primary/5 hover:text-foreground dark:hover:text-white'
          )}
        >
          <div className="w-8 flex items-center justify-center mr-1">
            <FolderIconEl className={cn('h-4 w-4 flex-shrink-0', isHighlighted ? 'text-primary' : 'text-amber-500 dark:text-amber-400')} />
          </div>
          {!collapsed && (
            <>
              <span className="truncate flex-1 font-medium">{label}</span>
              <ChevronRight className={cn(
                'h-3 w-3 ml-auto transition-transform duration-200',
                isOpen && 'rotate-90'
              )} />
            </>
          )}
        </div>
        {!collapsed && isOpen && (
          <div className="ml-5 pl-3 border-l border-primary/20 dark:border-primary/30 py-0.5">
            {subItems.map((subItem) => {
              const subActive = location.pathname === subItem.to || location.pathname.startsWith(subItem.to! + '/');
              return (
                <NavLink
                  key={subItem.to}
                  to={subItem.to!}
                  className={cn(
                    'group/sub flex items-center h-7 text-[11px] transition-all duration-200 relative pl-2 rounded-sm mr-1',
                    subActive
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white hover:bg-primary/5'
                  )}
                >
                  <FileText className={cn('h-3 w-3 mr-2 flex-shrink-0', subActive ? 'text-primary' : 'text-muted-foreground/60')} />
                  <span className="truncate text-xs">{subItem.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Single item (no children) - show as a file
  return (
    <NavLink
      to={to!}
      className={cn(
        'flex items-center h-10 text-xs transition-all duration-200 relative group',
        collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-3',
        'rounded-sm',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground dark:text-gray-400 hover:bg-primary/5 hover:text-foreground dark:hover:text-white'
      )}
    >
      <div className={cn(collapsed ? 'w-12' : 'w-8', 'flex items-center justify-center', !collapsed && 'mr-1')}>
        <FileText className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-foreground dark:text-white')} />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function IBMSidebar({ collapsed, onToggle }: IBMSidebarProps) {
  return (
    <aside
      className={cn(
        'bg-white dark:bg-[#0a1628] border-r border-border dark:border-[#1a2942] flex-shrink-0 transition-all duration-300 overflow-y-auto no-scrollbar',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="pt-2 pb-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            'group flex items-center h-10 text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white transition-colors rounded',
            collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-4'
          )}
        >
          <div className="w-12 flex items-center justify-center">
            <span className="inline-flex p-0.5 rounded border border-transparent group-hover:border-blue-500 transition-colors duration-200">
              <Menu className="h-5 w-5 text-foreground dark:text-white" />
            </span>
          </div>
        </button>
      </div>
      <nav className="space-y-0 pt-1">
        {navItems.map((item) => (
          <NavItem key={item.to || item.label} {...item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}

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
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Menu,
  Workflow,
  Castle,
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

  // Auto-expand if a sub-item is active
  React.useEffect(() => {
    if (hasActiveSubItem && !collapsed) {
      setIsOpen(true);
    }
  }, [hasActiveSubItem, collapsed]);

  const handleClick = (e: React.MouseEvent) => {
    // Only toggle submenu when expanded and has sub-items
    if (subItems && subItems.length > 0 && !collapsed) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(!isOpen);
    }
  };

  if (subItems && subItems.length > 0) {
    // When collapsed, use NavLink to navigate; when expanded, use div to toggle
    if (collapsed && to) {
      return (
        <NavLink
          to={to}
          className={cn(
            'flex items-center h-10 text-xs transition-all duration-300 relative group rounded',
            'justify-center w-full px-0',
            (isActive || hasActiveSubItem)
              ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] text-white font-medium'
              : 'text-gray-400 hover:outline hover:outline-2 hover:outline-blue-500 hover:outline-offset-[-2px] hover:text-white'
          )}
        >
          <div className="w-12 flex items-center justify-center">
            <Icon className="h-4 w-4 flex-shrink-0 text-white" />
          </div>
        </NavLink>
      );
    }
    
    return (
      <div>
        <div
          onClick={handleClick}
          className={cn(
            'flex items-center h-10 text-xs transition-all duration-300 relative group cursor-pointer rounded',
            collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-4',
            (isActive || hasActiveSubItem)
              ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] text-white font-medium'
              : 'text-gray-400 hover:outline hover:outline-2 hover:outline-blue-500 hover:outline-offset-[-2px] hover:text-white'
          )}
        >
          {(isActive || hasActiveSubItem) && !collapsed && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
          )}
          <div className="w-12 flex items-center justify-center">
            <Icon className="h-4 w-4 flex-shrink-0 text-white" />
          </div>
          {!collapsed && (
            <>
              <span className="truncate flex-1">{label}</span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </>
          )}
        </div>
        {!collapsed && isOpen && (
          <div className="ml-4 border-l border-[#1a2942] pb-4">
            {subItems.map((subItem) => (
              <NavLink
                key={subItem.to}
                to={subItem.to!}
                className={cn(
                  'flex items-center h-8 text-xs transition-all duration-300 relative pl-4 rounded mr-1',
                  location.pathname === subItem.to || location.pathname.startsWith(subItem.to! + '/')
                    ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] text-white font-medium'
                    : 'text-gray-400 hover:outline hover:outline-2 hover:outline-blue-500 hover:outline-offset-[-2px] hover:text-white'
                )}
              >
                <span className="truncate text-xs">{subItem.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to!}
      className={cn(
        'flex items-center h-10 text-xs transition-all duration-300 relative group rounded',
        collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-4',
        isActive
          ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] text-white font-medium'
          : 'text-gray-400 hover:outline hover:outline-2 hover:outline-blue-500 hover:outline-offset-[-2px] hover:text-white'
      )}
    >
      {isActive && !collapsed && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
      )}
      <div className="w-12 flex items-center justify-center">
        <Icon className="h-4 w-4 flex-shrink-0 text-white" />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function IBMSidebar({ collapsed, onToggle }: IBMSidebarProps) {
  return (
    <aside
      className={cn(
        'bg-[#0a1628] border-r border-[#1a2942] flex-shrink-0 transition-all duration-300 overflow-y-auto no-scrollbar',
        collapsed ? 'w-16' : 'w-48'
      )}
    >
      <div className="pt-2 pb-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            'group flex items-center h-10 text-gray-400 hover:text-white transition-colors rounded',
            collapsed ? 'justify-center w-full px-0' : 'pl-2 pr-4'
          )}
        >
          <div className="w-12 flex items-center justify-center">
            <span className="inline-flex p-0.5 rounded border border-transparent group-hover:border-blue-500 transition-colors duration-200">
              <Menu className="h-5 w-5 text-white" />
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

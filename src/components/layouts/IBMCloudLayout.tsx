import React, { useState } from 'react';
import { IBMTopBar } from './IBMTopBar';
import { IBMSidebar } from './IBMSidebar';
import { AuthDebugBanner } from '@/components/auth/AuthDebugBanner';

interface IBMCloudLayoutProps {
  children: React.ReactNode;
}

export function IBMCloudLayout({ children }: IBMCloudLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <IBMTopBar 
        onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />
      <div className="flex flex-1 overflow-hidden bg-background">
        <IBMSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <main className="flex-1 overflow-auto bg-background text-foreground no-scrollbar">
          <AuthDebugBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

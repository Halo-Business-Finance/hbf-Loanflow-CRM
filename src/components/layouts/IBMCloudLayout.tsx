import React from 'react';
import { IBMTopBar } from './IBMTopBar';
import { IBMSidebar } from './IBMSidebar';
import { AuthDebugBanner } from '@/components/auth/AuthDebugBanner';

interface IBMCloudLayoutProps {
  children: React.ReactNode;
}

export function IBMCloudLayout({ children }: IBMCloudLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <IBMTopBar 
        onMenuClick={() => {}}
        sidebarCollapsed={false}
      />
      <div className="flex flex-1 overflow-hidden bg-background">
        <IBMSidebar 
          collapsed={false} 
          onToggle={() => {}} 
        />
        <main className="flex-1 overflow-auto bg-background text-foreground no-scrollbar">
          <AuthDebugBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

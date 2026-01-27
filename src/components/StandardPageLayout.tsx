import React from 'react';
import { cn } from '@/lib/utils';

interface StandardPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function StandardPageLayout({ children, className }: StandardPageLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background overflow-auto no-scrollbar", className)}>
      {children}
    </div>
  );
}
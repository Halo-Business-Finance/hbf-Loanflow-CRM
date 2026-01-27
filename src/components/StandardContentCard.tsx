import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StandardContentCardProps {
  title?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function StandardContentCard({ 
  title, 
  children, 
  className,
  headerActions 
}: StandardContentCardProps) {
  return (
    <Card className={cn("bg-card border border-[#0A1628] shadow-lg", className)}>
      {title && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              {title}
            </CardTitle>
            {headerActions}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : ""}>
        {children}
      </CardContent>
    </Card>
  );
}
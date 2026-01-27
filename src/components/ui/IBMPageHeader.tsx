import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';

interface IBMPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  hasDropdown?: boolean;
  className?: string;
  showBreadcrumbs?: boolean;
  showBackButton?: boolean;
  showForwardButton?: boolean;
}

export function IBMPageHeader({
  title,
  subtitle,
  actions,
  hasDropdown = false,
  className,
  showBreadcrumbs = true,
  showBackButton = true,
  showForwardButton = true,
}: IBMPageHeaderProps) {
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  const handleForward = () => {
    navigate(1);
  };

  return (
    <div className={cn('bg-card px-4 md:px-6 lg:px-8 py-4 md:py-6 border-b border-border', className)}>
      {showBreadcrumbs && breadcrumbs.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-8 px-2 text-muted-foreground dark:text-foreground hover:text-foreground hover:bg-accent/40"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {showForwardButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForward}
                className="h-8 px-2 text-muted-foreground dark:text-foreground hover:text-foreground hover:bg-accent/40"
                aria-label="Go forward"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {breadcrumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={breadcrumb.href} className="text-muted-foreground dark:text-foreground hover:text-foreground">
                          {breadcrumb.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-foreground">
                        {breadcrumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {hasDropdown && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          {subtitle && (
            <p className="text-base text-muted-foreground mt-1.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

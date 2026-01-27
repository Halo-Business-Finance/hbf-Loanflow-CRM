import React from 'react';
import { cn } from '@/lib/utils';

interface IBMContentCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  featured?: boolean;
  className?: string;
  onClick?: () => void;
}

export function IBMContentCard({
  title,
  description,
  icon,
  children,
  footer,
  featured = false,
  className,
  onClick,
}: IBMContentCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border border-border transition-shadow',
        onClick && 'cursor-pointer hover:shadow-lg',
        !onClick && 'hover:shadow-md',
        featured
          ? 'bg-gradient-to-br from-[#0f62fe] to-[#0353e9] text-white border-none'
          : '',
        className
      )}
    >
      <div className="p-6">
        {icon && (
          <div className={cn('mb-4', featured ? 'text-white' : 'text-[#0f62fe]')}>
            {icon}
          </div>
        )}
        {title && (
          <h3
            className={cn(
              'text-lg font-medium mb-2',
              featured ? 'text-white' : 'text-[#161616]'
            )}
          >
            {title}
          </h3>
        )}
        {description && (
          <p
            className={cn(
              'text-sm',
              featured ? 'text-white/90' : 'text-[#525252]'
            )}
          >
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && (
        <div
          className={cn(
            'px-6 py-3 border-t',
            featured ? 'border-white/20' : 'border-[#e0e0e0]'
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

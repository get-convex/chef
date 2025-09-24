import { ReactNode } from 'react';
import { cn } from '~/utils/classNames';

interface ModernLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ModernLayout({ children, className }: ModernLayoutProps) {
  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100",
      "dark:from-slate-950 dark:via-slate-900 dark:to-slate-800",
      className
    )}>
      {children}
    </div>
  );
}

interface ModernContainerProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function ModernContainer({ children, className, size = 'xl' }: ModernContainerProps) {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl', 
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  };

  return (
    <div className={cn(
      "mx-auto px-4 sm:px-6 lg:px-8",
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}

interface ModernCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated';
}

export function ModernCard({ children, className, variant = 'default' }: ModernCardProps) {
  const variantClasses = {
    default: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
    glass: "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50",
    elevated: "bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700"
  };

  return (
    <div className={cn(
      "rounded-xl p-6 transition-all duration-200",
      variantClasses[variant],
      className
    )}>
      {children}
    </div>
  );
}

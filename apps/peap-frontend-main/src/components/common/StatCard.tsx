import { cn } from '@/lib/utils';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  iconBackground?: string;
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  className,
  iconBackground,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn('panel p-5 flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary',
              iconBackground,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="stat-value">{value}</span>
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              positive ? 'text-success' : 'text-destructive',
            )}
          >
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {positive ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

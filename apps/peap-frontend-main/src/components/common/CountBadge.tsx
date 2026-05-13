import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CountBadge({ score, size = 'md', className }: ScoreBadgeProps) {
  const tone =
    score >= 50
      ? 'bg-success-soft text-success border-success/30'
      : score >= 20
        ? 'bg-accent-soft text-accent border-accent/30'
        : score >= 5
          ? 'bg-warning-soft text-warning border-warning/30'
          : 'bg-destructive-soft text-destructive border-destructive/30';

  const sizes = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-7 px-2.5 text-xs',
    lg: 'h-9 px-3 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-mono font-medium',
        tone,
        sizes[size],
        className,
      )}
    >
      <Users className="h-3 w-3 ml-1" />
      {score}
    </span>
  );
}

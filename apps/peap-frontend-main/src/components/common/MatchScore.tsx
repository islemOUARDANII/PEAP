import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

type Tone = 'success' | 'warning' | 'destructive';

export function toneFor(score: number): {
  tone: Tone;
  label: string;
  color: string;
  soft: string;
  ring: string;
} {
  if (score >= 80) {
    return {
      tone: 'success',
      label: 'Strong match',
      color: 'hsl(var(--success))',
      soft: 'hsl(var(--success-soft))',
      ring: 'text-success',
    };
  }
  if (score >= 50) {
    return {
      tone: 'warning',
      label: 'Good match',
      color: 'hsl(var(--warning))',
      soft: 'hsl(var(--warning-soft))',
      ring: 'text-warning',
    };
  }
  return {
    tone: 'destructive',
    label: 'Low match',
    color: 'hsl(var(--destructive))',
    soft: 'hsl(var(--destructive-soft))',
    ring: 'text-destructive',
  };
}

interface MatchRingProps {
  score: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  className?: string;
  textSize?: string;
}

export function MatchRing({
  score,
  size = 96,
  stroke = 8,
  showLabel = true,
  textSize = 'text-xl',
  className,
}: MatchRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { color, label } = toneFor(clamped);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="stroke-muted"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke={color}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 800ms ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono font-semibold text-foreground tabular-nums ${textSize}`}
          >
            {Math.round(clamped)}%
          </span>
          {showLabel && size >= 80 && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Match
            </span>
          )}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

interface MatchBarProps {
  score: number;
  showLabel?: boolean;
  helperText?: string;
  tooltip?: string;
  className?: string;
}

export function MatchBar({
  score,
  showLabel = true,
  helperText,
  tooltip = 'Based on skills, experience, and preferences',
  className,
}: MatchBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { color, label } = toneFor(clamped);

  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Match Score</span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[220px]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span
            className="font-mono font-semibold tabular-nums"
            style={{ color }}
          >
            {Math.round(animated)}%
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${animated}%`,
            backgroundColor: color,
            transition: 'width 800ms ease-in-out',
          }}
        />
      </div>
      {(helperText || showLabel) && (
        <p className="text-[11px]" style={{ color }}>
          {helperText ?? label}
        </p>
      )}
    </div>
  );
}

interface MatchScoreProps {
  score: number;
  matchedCount?: number;
  totalRequired?: number;
  ringSize?: number;
  className?: string;
}

/** Combined visualization: ring + linear bar + microcopy. */
export function MatchScore({
  score,
  matchedCount,
  totalRequired,
  ringSize = 104,
  className,
}: MatchScoreProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { label } = toneFor(clamped);
  const helper =
    matchedCount !== undefined && totalRequired !== undefined
      ? `Matches ${matchedCount} out of ${totalRequired} required skills`
      : undefined;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center gap-5 panel p-5',
        className,
      )}
    >
      <MatchRing score={clamped} size={ringSize} />
      <div className="flex-1 w-full space-y-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            Based on skills, experience, and preferences
          </p>
        </div>
        <MatchBar score={clamped} showLabel={false} helperText={helper} />
      </div>
    </div>
  );
}

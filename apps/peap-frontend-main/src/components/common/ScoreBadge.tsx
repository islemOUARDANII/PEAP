import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreBadge({ score, size = "md", className }: ScoreBadgeProps) {
  const tone =
    score >= 85 ? "bg-success-soft text-success border-success/30"
    : score >= 70 ? "bg-accent-soft text-accent border-accent/30"
    : score >= 55 ? "bg-warning-soft text-warning border-warning/30"
    : "bg-destructive-soft text-destructive border-destructive/30";

  const sizes = {
    sm: "h-6 px-2 text-xs",
    md: "h-7 px-2.5 text-xs",
    lg: "h-9 px-3 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-mono font-medium",
        tone,
        sizes[size],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {score}%
    </span>
  );
}

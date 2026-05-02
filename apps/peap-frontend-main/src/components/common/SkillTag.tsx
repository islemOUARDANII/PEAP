import { cn } from "@/lib/utils";

interface SkillTagProps {
  label: string;
  variant?: "default" | "matched" | "missing" | "outline";
  className?: string;
}

export function SkillTag({ label, variant = "default", className }: SkillTagProps) {
  const variants = {
    default: "bg-secondary text-secondary-foreground border-border",
    matched: "bg-success-soft text-success border-success/30",
    missing: "bg-destructive-soft text-destructive border-destructive/30",
    outline: "border-border-strong text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

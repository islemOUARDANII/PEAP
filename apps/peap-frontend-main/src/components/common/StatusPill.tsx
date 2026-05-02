import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  destructive: "bg-destructive-soft text-destructive border-destructive/20",
  info: "bg-info-soft text-info border-info/20",
  accent: "bg-accent-soft text-accent border-accent/20",
};

interface StatusPillProps {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}

export function StatusPill({ label, tone = "neutral", dot = true, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

export function statusToTone(status: string): Tone {
  const s = status.toLowerCase();
  if (
    [
      "active",
      "success",
      "shortlisted",
      "published",
      "validated",
      "completed",
      "parsed",
      "search_ready",
      "retained",
      "up",
    ].includes(s)
  )
    return "success";
  if (
    [
      "draft",
      "paused",
      "pending",
      "reviewed",
      "running",
      "pending_verification",
      "temporary",
    ].includes(s)
  )
    return "warning";
  if (
    [
      "archived",
      "rejected",
      "error",
      "suspended",
      "disabled",
      "failed",
      "cancelled",
      "deleted",
      "down",
    ].includes(s)
  )
    return "destructive";
  if (["new", "info"].includes(s)) return "info";
  return "neutral";
}

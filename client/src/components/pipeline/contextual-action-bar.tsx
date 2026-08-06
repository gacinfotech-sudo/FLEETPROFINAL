import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ContextualAction {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive";
  // Impossible actions for the record's current status/permissions should
  // not render at all (spec: "do not show Start Trip for a cancelled
  // Booking") — callers compute this, the bar just respects it.
  hidden?: boolean;
}

interface ContextualActionBarProps {
  actions: ContextualAction[];
  className?: string;
}

// A record-status/permission-aware action row, reused verbatim across
// Inquiry/Lead/Booking workspaces instead of each page hand-rolling its
// own button row. Carries no mutation logic — every action's onClick is
// the caller's own existing mutation, this component only lays them out
// consistently and hides ones the caller marks impossible.
export default function ContextualActionBar({ actions, className }: ContextualActionBarProps) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-2", className)}>
      {visible.map((action) => (
        <Button
          key={action.key}
          size="sm"
          variant={action.variant || "outline"}
          disabled={action.disabled || action.pending}
          onClick={action.onClick}
        >
          {action.pending ? "…" : action.label}
        </Button>
      ))}
    </div>
  );
}

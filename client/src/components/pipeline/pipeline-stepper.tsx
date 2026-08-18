import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type PipelineStageInfo } from "@/lib/pipelineStages";

interface NextAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface PipelineStepperProps {
  info: PipelineStageInfo;
  nextAction?: NextAction;
}

// Presentational only — reads a precomputed {currentIndex, blocked} and an
// optional single next-action; carries no mutation logic of its own so it
// can sit on Inquiry, Lead, and Booking workspaces without duplicating any
// business logic those pages already own.
export default function PipelineStepper({ info, nextAction }: PipelineStepperProps) {
  if (info.blocked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Stage blocked: <span className="font-medium">{info.blocked.label}</span>{info.blocked.reason ? ` — ${info.blocked.reason}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center overflow-x-auto pb-1">
        {PIPELINE_STAGES.map((stage, index) => {
          const isComplete = index < info.currentIndex;
          const isCurrent = index === info.currentIndex;
          return (
            <div key={stage.key} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1 w-20">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium shrink-0",
                    isComplete && "bg-green-600 text-white",
                    isCurrent && "bg-blue-600 text-white ring-4 ring-blue-100",
                    !isComplete && !isCurrent && "bg-gray-100 text-gray-400"
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span className={cn("text-[11px] text-center leading-tight", isCurrent ? "text-blue-700 font-medium" : isComplete ? "text-gray-600" : "text-gray-400")}>
                  {stage.label}
                </span>
              </div>
              {index < PIPELINE_STAGES.length - 1 && (
                <div className={cn("h-0.5 w-4 shrink-0 -mt-4", isComplete ? "bg-green-600" : "bg-gray-200")} />
              )}
            </div>
          );
        })}
      </div>
      {nextAction && (
        // A fixed aria-label (not the dynamic action text) — the visible
        // text otherwise contains the real action button's exact label as
        // a substring (e.g. "...Convert to Booking →"), which non-exact
        // getByRole('button', {name: 'Convert to Booking'}) queries in
        // existing tests would ambiguously match alongside the real
        // button. This stepper link is a shortcut to that action, not a
        // second copy of it, so it must never compete for the same name.
        <button
          type="button"
          aria-label="Go to the next recommended pipeline action"
          disabled={nextAction.disabled}
          onClick={nextAction.onClick}
          className="text-sm text-blue-700 hover:text-blue-900 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          Next recommended action: <span className="font-medium">{nextAction.label}</span> →
        </button>
      )}
    </div>
  );
}

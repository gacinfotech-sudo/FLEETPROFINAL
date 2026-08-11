// Interactive fuel gauge (spec §5) — a real selectable meter, not a bare
// number input. Nine detents (Empty → Full in 1/8 steps); stores the numeric
// percentage (0-100). Read-only mode renders the same visual for comparisons
// (Fuel Out vs Fuel In on return).
import { Fuel } from "lucide-react";

export const FUEL_STEPS = [
  { pct: 0, label: "Empty" },
  { pct: 12.5, label: "1/8" },
  { pct: 25, label: "1/4" },
  { pct: 37.5, label: "3/8" },
  { pct: 50, label: "1/2" },
  { pct: 62.5, label: "5/8" },
  { pct: 75, label: "3/4" },
  { pct: 87.5, label: "7/8" },
  { pct: 100, label: "Full" },
] as const;

export function fuelLabel(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || isNaN(Number(pct))) return "—";
  const nearest = FUEL_STEPS.reduce((best, s) => (Math.abs(s.pct - Number(pct)) < Math.abs(best.pct - Number(pct)) ? s : best), FUEL_STEPS[0]);
  return `${nearest.label} (${Number(pct)}%)`;
}

function segmentColor(pct: number): string {
  if (pct <= 12.5) return "bg-red-500";
  if (pct <= 37.5) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function FuelGauge({ value, onChange, label, readOnly = false, compareValue }: {
  value: number | null;
  onChange?: (pct: number) => void;
  label?: string;
  readOnly?: boolean;
  /** When set (e.g. Fuel Out while recording Fuel In) a marker shows the reference level. */
  compareValue?: number | null;
}) {
  const active = value ?? -1;
  return (
    <div data-testid={`fuel-gauge${readOnly ? "-readonly" : ""}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1"><Fuel size={14} className="text-gray-400" />{label}</span>
          <span className="text-sm font-semibold text-gray-900">{fuelLabel(value)}</span>
        </div>
      )}
      <div className="flex gap-0.5" role={readOnly ? undefined : "radiogroup"} aria-label={label || "Fuel level"}>
        {FUEL_STEPS.map((s) => {
          const filled = active >= s.pct && active >= 0;
          const isCompare = compareValue !== null && compareValue !== undefined && Math.abs(compareValue - s.pct) < 6.25;
          return (
            <button
              key={s.pct}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(s.pct)}
              title={`${s.label} — ${s.pct}%`}
              aria-checked={Math.abs(active - s.pct) < 6.25}
              role={readOnly ? undefined : "radio"}
              data-testid={`fuel-step-${s.pct}`}
              className={`relative h-7 flex-1 min-w-0 rounded-sm transition-colors ${
                filled ? segmentColor(active) : "bg-gray-200"
              } ${readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80"} ${
                Math.abs(active - s.pct) < 6.25 ? "ring-2 ring-blue-500 ring-offset-1 z-10" : ""
              }`}
            >
              {isCompare && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-blue-700" aria-label="previous level" />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span>
      </div>
    </div>
  );
}

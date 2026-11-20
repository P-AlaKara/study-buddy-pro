import { useId, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { MedicalCase, VitalsDelta } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { applyDelta, deltaParts, initialVitals } from "../../case-analysis";
import { CATEGORY_META, VITAL_META, VITAL_ORDER } from "../../vocabulary";
import { VitalsGrid } from "../clinical-display";
import { FOCUS_RING, NumberInput } from "../studio-ui";

/** Change in each observation; blank means "no change". */
export function VitalsDeltaEditor({
  definition,
  value,
  onChange,
  previewLabel = "If this happened on arrival:",
}: {
  definition: MedicalCase;
  value: VitalsDelta | undefined;
  onChange: (value: VitalsDelta | undefined) => void;
  previewLabel?: string;
}) {
  const delta = value ?? {};
  const start = initialVitals(definition);
  const set = (sign: keyof VitalsDelta, next: number | undefined) => {
    const copy: VitalsDelta = { ...delta };
    if (next === undefined || next === 0) delete copy[sign];
    else copy[sign] = next;
    onChange(Object.keys(copy).length ? copy : undefined);
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {VITAL_ORDER.map((sign) => (
          <label key={sign} className="block min-w-0">
            <span className="mb-1 block text-[13px] font-bold">{VITAL_META[sign].label}</span>
            <NumberInput
              value={delta[sign]}
              onChange={(next) => set(sign, next)}
              step={sign === "temp" ? 0.1 : 1}
              allowEmpty
              placeholder="0"
              suffix={VITAL_META[sign].unit}
              ariaLabel={`Change in ${VITAL_META[sign].label}`}
            />
          </label>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">
        Use + for a rise and − for a fall, e.g. −5 for SpO₂ falling by 5%. Leave blank for no
        change.
      </p>
      {start && deltaParts(value).length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">{previewLabel}</p>
          <VitalsGrid vitals={applyDelta(start, delta)} before={start} compact />
        </div>
      )}
    </div>
  );
}

/** Choose several actions from the case; chips for the chosen ones, a grouped list to add more. */
export function ActionPicker({
  definition,
  value,
  onChange,
  exclude = [],
  label,
  emptyHint = "None chosen yet.",
}: {
  definition: MedicalCase;
  value: readonly string[];
  onChange: (value: string[]) => void;
  exclude?: readonly string[];
  label: string;
  emptyHint?: string;
}) {
  const selectId = useId();
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [choice, setChoice] = useState("");
  const available = definition.actions.filter(
    (action) => action.id && !value.includes(action.id) && !exclude.includes(action.id),
  );
  const label0 = (id: string) =>
    definition.actions.find((action) => action.id === id)?.label || "Removed action";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" aria-label={`${label}: chosen`}>
        {value.length === 0 && (
          <span className="text-[13px] text-muted-foreground">{emptyHint}</span>
        )}
        {value.map((id) => {
          const missing = !definition.actions.some((action) => action.id === id);
          return (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-[13px] font-bold",
                missing ? "bg-pink-soft text-[#7b1f1f]" : "bg-lavender-soft text-[#2b2540]",
              )}
            >
              {label0(id)}
              <button
                type="button"
                aria-label={`Remove ${label0(id)}`}
                onClick={() => onChange(value.filter((item) => item !== id))}
                className={cn(
                  "grid size-6 place-items-center rounded-full hover:bg-card",
                  FOCUS_RING,
                )}
              >
                <X className="size-3.5" />
              </button>
            </span>
          );
        })}
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <label htmlFor={selectId} className="sr-only">
            Add to {label}
          </label>
          <select
            id={selectId}
            ref={selectRef}
            value={choice}
            onChange={(event) => {
              const id = event.target.value;
              if (id) onChange([...value, id]);
              setChoice("");
            }}
            className="min-w-0 max-w-full flex-1 cursor-pointer rounded-xl border border-dashed border-[#b9acdf] bg-card px-3 py-2 text-sm font-semibold text-[#4a3799] sm:max-w-sm"
          >
            <option value="">+ Add an action…</option>
            {(["ask", "examine", "test", "treat"] as const).map((category) => {
              const options = available.filter((action) => action.category === category);
              if (!options.length) return null;
              return (
                <optgroup key={category} label={CATEGORY_META[category].plural}>
                  {options.map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.label || "Untitled"}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}

export function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#b9acdf] px-3.5 py-2 text-[13px] font-extrabold text-[#4a3799] hover:bg-lavender-soft",
        FOCUS_RING,
      )}
    >
      <Plus aria-hidden className="size-4" /> {children}
    </button>
  );
}

// Small presentational helpers shared across Exam Generator screens. Keeps the
// claymorphism styling (clay-card, blue/aqua family, yellow flashcard accents)
// consistent and the route files readable.
import type { ReactNode } from "react";
import { Check } from "lucide-react";

export type StepKey = 1 | 2 | 3;

const STEPS: { n: StepKey; label: string }[] = [
  { n: 1, label: "Upload notes" },
  { n: 2, label: "Build exam" },
  { n: 3, label: "Take exam" },
];

/** The 3-step progress header from the wireframes. */
export function Stepper({ current }: { current: StepKey }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide sm:text-xs ${
                active ? "text-blue" : done ? "text-mint" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] ${
                  active
                    ? "bg-blue text-foreground"
                    : done
                      ? "bg-mint text-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : step.n}
              </span>
              {step.label}
            </div>
            {i < STEPS.length - 1 && <span className="h-0.5 w-6 rounded-full bg-border sm:w-10" />}
          </div>
        );
      })}
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-soft text-blue",
  yellow: "bg-yellow-soft text-[color:var(--case-yellow-ink)]",
  mint: "bg-mint-soft text-[color:var(--case-mint-ink)]",
  pink: "bg-pink-soft text-[color:var(--case-pink-ink)]",
  lavender: "bg-lavender-soft text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function Chip({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  icon,
  value,
  label,
  color = "blue",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  color?: "blue" | "yellow" | "mint" | "pink" | "lavender";
}) {
  return (
    <div className={`clay-card bg-${color}-soft p-5 text-center`}>
      <div className="mx-auto mb-1 flex size-10 items-center justify-center text-foreground">
        {icon}
      </div>
      <p className="font-display text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-ink-soft">{label}</p>
    </div>
  );
}

/** Horizontal progress bar matching the quiz feature. */
export function Bar({
  percent,
  tone = "blue",
}: {
  percent: number;
  tone?: "blue" | "mint" | "pink" | "yellow";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fill: Record<string, string> = {
    blue: "bg-blue",
    mint: "bg-mint",
    pink: "bg-pink",
    yellow: "bg-yellow",
  };
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-muted soft-inset"
      role="progressbar"
      aria-valuenow={clamped}
    >
      <div
        className={`h-full rounded-full ${fill[tone]} transition-[width] duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function PageEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-black uppercase tracking-widest text-blue">{children}</p>;
}

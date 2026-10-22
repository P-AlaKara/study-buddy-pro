import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Layers3,
  MousePointerClick,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "medley-anatomy-tour-done";

type Step = {
  icon: typeof Compass;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: MousePointerClick,
    title: "Explore the body in 3D",
    body: "Drag to orbit, pinch or scroll to zoom, and tap any structure to identify it and read its details.",
  },
  {
    icon: Layers3,
    title: "Search and toggle systems",
    body: "Use the left panel to search named structures, switch whole systems on or off, or jump to presets like Skeleton and Organs.",
  },
  {
    icon: Compass,
    title: "Separate and reframe",
    body: "Slide “Explode anatomy” to pull every visible piece into a labelled inventory, and use the side controls to change view or auto-rotate.",
  },
  {
    icon: Sparkles,
    title: "Isolate what matters",
    body: "Select a structure, then choose “Isolate” to study it on its own. Reset at any time to reassemble the full body.",
  },
];

function hasSeenTour() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AnatomyTour({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasSeenTour()) {
      const t = window.setTimeout(() => setOpen(true), 650);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode: just close */
    }
    setOpen(false);
    setStep(0);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        aria-label="Take the Anatomy Lab tour"
        className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] right-5 z-[22] hidden items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2 text-xs font-extrabold text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card md:inline-flex"
      >
        <Compass size={15} /> Take a tour
      </button>
    );
  }

  const current = STEPS[step];
  if (!current) return null;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Anatomy Lab tour"
      onClick={finish}
    >
      <div
        className="clay-card w-full max-w-sm rounded-[24px] bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lavender-soft text-foreground">
            <Icon size={22} strokeWidth={2.2} />
          </span>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </div>
        <h2 className="mt-4 font-display text-xl font-black">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-extrabold text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft size={16} /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (last) {
                  finish();
                  return;
                }
                if (step === 0) onOpenSearch?.();
                setStep((s) => s + 1);
              }}
            >
              {last ? "Start exploring" : "Next"}
              {!last && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

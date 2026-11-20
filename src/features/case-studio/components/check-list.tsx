import { useState } from "react";
import { AlertTriangle, ArrowRight, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioCheck } from "../issue-guide";
import { BUILD_STEP_META } from "../vocabulary";
import { Button } from "./studio-ui";
import { useWorkspace } from "./workspace-context";

const STYLE = {
  error: { box: "bg-pink-soft text-[#6f1c1c]", icon: XCircle, word: "Must fix" },
  warning: { box: "bg-yellow-soft text-[#5c4300]", icon: AlertTriangle, word: "Suggestion" },
  info: { box: "bg-blue-soft text-[#173f72]", icon: Info, word: "Worth checking" },
} as const;

/** Automated checks, each with the step it belongs to and a button that goes there. */
export function CheckList({
  checks,
  limit,
  showStep = true,
  goLabel = "Fix",
}: {
  checks: readonly StudioCheck[];
  limit?: number;
  showStep?: boolean;
  goLabel?: string;
}) {
  const { jump } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const shown = limit && !expanded ? checks.slice(0, limit) : checks;
  return (
    <div>
      <ul className="space-y-2">
        {shown.map((check) => {
          const style = STYLE[check.severity];
          const Icon = style.icon;
          return (
            <li
              key={check.key}
              className={cn("flex items-start gap-2.5 rounded-2xl px-3 py-2.5", style.box)}
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1 text-sm leading-snug">
                <span className="sr-only">{style.word}: </span>
                <span className="font-bold">{check.message}</span>
                {showStep && (
                  <span className="mt-0.5 block text-xs opacity-80">
                    {BUILD_STEP_META[check.step].title}
                    {check.subject ? ` · ${check.subject}` : ""}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  jump({
                    step: check.step,
                    ...(check.actionId ? { actionId: check.actionId } : {}),
                    ...(check.anchor ? { anchor: check.anchor } : {}),
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-extrabold text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c63e0]"
              >
                {goLabel} <ArrowRight aria-hidden className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {limit && checks.length > limit && (
        <Button
          size="sm"
          tone="ghost"
          className="mt-2"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show fewer" : `Show all ${checks.length}`}
        </Button>
      )}
    </div>
  );
}

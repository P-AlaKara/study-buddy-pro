import { useEffect, useState } from "react";
import { Clock3, ListChecks, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { ruleTitle } from "../case-analysis";
import {
  BUILD_STEPS,
  BUILD_STEP_META,
  CATEGORY_META,
  CATEGORY_STEP,
  REVIEW_STAGES,
  REVIEW_STAGE_META,
  buildStepForStage,
} from "../vocabulary";
import { FOCUS_RING } from "./studio-ui";
import type { JumpTarget } from "./workspace-context";

/** Jump straight to any action, event or section (Ctrl/⌘ + K). */
export function ActionFinder({
  definition,
  mode,
  onJump,
}: {
  definition: MedicalCase;
  mode: "build" | "review";
  onJump: (target: JumpTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (target: JumpTarget) => {
    setOpen(false);
    onJump(target);
  };
  const sections =
    mode === "build"
      ? BUILD_STEPS.map((step) => ({ step, title: BUILD_STEP_META[step].title }))
      : REVIEW_STAGES.map((stage) => ({
          step: buildStepForStage(stage),
          title: REVIEW_STAGE_META[stage].title,
        }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-bold text-muted-foreground shadow-sm ring-1 ring-border hover:bg-muted",
          FOCUS_RING,
        )}
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="truncate">Find an action…</span>
        <kbd className="hidden rounded-md bg-muted px-1.5 py-0.5 font-sans text-[11px] font-extrabold text-ink-soft sm:inline">
          Ctrl K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] max-w-xl translate-y-0 overflow-hidden rounded-[22px] p-0">
          <DialogTitle className="sr-only">Find an action, event or section</DialogTitle>
          <DialogDescription className="sr-only">
            Type to filter, then press Enter to go there.
          </DialogDescription>
          <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:rounded-xl [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5">
            <CommandInput placeholder="Search questions, findings, tests, treatments…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>Nothing matches.</CommandEmpty>
              {(["ask", "examine", "test", "treat"] as const).map((category) => {
                const actions = definition.actions.filter((action) => action.category === category);
                if (!actions.length) return null;
                return (
                  <CommandGroup key={category} heading={CATEGORY_META[category].plural}>
                    {actions.map((action) => (
                      <CommandItem
                        key={action.id}
                        value={`${action.label} ${action.group ?? ""} ${action.id}`}
                        onSelect={() => go({ step: CATEGORY_STEP[category], actionId: action.id })}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {action.label || "Untitled"}
                          </span>
                          {action.group && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {action.group}
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
              {definition.deteriorationRules.length > 0 && (
                <CommandGroup heading="Time-critical events">
                  {definition.deteriorationRules.map((rule) => (
                    <CommandItem
                      key={rule.id}
                      value={`${ruleTitle(definition, rule)} ${rule.alertLine}`}
                      onSelect={() => go({ step: "progression", anchor: `studio-rule-${rule.id}` })}
                    >
                      <Clock3 aria-hidden />
                      <span className="truncate font-bold">{ruleTitle(definition, rule)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Sections">
                {sections.map((section) => (
                  <CommandItem
                    key={section.title}
                    value={`section ${section.title}`}
                    onSelect={() => go({ step: section.step })}
                  >
                    <ListChecks aria-hidden />
                    <span className="font-bold">{section.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

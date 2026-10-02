import { useState } from "react";
import { Layers3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptSuggestion, dismissSuggestion } from "@/lib/flashcards";

export function SuggestionPrompt({ studentId, s, compact }: { studentId: string; s: { id: string; front: string; back: string }; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "added" | "dismissed" | "busy">("idle");
  if (state === "dismissed") return null;
  return (
    <div className="clay-card bg-yellow-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-yellow"><Layers3 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-ink-soft">{state === "added" ? "Added to your deck" : "Add a flashcard for this?"}</p>
          <p className="mt-1 text-sm font-bold">{s.front}</p>
          {!compact && <p className="mt-1 text-sm text-ink-soft">{s.back}</p>}
        </div>
      </div>
      {state !== "added" && <div className="mt-3 flex gap-2">
        <Button size="sm" variant="yellow" disabled={state === "busy"} onClick={async () => { setState("busy"); try { await acceptSuggestion(studentId, s); setState("added"); } catch { setState("idle"); } }}><Check /> Add card</Button>
        <Button size="sm" variant="ghost" onClick={async () => { setState("dismissed"); await dismissSuggestion(s.id); }}><X /> Not now</Button>
      </div>}
    </div>
  );
}

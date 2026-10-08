import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DrAmbrose, type AmbroseExpression } from "@/features/case-challenge/components/dr-ambrose";
import type { OsceState } from "../engine.js";
import type { OsceStation } from "../schema.js";

const RATING_LABELS = {
  clear_fail: "Clear Fail",
  borderline: "Borderline",
  pass: "Pass",
  good: "Good",
  excellent: "Excellent",
} as const;

export function StationComplete({
  game,
  station,
  onRetry,
}: {
  game: OsceState;
  station: OsceStation;
  onRetry: () => void;
}) {
  const result = game.finalResult;
  if (!result) return null;
  const ambroseExpression: AmbroseExpression =
    result.rating === "excellent" || result.rating === "good"
      ? "proud"
      : result.rating === "pass"
        ? "encouraging"
        : "concerned";

  return (
    <main className="osce-shell mx-auto max-w-4xl pb-8">
      <section className="clay-card overflow-hidden bg-card">
        <div className="grid md:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex items-center justify-center bg-yellow-soft p-6">
            <DrAmbrose expression={ambroseExpression} className="w-52 max-w-full" />
          </div>
          <div className="p-6 md:p-8">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-pink">
              <Sparkles className="size-4" aria-hidden="true" /> Station complete
            </p>
            <h1 className="mt-2 text-3xl font-black">{RATING_LABELS[result.rating]}</h1>
            <p className="mt-2 font-bold text-muted-foreground">{result.ratingReason}</p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Score label="Overall" value={result.score.composite} />
              <Score label="Checklist" value={result.score.checklist} />
              <Score label="Communication" value={result.score.communication} />
              <Score label="Examiner" value={result.score.examinerQuestions} />
            </div>

            {result.criticalFailIds.length > 0 && (
              <div className="mt-5 rounded-2xl bg-pink-soft p-4">
                <p className="text-xs font-black uppercase tracking-wider">Critical safety issue</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold">
                  {result.criticalFailIds.map((id) => (
                    <li key={id}>
                      {station.criticalFails.find((failure) => failure.id === id)?.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              The detailed checklist, cue report, rapport graph, timeline and examiner-reaction
              replay will be shown in the full debrief.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="clay-button inline-flex items-center gap-2 bg-pink px-5 py-3 text-sm font-black text-primary-foreground"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Retry station
              </button>
              <Link
                to="/osce"
                className="inline-flex items-center gap-2 rounded-full bg-muted px-5 py-3 text-sm font-black transition-transform active:scale-95"
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to OSCE
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-5 text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-lavender-soft p-3 text-center">
      <p className="font-mono text-2xl font-black">{value}%</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

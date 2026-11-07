// Generation progress (wireframe 3). Drives the resumable worker: it repeatedly
// calls advanceExamGeneration so each step runs server-side within a request,
// shows real progress, and — being resumable — simply continues if reopened.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProblem } from "@/lib/log-problem";
import { Bar, Chip, PageEyebrow, Stepper } from "./ui";
import { advanceExamGeneration, getGenerationProgress } from "./exam-generator.functions";
import type { GenerationProgress as Progress } from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = new Set(["done", "failed", "cancelled"]);

export function GenerationProgress({
  examId,
  onComplete,
}: {
  examId: string;
  onComplete: (stage: string) => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const stopped = useRef(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setError("");
    let consecutiveErrors = 0;
    try {
      try {
        const seed = await getGenerationProgress({ data: { examId } });
        if (!stopped.current) setProgress(seed);
        if (TERMINAL.has(seed.stage)) {
          onComplete(seed.stage);
          return;
        }
      } catch {
        /* no job yet / transient — the advance loop will establish it */
      }
      while (!stopped.current) {
        try {
          const p = await advanceExamGeneration({ data: { examId } });
          if (stopped.current) return;
          setProgress(p);
          consecutiveErrors = 0;
          if (TERMINAL.has(p.stage)) {
            onComplete(p.stage);
            return;
          }
          await delay(400);
        } catch (err) {
          consecutiveErrors += 1;
          logProblem("Advance exam generation", err);
          if (consecutiveErrors >= 4) {
            setError(
              err instanceof Error ? err.message : "Generation hit a snag. You can retry below.",
            );
            return;
          }
          await delay(1200 * consecutiveErrors);
        }
      }
    } finally {
      running.current = false;
    }
  }, [examId, onComplete]);

  useEffect(() => {
    stopped.current = false;
    void run();
    return () => {
      stopped.current = true;
    };
  }, [run]);

  const percent = progress?.percent ?? 5;
  const message = progress?.message || "Analysing your material…";
  const objectives = progress?.objectivesTotal ?? 0;
  const chips = progress?.topicChips ?? [];
  const warnings = progress?.warnings ?? [];

  return (
    <div>
      <Stepper current={2} />
      <div className="text-center">
        <PageEyebrow>Step 02 · Source analysis</PageEyebrow>
        <div className="mx-auto mt-4 flex size-24 rotate-[-5deg] items-center justify-center rounded-[28px] bg-blue-soft text-5xl text-blue shadow-[0_8px_0_var(--border)]">
          {error ? "⚠️" : <Sparkles className="size-10 animate-pulse" />}
        </div>
        <h1 className="mt-4 font-display text-2xl font-black md:text-3xl">
          {error ? "Generation paused" : message}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          {error
            ? "Your progress is saved. You can resume generation — nothing already created is lost."
            : "Finding and assessing every testable concept across your uploaded notes."}
        </p>
      </div>

      {error ? (
        <div className="mx-auto mt-6 max-w-md">
          <div className="clay-card flex items-start gap-2 bg-pink-soft p-4 text-sm font-semibold text-[color:var(--case-pink-ink)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
          <Button
            variant="blue"
            className="mt-4 w-full"
            onClick={() => {
              stopped.current = false;
              void run();
            }}
          >
            <RefreshCw /> Resume generation
          </Button>
        </div>
      ) : (
        <>
          <div className="mx-auto mt-6 max-w-xl">
            <div className="mb-2 flex items-center justify-between text-sm font-extrabold">
              <span>Building your exam</span>
              <span>{Math.round(percent)}%</span>
            </div>
            <Bar percent={percent} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="clay-card bg-mint-soft p-5">
              <h3 className="flex items-center gap-2 font-display font-black">
                <CheckCircle2 className="size-5 text-[color:var(--case-mint-ink)]" /> Files
                processed
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {progress?.totalFiles ?? 0} file{(progress?.totalFiles ?? 0) === 1 ? "" : "s"} ·{" "}
                {progress?.unitCount ?? 0} pages/slides
              </p>
            </div>
            <div className="clay-card bg-blue-soft p-5">
              <h3 className="flex items-center gap-2 font-display font-black">
                {objectives > 0 ? (
                  <CheckCircle2 className="size-5 text-blue" />
                ) : (
                  <Loader2 className="size-5 animate-spin text-blue" />
                )}
                {objectives > 0 ? `${objectives} objectives mapped` : "Mapping objectives…"}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {progress?.questionsGenerated
                  ? `${progress.questionsGenerated} questions so far`
                  : "Learning objectives organised"}
              </p>
            </div>
          </div>

          <div className="clay-card mt-4 bg-card p-5">
            <h3 className="font-display font-black">Now generating…</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.length ? (
                chips.map((c) => (
                  <Chip key={c} tone="blue">
                    {c}
                  </Chip>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Topics will appear as they’re mapped.
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Questions are grounded in your sources. Any gaps or unreadable sections are flagged
              honestly.
            </p>
            {warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[color:var(--case-yellow-ink)]">
                {warnings.slice(0, 4).map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

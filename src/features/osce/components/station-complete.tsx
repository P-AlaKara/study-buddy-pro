import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Share2,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { DrAmbrose, type AmbroseExpression } from "@/features/case-challenge/components/dr-ambrose";
import { createOsceDebrief, type ChecklistReviewItem, type TimelineReview } from "../debrief.js";
import { formatOsceClock, type GlobalRating, type OsceState } from "../engine.js";
import { OSCE_RATING_LABELS } from "../progress.js";
import type { OsceMode, OsceStation } from "../schema.js";

const MODE_LABELS: Record<OsceMode, string> = {
  learn: "Learn",
  practice: "Practice",
  exam: "Exam",
};

export function StationComplete({
  game,
  station,
  onRetry,
}: {
  game: OsceState;
  station: OsceStation;
  onRetry: () => void;
}) {
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied" | "downloaded">(
    "idle",
  );
  const result = game.finalResult;
  if (!result) return null;
  const debrief = createOsceDebrief(game, station);
  const outcome = outcomePresentation(result.rating);
  const nextMode: OsceMode | null =
    game.mode === "learn" ? "practice" : game.mode === "practice" ? "exam" : null;

  async function shareResult() {
    const text = [
      `Medley OSCE — ${station.title}`,
      `${MODE_LABELS[game.mode]}: ${OSCE_RATING_LABELS[result!.rating]} (${result!.score.composite}%)`,
      `Checklist ${result!.score.checklist}% · Communication ${result!.score.communication}% · Examiner ${result!.score.examinerQuestions}%`,
      "Educational practice only.",
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Medley OSCE result", text });
        setShareStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setShareStatus("copied");
        return;
      } catch {
        // Fall through to a local text download when clipboard access is unavailable.
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medley-osce-${station.id}-${game.mode}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setShareStatus("downloaded");
  }

  return (
    <main className="osce-shell osce-debrief mx-auto max-w-7xl space-y-5 pb-8">
      <Link
        to="/osce"
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> OSCE hub
      </Link>

      <section
        className={`clay-card grid items-center gap-5 overflow-hidden p-6 md:grid-cols-[minmax(0,1fr)_17rem] md:p-8 ${outcome.className}`}
      >
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em]">
            {outcome.icon} {MODE_LABELS[game.mode]} station complete
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            {OSCE_RATING_LABELS[result.rating]}
          </h1>
          <p className="mt-3 max-w-2xl font-bold leading-relaxed">{result.ratingReason}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Score label="Overall" value={result.score.composite} />
            <Score label="Checklist" value={result.score.checklist} />
            <Score label="Communication" value={result.score.communication} />
            <Score label="Time use" value={result.score.timeManagement} />
            <Score label="Examiner" value={result.score.examinerQuestions} />
          </div>
          {result.criticalFailIds.length > 0 && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-800">
                <AlertTriangle className="size-4" aria-hidden="true" /> Critical safety issue
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold text-red-950">
                {result.criticalFailIds.map((id) => (
                  <li key={id}>
                    {station.criticalFails.find((failure) => failure.id === id)?.label ?? id}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <div className="osce-examiner-bubble mb-2 rounded-2xl bg-white/85 p-4 text-sm font-bold leading-relaxed shadow-sm">
            {outcome.coachLine}
          </div>
          <DrAmbrose expression={outcome.expression} className="mx-auto w-48 max-w-full" />
        </div>
      </section>

      <section className="clay-card bg-card p-5 md:p-6" aria-labelledby="checklist-title">
        <SectionHeading
          eyebrow="Checklist reveal"
          title="What you found — and what you missed"
          id="checklist-title"
          aside={`${result.score.checklistEarnedWeight}/${result.score.checklistTotalWeight} weighted marks`}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {debrief.checklistDomains.map((domain) => (
            <article key={domain.domain} className="rounded-[24px] bg-muted/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black">{domain.label}</h3>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {domain.foundCount} of {domain.items.length} secured
                  </p>
                </div>
                <span className="rounded-full bg-card px-3 py-1.5 font-mono text-sm font-black shadow-sm">
                  {domain.score}%
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {domain.items.map((entry) => (
                  <ChecklistRow key={entry.item.id} entry={entry} />
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        className="clay-card overflow-hidden bg-card p-5 md:p-6"
        aria-labelledby="timeline-title"
      >
        <SectionHeading
          eyebrow="Consultation replay"
          title="How the station unfolded"
          id="timeline-title"
          aside={`${formatOsceClock(station.clockSeconds - game.remainingSeconds)} used · ${result.score.wastedSeconds}s wasted`}
        />
        <DebriefTimeline timeline={debrief.timeline} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-5">
          <section className="clay-card bg-blue-soft p-5 md:p-6" aria-labelledby="cue-report-title">
            <SectionHeading
              eyebrow="Cue report"
              title={`The patient dropped ${debrief.triggeredCueCount} cue${debrief.triggeredCueCount === 1 ? "" : "s"}. You picked up ${debrief.pickedCueCount}.`}
              id="cue-report-title"
            />
            <div className="mt-4 space-y-3">
              {debrief.cues.map((cue) => (
                <article key={cue.cue.id} className="rounded-2xl bg-card/85 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-black">“{cue.cue.patientLine}”</p>
                    <CueStatus status={cue.status} />
                  </div>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-muted-foreground">
                    Ideal response: {cue.idealResponseLabel}
                  </p>
                  {cue.triggeredAtSecond !== null && (
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Dropped at {formatElapsed(cue.triggeredAtSecond)}
                      {cue.resolvedAtSecond !== null
                        ? ` · resolved at ${formatElapsed(cue.resolvedAtSecond)}`
                        : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="clay-card bg-card p-5 md:p-6" aria-labelledby="rapport-title">
            <SectionHeading
              eyebrow="Patient relationship"
              title="Rapport over time"
              id="rapport-title"
              aside={`Finished at ${result.score.rapport}/100`}
            />
            <RapportGraph points={debrief.rapportHistory} clockSeconds={station.clockSeconds} />
          </section>
        </div>

        <div className="space-y-5">
          <section className="clay-card bg-yellow-soft p-5 md:p-6" aria-labelledby="coaching-title">
            <SectionHeading
              eyebrow="Focused coaching"
              title="Three things to take forward"
              id="coaching-title"
            />
            <ol className="mt-4 space-y-3">
              {debrief.coachingLines.map((line, index) => (
                <li
                  key={line}
                  className="flex gap-3 rounded-2xl bg-card/80 p-3 text-sm font-bold leading-relaxed"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-yellow text-xs font-black">
                    {index + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </section>

          <section
            className="clay-card bg-lavender-soft p-5 md:p-6"
            aria-labelledby="model-run-title"
          >
            <SectionHeading eyebrow="Expert comparison" title="Model run" id="model-run-title" />
            <p className="mt-2 text-xs font-bold leading-relaxed text-muted-foreground">
              One efficient order—not the only safe approach. Your action number appears where you
              chose the same card.
            </p>
            <ol
              className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1"
              tabIndex={0}
              aria-label="Scrollable model consultation order"
            >
              {debrief.modelRun.map((step, index) => (
                <li key={step.cardId} className="flex gap-3 rounded-2xl bg-card/80 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lavender text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black">{step.label}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted-foreground">
                      {step.reason}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-lavender">
                      {step.chosenAtAction
                        ? `You chose this at action ${step.chosenAtAction}`
                        : "Not chosen"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <section className="clay-card bg-card p-5 md:p-6" aria-labelledby="ambrose-replay-title">
        <SectionHeading
          eyebrow="Examiner replay"
          title="What Dr. Ambrose was thinking"
          id="ambrose-replay-title"
          aside={`${game.examinerReactions.length} logged reactions`}
        />
        <p className="mt-2 max-w-3xl text-xs font-bold leading-relaxed text-muted-foreground">
          His signals were deliberately imperfect. Genuine reactions appeared about 80% of the time,
          and some neutral actions received noise reactions.
        </p>
        <div
          className="mt-5 overflow-x-auto pb-3"
          tabIndex={0}
          aria-label="Scrollable examiner reaction replay"
        >
          <ol className="flex min-w-max gap-3">
            {game.examinerReactions.map((reaction) => (
              <li key={reaction.id} className="w-48 shrink-0 rounded-[22px] bg-muted/60 p-3">
                <div className="flex items-center gap-2">
                  <DrAmbrose
                    expression={reaction.expression}
                    accessory="clipboard"
                    variant="logo"
                    className="w-16 shrink-0"
                  />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Action {reaction.actionNumber}
                    </p>
                    <p className="text-sm font-black">{formatExpression(reaction.expression)}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-relaxed">
                  {station.cards.find((card) => card.id === reaction.cardId)?.label ??
                    reaction.cardId}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                    reaction.isNoise ? "bg-pink-soft text-red-800" : "bg-mint-soft text-mint"
                  }`}
                >
                  {reaction.isNoise ? "Noise" : formatCause(reaction.cause)}
                </span>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-muted-foreground">
                  {reaction.causeLabel}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="clay-card bg-card p-5 md:p-6" aria-labelledby="examiner-review-title">
        <SectionHeading
          eyebrow="Examiner questions"
          title="Answers and explanations"
          id="examiner-review-title"
          aside={`${result.score.examinerQuestions}%`}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {debrief.examinerQuestions.map(
            ({ question, answer, selectedLabels, correctLabels }, index) => (
              <article key={question.id} className="rounded-[24px] bg-muted/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-card text-xs font-black shadow-sm">
                    {index + 1}
                  </span>
                  <span className="rounded-full bg-card px-2.5 py-1 font-mono text-xs font-black">
                    {answer?.scorePercent ?? 0}%
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-black leading-relaxed">{question.prompt}</h3>
                <AnswerList label="Your answer" values={selectedLabels} />
                <AnswerList label="Keyed answer" values={correctLabels} correct />
                <p className="mt-3 border-t border-border/60 pt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                  {question.explanation}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <div className="clay-card flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="clay-button inline-flex items-center gap-2 bg-muted px-5 py-3 text-sm font-black"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Retry
          </button>
          <button
            type="button"
            onClick={shareResult}
            aria-live="polite"
            className="clay-button inline-flex items-center gap-2 bg-lavender-soft px-5 py-3 text-sm font-black text-lavender"
          >
            <Share2 className="size-4" aria-hidden="true" />
            {shareStatus === "idle"
              ? "Share result card"
              : shareStatus === "copied"
                ? "Result copied"
                : shareStatus === "downloaded"
                  ? "Result downloaded"
                  : "Result shared"}
          </button>
          <Link
            to="/osce"
            className="inline-flex items-center gap-2 rounded-full bg-blue-soft px-5 py-3 text-sm font-black transition-transform active:scale-95"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to hub
          </Link>
        </div>
        {nextMode && (
          <Link
            to="/osce/$stationId"
            params={{ stationId: station.id }}
            search={{ mode: nextMode }}
            className="clay-button inline-flex items-center justify-center gap-2 bg-pink px-5 py-3 text-sm font-black text-primary-foreground"
          >
            Try {MODE_LABELS[nextMode]} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <p className="text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice · Clinical content requires qualified clinician
        review.
      </p>
    </main>
  );
}

function outcomePresentation(rating: GlobalRating): {
  className: string;
  expression: AmbroseExpression;
  coachLine: string;
  icon: ReactNode;
} {
  if (rating === "excellent" || rating === "good") {
    return {
      className: "bg-mint-soft text-foreground",
      expression: "proud",
      coachLine:
        "That was a purposeful consultation. Review the missed details, then see whether you can preserve the structure under more pressure.",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
    };
  }
  if (rating === "pass") {
    return {
      className: "bg-blue-soft text-foreground",
      expression: "encouraging",
      coachLine:
        "You reached a safe pass. The replay below shows where a little more structure and cue awareness can make it convincing.",
      icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
    };
  }
  return {
    className:
      rating === "borderline" ? "bg-yellow-soft text-foreground" : "bg-pink-soft text-foreground",
    expression: "concerned",
    coachLine:
      "Use this as a rehearsal, not a verdict. Start with the safety-critical misses, then practise one cleaner structure on the next run.",
    icon: <Target className="size-4" aria-hidden="true" />,
  };
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/75 p-3 text-center shadow-sm">
      <p className="font-mono text-2xl font-black">{value}%</p>
      <p className="text-[9px] font-black uppercase tracking-wider opacity-65">{label}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
  aside,
}: {
  eyebrow: string;
  title: string;
  id: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-mint">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-xl font-black md:text-2xl">
          {title}
        </h2>
      </div>
      {aside && <p className="text-xs font-black text-muted-foreground">{aside}</p>}
    </div>
  );
}

function ChecklistRow({ entry }: { entry: ChecklistReviewItem }) {
  const timestamp = entry.status === "penalised" ? entry.penalisedAtSecond : entry.achievedAtSecond;
  return (
    <li className="flex items-start gap-2 rounded-2xl bg-card/85 p-2.5 text-xs shadow-sm">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          entry.status === "found"
            ? "bg-mint text-white"
            : entry.status === "penalised"
              ? "bg-yellow text-foreground"
              : "bg-pink-soft text-red-800"
        }`}
        aria-hidden="true"
      >
        {entry.status === "found" ? (
          <Check className="size-3" />
        ) : entry.status === "penalised" ? (
          <AlertTriangle className="size-3" />
        ) : (
          <XCircle className="size-3" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-relaxed">{entry.item.label}</span>
        <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          {entry.status === "found"
            ? `Found at ${formatElapsed(timestamp ?? 0)}`
            : entry.status === "penalised"
              ? `Mark lost at ${formatElapsed(timestamp ?? 0)} after poor technique`
              : "Missed"}
          {entry.item.criticalFailIfMissing ? " · safety critical" : ""}
        </span>
      </span>
    </li>
  );
}

function DebriefTimeline({ timeline }: { timeline: TimelineReview[] }) {
  const replay = timeline.filter((event) => event.type !== "door");
  return (
    <div className="mt-5 overflow-x-auto pb-3" tabIndex={0} aria-label="Scrollable OSCE timeline">
      <ol className="osce-debrief-timeline flex min-w-max px-2 pt-2">
        {replay.map((event) => (
          <li key={event.id} className="relative w-52 shrink-0 px-3 pt-9">
            <span
              className={`absolute left-3 top-1 z-10 grid size-6 place-items-center rounded-full border-[3px] border-card shadow-sm ${timelineTone(event)}`}
              aria-hidden="true"
            >
              {event.wastedSeconds > 0 ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Clock3 className="size-3" />
              )}
            </span>
            <article
              className={`h-full rounded-2xl p-3 ${event.wastedSeconds > 0 ? "bg-pink-soft" : "bg-muted/70"}`}
            >
              <p className="font-mono text-[10px] font-black text-muted-foreground">
                {formatElapsed(event.elapsedSecond)}
              </p>
              <h3 className="mt-1 text-xs font-black leading-relaxed">{event.title}</h3>
              <p className="mt-1 line-clamp-4 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                {event.detail}
              </p>
              {event.wastedSeconds > 0 && (
                <span className="mt-2 inline-flex rounded-full bg-card px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-800">
                  {event.wastedSeconds}s lost to poor technique
                </span>
              )}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

function timelineTone(event: TimelineReview): string {
  if (event.wastedSeconds > 0 || event.type === "critical_fail" || event.type === "cue_missed") {
    return "bg-pink text-white";
  }
  if (event.type === "cue_picked" || event.type === "result") return "bg-mint text-white";
  if (event.type === "clock_warning" || event.type === "curveball") return "bg-yellow";
  return "bg-lavender-soft text-lavender";
}

function CueStatus({ status }: { status: "not_triggered" | "picked" | "missed" | "active" }) {
  const presentation = {
    picked: ["Picked up", "bg-mint-soft text-mint"],
    missed: ["Missed", "bg-pink-soft text-red-800"],
    active: ["Window open at end", "bg-yellow-soft text-amber-900"],
    not_triggered: ["Not elicited", "bg-muted text-muted-foreground"],
  }[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${presentation[1]}`}
    >
      {presentation[0]}
    </span>
  );
}

function RapportGraph({
  points,
  clockSeconds,
}: {
  points: OsceState["rapportHistory"];
  clockSeconds: number;
}) {
  const x = (second: number) => 36 + (Math.min(clockSeconds, second) / clockSeconds) * 528;
  const y = (value: number) => 154 - (value / 100) * 120;
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${x(point.elapsedSecond)} ${y(point.value)}`)
    .join(" ");
  const changed = points.filter((point) => point.delta !== 0);
  return (
    <div className="mt-4">
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-labelledby="rapport-graph-title rapport-graph-desc"
        className="w-full overflow-visible"
      >
        <title id="rapport-graph-title">Rapport over the consultation</title>
        <desc id="rapport-graph-desc">
          Rapport began at 50 and finished at {points.at(-1)?.value ?? 50} out of 100.
        </desc>
        {[25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1="36"
              x2="564"
              y1={y(value)}
              y2={y(value)}
              stroke="currentColor"
              strokeOpacity=".1"
              strokeDasharray="5 6"
            />
            <text x="8" y={y(value) + 4} className="fill-muted-foreground text-[10px] font-bold">
              {value}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="#168d91"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle
            key={`${point.actionNumber}:${point.elapsedSecond}`}
            cx={x(point.elapsedSecond)}
            cy={y(point.value)}
            r={point.delta === 0 ? 4 : 6}
            fill={point.delta < 0 ? "#d66a55" : "#168d91"}
            stroke="white"
            strokeWidth="3"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-2">
        {changed.map((point) => (
          <span
            key={`${point.actionNumber}:${point.elapsedSecond}`}
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${point.delta > 0 ? "bg-mint-soft text-mint" : "bg-pink-soft text-red-800"}`}
          >
            {point.delta > 0 ? "+" : ""}
            {point.delta} · {point.reason}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnswerList({
  label,
  values,
  correct = false,
}: {
  label: string;
  values: string[];
  correct?: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1 space-y-1">
        {(values.length ? values : ["No answer recorded"]).map((value) => (
          <li
            key={value}
            className={`flex gap-1.5 text-[11px] font-bold leading-relaxed ${correct ? "text-mint" : "text-foreground"}`}
          >
            {correct ? (
              <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">•</span>
            )}
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatExpression(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatCause(value: string): string {
  return value.replaceAll("_", " ");
}

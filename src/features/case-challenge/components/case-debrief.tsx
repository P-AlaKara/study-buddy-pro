import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  RotateCcw,
  Share2,
  Star,
  Stethoscope,
  Trophy,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  createDebrief,
  type GameState,
  type ScoreBreakdown,
  type TimelineEvent,
} from "../engine.js";
import { CASE_BANK } from "../cases/index.js";
import type { MedicalCase } from "../schema.js";
import { CaseImageViewer } from "./case-image-viewer.js";
import { DrAmbrose, type AmbroseExpression } from "./dr-ambrose.js";

export function CaseDebrief({
  game,
  caseDefinition,
  onRetry,
}: {
  game: GameState;
  caseDefinition: MedicalCase;
  onRetry: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const debrief = createDebrief(game, caseDefinition);
  const index = CASE_BANK.findIndex((candidate) => candidate.id === caseDefinition.id);
  const nextCase = CASE_BANK[(index + 1) % CASE_BANK.length];
  const completedActionIds = new Set(game.completedActions.map((entry) => entry.actionId));
  const reviewedArtifacts = caseDefinition.actions.flatMap((action) => {
    if (!completedActionIds.has(action.id) || !action.result.assetId || !action.result.annotation) {
      return [];
    }
    const asset = caseDefinition.assets.find((candidate) => candidate.id === action.result.assetId);
    return asset ? [{ action, asset }] : [];
  });
  const outcome = outcomePresentation(debrief.outcome);
  const ambroseExpression: AmbroseExpression =
    debrief.outcome === "diagnosed"
      ? "proud"
      : debrief.outcome === "missed"
        ? "encouraging"
        : "concerned";

  function retry() {
    onRetry();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="case-cockpit mx-auto max-w-6xl space-y-5 pb-8">
      <Link
        to="/cases"
        className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-[#107b80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
      >
        <ArrowLeft className="size-4" /> All cases
      </Link>

      <section
        className={`case-panel case-stage-transition grid items-center gap-4 overflow-hidden p-6 md:grid-cols-[1fr_auto] md:p-8 ${outcome.className}`}
      >
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]">
            {outcome.icon} Case complete
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">{outcome.label}</h1>
          <p className="mt-3 max-w-2xl font-bold leading-relaxed">{debrief.outcomeReason}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-end gap-2 rounded-2xl bg-white/75 px-4 py-3 shadow-sm">
              <span className="font-mono text-4xl font-black">{debrief.score.total}</span>
              <span className="pb-1 text-xs font-bold">/ {debrief.score.maximum} points</span>
            </div>
            <div className="rounded-2xl bg-white/55 px-4 py-3 text-xs font-bold">
              <span className="block text-[9px] uppercase tracking-wider opacity-60">
                Final diagnosis
              </span>
              {debrief.committedDiagnosis ?? "No diagnosis committed"}
            </div>
          </div>
        </div>
        <DrAmbrose expression={ambroseExpression} className="mx-auto w-44 max-w-full md:w-52" />
      </section>

      <section className="case-panel overflow-hidden p-5 md:p-6" aria-labelledby="replay-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#168d91]">
              Decision replay
            </p>
            <h2 id="replay-title" className="mt-1 text-xl font-black">
              How the case unfolded
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-500">
            {debrief.differentialHistory.length} differential changes · {game.timeMinute} case min
          </p>
        </div>
        <DebriefTimeline
          timeline={debrief.timeline}
          foundKeyClueIds={new Set(debrief.foundKeyClues.map((clue) => clue.actionId))}
          missedKeyClues={debrief.missedKeyClues}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-5">
          <section className="case-panel p-5 md:p-6">
            <h2 className="text-lg font-black">Key clue audit</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              The case was designed to be solvable from these findings.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ClueColumn
                title="Found"
                tone="found"
                empty="No key clues were uncovered before the case ended."
              >
                {debrief.foundKeyClues.map((clue) => (
                  <li key={clue.actionId} className="rounded-2xl bg-emerald-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-black text-emerald-800">
                      <Check className="size-3.5" /> +{clue.discoveredAtMinute} min · {clue.label}
                    </p>
                    <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-slate-600">
                      {clue.result}
                    </p>
                  </li>
                ))}
              </ClueColumn>
              <ClueColumn title="Missed" tone="missed" empty="You found every authored key clue.">
                {debrief.missedKeyClues.map((clue) => (
                  <li key={clue.actionId} className="rounded-2xl bg-red-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-black text-red-800">
                      <XCircle className="size-3.5" /> {clue.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      This finding was reachable but not investigated.
                    </p>
                  </li>
                ))}
              </ClueColumn>
            </div>
          </section>

          <section className="case-panel p-5 md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
              Diagnostic calibration
            </p>
            <h2 className="mt-1 text-lg font-black">Why not the tempting answer?</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
              {debrief.whyNotTempting}
            </p>
            <div className="mt-4 rounded-2xl bg-[#dff4f1] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#107b80]">
                Correct diagnosis
              </p>
              <p className="mt-1 font-black text-slate-900">{debrief.correctDiagnosis}</p>
            </div>
          </section>

          {debrief.harmfulActions.length > 0 && (
            <section className="case-panel border-red-200 bg-red-50 p-5 md:p-6">
              <h2 className="flex items-center gap-2 text-lg font-black text-red-900">
                <AlertTriangle className="size-5" /> Harmful action review
              </h2>
              <div className="mt-4 space-y-3">
                {debrief.harmfulActions.map((action) => (
                  <div key={action.actionId} className="rounded-2xl bg-white/75 p-4">
                    <p className="text-sm font-black text-red-900">{action.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-red-950/70">
                      {action.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <ScoreBreakdownCard
            score={debrief.score}
            accuracy={
              !game.committedDiagnosisId
                ? "not_submitted"
                : game.committedDiagnosisId === caseDefinition.solution.diagnosisId
                  ? "correct"
                  : "incorrect"
            }
            hintCount={game.hintsUsed.length}
            harmfulCount={debrief.harmfulActions.length}
          />

          <section className="case-panel p-5 md:p-6">
            <h2 className="text-lg font-black">Three things to take forward</h2>
            <ol className="mt-4 space-y-3">
              {debrief.teachingPoints.map((point, pointIndex) => (
                <li
                  key={point}
                  className="flex gap-3 text-sm font-semibold leading-relaxed text-slate-600"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#dff4f1] text-xs font-black text-[#107b80]">
                    {pointIndex + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ol>
          </section>

          <section className="case-panel overflow-hidden bg-[#eeeafd] p-5 md:p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/70 text-[#6556b2]">
                <Trophy className="size-7" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6556b2]">
                  Mock comparison · placeholder data
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {debrief.mockComparisonPercent}%
                </p>
                <p className="text-xs font-bold text-slate-600">
                  of simulated users reached the correct diagnosis.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {reviewedArtifacts.length > 0 && (
        <section className="case-panel p-5 md:p-6" aria-labelledby="artifact-review-title">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#168d91]">
            Annotated review
          </p>
          <h2 id="artifact-review-title" className="mt-1 text-xl font-black">
            Revisit the images you ordered
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Amber overlays show the authored finding. Zoom and pan to inspect it again.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {reviewedArtifacts.map(({ action, asset }) => (
              <div key={action.id}>
                <h3 className="mb-2 text-sm font-black text-slate-700">{action.label}</h3>
                <CaseImageViewer
                  asset={asset}
                  assetPath={`/cases/${caseDefinition.slug}/${asset.filename}`}
                  result={action.result}
                  revealAnswer
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="case-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
          >
            <RotateCcw className="size-4" /> Retry case
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#eeeafd] px-5 py-3 text-sm font-black text-[#55489b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6556b2]"
          >
            <Share2 className="size-4" /> Share result card
          </button>
        </div>
        {nextCase && (
          <Link
            to="/cases/$caseId"
            params={{ caseId: nextCase.id }}
            className="case-primary-button justify-center px-5 py-3"
          >
            Next case <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      <p className="text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice · Case content requires qualified clinician review.
      </p>

      <ShareResultDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        caseDefinition={caseDefinition}
        outcomeLabel={outcome.label}
        diagnosis={debrief.correctDiagnosis}
        score={debrief.score}
      />
    </div>
  );
}

function outcomePresentation(outcome: "diagnosed" | "missed" | "patient_lost"): {
  label: string;
  className: string;
  icon: ReactNode;
} {
  if (outcome === "diagnosed") {
    return {
      label: "Diagnosis secured",
      className: "bg-emerald-50 text-emerald-950",
      icon: <CheckCircle2 className="size-4" />,
    };
  }
  if (outcome === "missed") {
    return {
      label: "Diagnosis missed",
      className: "bg-amber-50 text-amber-950",
      icon: <Stethoscope className="size-4" />,
    };
  }
  return {
    label: "Patient lost",
    className: "bg-red-50 text-red-950",
    icon: <AlertTriangle className="size-4" />,
  };
}

function DebriefTimeline({
  timeline,
  foundKeyClueIds,
  missedKeyClues,
}: {
  timeline: TimelineEvent[];
  foundKeyClueIds: ReadonlySet<string>;
  missedKeyClues: Array<{ actionId: string; label: string }>;
}) {
  const replay = timeline.filter((event) => !["hook", "case_started"].includes(event.type));
  return (
    <div className="mt-5 overflow-x-auto pb-3" tabIndex={0} aria-label="Scrollable case timeline">
      <ol className="case-timeline-track flex min-w-max gap-0 px-2 pt-2">
        {replay.map((event) => {
          const keyClue = Boolean(event.actionId && foundKeyClueIds.has(event.actionId));
          return (
            <li key={event.id} className="relative w-48 shrink-0 px-3 pt-8">
              <span
                className={`absolute left-3 top-1 z-10 grid size-5 place-items-center rounded-full border-[3px] border-white shadow-sm ${timelineTone(event, keyClue)}`}
                aria-hidden="true"
              >
                {keyClue && <Star className="size-2.5 fill-current" />}
              </span>
              <p className="font-mono text-[10px] font-black text-slate-400">
                +{event.timeMinute} min · {event.type.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs font-black text-slate-800">{event.title}</p>
              <p className="mt-1 line-clamp-4 text-[10px] leading-relaxed text-slate-500">
                {event.detail}
              </p>
            </li>
          );
        })}
        {missedKeyClues.map((clue) => (
          <li
            key={clue.actionId}
            className="relative w-48 shrink-0 border-l border-dashed border-red-200 px-3 pt-8"
          >
            <span className="absolute left-3 top-1 z-10 grid size-5 place-items-center rounded-full border-[3px] border-white bg-red-400 text-white shadow-sm">
              <XCircle className="size-2.5" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
              Not discovered
            </p>
            <p className="mt-1 text-xs font-black text-slate-800">{clue.label}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Reachable key clue missed during the encounter.
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function timelineTone(event: TimelineEvent, keyClue: boolean): string {
  if (keyClue) return "bg-amber-400 text-amber-950";
  if (event.type === "deterioration" || event.type === "warning") {
    return "bg-red-500 text-white";
  }
  if (event.type === "differential") return "bg-violet-400 text-white";
  if (event.type === "outcome" || event.type === "commit") return "bg-slate-800 text-white";
  if (event.type === "hint") return "bg-amber-200 text-amber-900";
  return "bg-[#62c8c3] text-[#103d41]";
}

function ClueColumn({
  title,
  tone,
  empty,
  children,
}: {
  title: string;
  tone: "found" | "missed";
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  return (
    <div>
      <p
        className={`text-[10px] font-black uppercase tracking-[0.14em] ${tone === "found" ? "text-emerald-700" : "text-red-700"}`}
      >
        {title} · {items.length}
      </p>
      <ul className="mt-2 space-y-2">
        {items.length > 0 ? (
          items
        ) : (
          <li className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
            {empty}
          </li>
        )}
      </ul>
    </div>
  );
}

function ScoreBreakdownCard({
  score,
  accuracy,
  hintCount,
  harmfulCount,
}: {
  score: ScoreBreakdown;
  accuracy: "correct" | "incorrect" | "not_submitted";
  hintCount: number;
  harmfulCount: number;
}) {
  const rows = [
    { label: "Starting score", detail: "Case baseline", value: score.base },
    {
      label: "Accuracy",
      detail:
        accuracy === "correct"
          ? "Correct diagnosis"
          : accuracy === "incorrect"
            ? "Diagnosis penalty"
            : "No diagnosis submitted",
      value: score.diagnosis,
    },
    {
      label: "Efficiency",
      detail: "Time and low-value testing",
      value: score.time + score.unnecessaryTests,
    },
    { label: "Hints", detail: `${hintCount} used`, value: score.hints },
    { label: "Harmful actions", detail: `${harmfulCount} recorded`, value: score.harmfulActions },
    { label: "Treatment plan", detail: "Essential management", value: score.treatment },
    { label: "Early clue bonus", detail: "Key clue found promptly", value: score.earlyKeyClue },
  ];
  return (
    <section className="case-panel overflow-hidden" aria-labelledby="score-title">
      <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
            Score breakdown
          </p>
          <h2 id="score-title" className="mt-1 text-lg font-black">
            Clinical reasoning score
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-black">{score.total}</p>
          <p className="text-[10px] font-bold text-white/55">of {score.maximum}</p>
        </div>
      </div>
      <dl className="divide-y divide-slate-100 px-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-black text-slate-700">{row.label}</dt>
              <dd className="text-[10px] font-semibold text-slate-400">{row.detail}</dd>
            </div>
            <dd
              className={`font-mono text-sm font-black ${row.value < 0 ? "text-red-600" : row.value > 0 ? "text-emerald-700" : "text-slate-400"}`}
            >
              {formatSigned(row.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function ShareResultDialog({
  open,
  onOpenChange,
  caseDefinition,
  outcomeLabel,
  diagnosis,
  score,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseDefinition: MedicalCase;
  outcomeLabel: string;
  diagnosis: string;
  score: ScoreBreakdown;
}) {
  const [status, setStatus] = useState("");
  const shareText = `I scored ${score.total}/${score.maximum} on Medley’s “${caseDefinition.title}” clinical case. Outcome: ${outcomeLabel}. Diagnosis: ${diagnosis}. Educational simulation only.`;

  async function shareOrCopy() {
    setStatus("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${caseDefinition.title} | Medley`, text: shareText });
        setStatus("Shared.");
        return;
      }
      await copyText(shareText);
      setStatus("Result text copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyText(shareText);
        setStatus("Result text copied.");
      } catch {
        setStatus("Copy failed. You can select the text in the card manually.");
      }
    }
  }

  function downloadCard() {
    const svg = resultCardSvg({
      title: caseDefinition.title,
      outcome: outcomeLabel,
      diagnosis,
      score: `${score.total} / ${score.maximum}`,
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medley-${caseDefinition.slug}-result.svg`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("SVG result card downloaded.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[28px] border-0 bg-[#fdfcf8] p-5 shadow-2xl sm:p-7">
        <DialogTitle className="font-display text-2xl font-black">Share your result</DialogTitle>
        <DialogDescription>
          Share the text summary or download a lightweight SVG result card.
        </DialogDescription>

        <div className="mt-4 overflow-hidden rounded-[26px] bg-[#173d42] p-6 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-black">medley.</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider">
              Clinical case
            </span>
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            {outcomeLabel}
          </p>
          <h3 className="mt-2 text-2xl font-black">{caseDefinition.title}</h3>
          <p className="mt-2 text-sm font-semibold text-white/70">{diagnosis}</p>
          <div className="mt-7 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
            <p className="text-xs font-bold text-white/55">Educational simulation</p>
            <p className="font-mono text-3xl font-black">
              {score.total}
              <span className="text-sm text-white/55">/{score.maximum}</span>
            </p>
          </div>
        </div>

        <p className="sr-only">{shareText}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={shareOrCopy}
            className="case-primary-button justify-center px-5 py-3"
          >
            <Share2 className="size-4" />
            Share or copy
          </button>
          <button
            type="button"
            onClick={downloadCard}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
          >
            <Download className="size-4" /> Download SVG card
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-center text-xs font-bold text-[#107b80]">
          {status}
        </p>
      </DialogContent>
    </Dialog>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed.");
}

function resultCardSvg({
  title,
  outcome,
  diagnosis,
  score,
}: {
  title: string;
  outcome: string;
  diagnosis: string;
  score: string;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Medley clinical case result">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173d42"/><stop offset="1" stop-color="#0d686d"/></linearGradient></defs>
  <rect width="1200" height="630" rx="48" fill="url(#bg)"/>
  <circle cx="1060" cy="70" r="190" fill="#62c8c3" opacity=".13"/><circle cx="1020" cy="620" r="250" fill="#f0b936" opacity=".1"/>
  <text x="80" y="100" fill="#fff" font-family="Nunito, Arial, sans-serif" font-size="44" font-weight="900">medley.</text>
  <text x="80" y="202" fill="#8fe0dc" font-family="Nunito, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="4">${escapeXml(outcome.toUpperCase())}</text>
  <text x="80" y="280" fill="#fff" font-family="Nunito, Arial, sans-serif" font-size="62" font-weight="900">${escapeXml(title)}</text>
  <text x="80" y="345" fill="#fff" opacity=".72" font-family="Nunito Sans, Arial, sans-serif" font-size="30" font-weight="700">${escapeXml(diagnosis)}</text>
  <line x1="80" y1="438" x2="1120" y2="438" stroke="#fff" opacity=".16"/>
  <text x="80" y="510" fill="#fff" opacity=".58" font-family="Nunito Sans, Arial, sans-serif" font-size="23" font-weight="700">EDUCATIONAL SIMULATION · NOT MEDICAL ADVICE</text>
  <text x="1120" y="525" text-anchor="end" fill="#fff" font-family="ui-monospace, monospace" font-size="64" font-weight="900">${escapeXml(score)}</text>
  </svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

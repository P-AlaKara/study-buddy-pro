import { useEffect, useMemo, useRef, useState, type ComponentType, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  MessageCircleMore,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  addToDifferential,
  applyAction,
  beginCase,
  cancelCommit,
  commitCase,
  createDebrief,
  createInitialState,
  formatBloodPressure,
  formatCaseClock,
  getCommitReadiness,
  openCommit,
  rankDifferential,
  removeFromDifferential,
  requestNextHint,
  setDifferentialConfidence,
  tagEvidence,
  type GameState,
} from "../engine.js";
import { CASE_BANK } from "../cases/index.js";
import type { ActionCategory, CaseAction, MedicalCase } from "../schema.js";
import { CaseImageViewer } from "./case-image-viewer.js";
import { DR_AMBROSE, DrAmbrose, type AmbroseExpression } from "./dr-ambrose.js";
import { PatientAvatar } from "./patient-avatar.js";

type MobileZone = "patient" | "actions" | "chart" | "differential";
type RightTab = "chart" | "differential";

const categoryMeta: Record<
  ActionCategory,
  { label: string; icon: ComponentType<{ className?: string }>; tint: string }
> = {
  ask: { label: "Ask", icon: MessageCircleMore, tint: "bg-[#e8f8f5]" },
  examine: { label: "Examine", icon: Stethoscope, tint: "bg-[#eeeafd]" },
  test: { label: "Tests", icon: FlaskConical, tint: "bg-[#e8f3ff]" },
  treat: { label: "Treat", icon: Syringe, tint: "bg-[#fff0ec]" },
};

const mobileNav: Array<{
  id: MobileZone;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "patient", label: "Patient", icon: HeartPulse },
  { id: "actions", label: "Actions", icon: Stethoscope },
  { id: "chart", label: "Chart", icon: ClipboardList },
  { id: "differential", label: "Differential", icon: Search },
];

function engineMessage(error: unknown): string {
  return error instanceof Error ? error.message : "That move could not be completed.";
}

function typingDelay(content: string): number {
  return Math.min(1500, Math.max(800, 650 + content.length * 5));
}

export function CaseChallengeScreen({ caseDefinition }: { caseDefinition: MedicalCase }) {
  const [game, setGame] = useState<GameState>(() => createInitialState(caseDefinition));
  const [actionCategory, setActionCategory] = useState<ActionCategory>("ask");
  const [rightTab, setRightTab] = useState<RightTab>("chart");
  const [mobileZone, setMobileZone] = useState<MobileZone>("actions");
  const [typingActionId, setTypingActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDiagnosis, setCommitDiagnosis] = useState("");
  const [commitTreatments, setCommitTreatments] = useState<string[]>([]);
  const [draggedDiagnosis, setDraggedDiagnosis] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setGame(createInitialState(caseDefinition));
    setActionCategory("ask");
    setRightTab("chart");
    setMobileZone("actions");
    setTypingActionId(null);
    setError("");
    setCommitOpen(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, [caseDefinition]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  const actions = useMemo(
    () => caseDefinition.actions.filter((action) => action.category === actionCategory),
    [actionCategory, caseDefinition.actions],
  );
  const actionById = useMemo(
    () => new Map(caseDefinition.actions.map((action) => [action.id, action])),
    [caseDefinition.actions],
  );
  const completedIds = useMemo(
    () => new Set(game.completedActions.map((action) => action.actionId)),
    [game.completedActions],
  );
  const latestAction = game.latestActionId ? actionById.get(game.latestActionId) : undefined;
  const latestReply = [...game.completedActions]
    .reverse()
    .map((entry) => actionById.get(entry.actionId))
    .find((action) => action?.result.type === "patient_reply");
  const nextHint = caseDefinition.hints[game.hintsUsed.length];
  const commitReadiness = getCommitReadiness(game, caseDefinition);

  function safelyUpdate(updater: (current: GameState) => GameState) {
    setGame((current) => {
      try {
        const next = updater(current);
        setError("");
        return next;
      } catch (updateError) {
        setError(engineMessage(updateError));
        return current;
      }
    });
  }

  function startCase() {
    safelyUpdate((current) => beginCase(current, caseDefinition));
  }

  function finishAction(actionId: string) {
    safelyUpdate((current) => applyAction(current, caseDefinition, actionId));
    setTypingActionId(null);
    if (actionById.get(actionId)?.result.type === "patient_reply") setMobileZone("patient");
  }

  function chooseAction(action: CaseAction) {
    if (typingActionId || game.phase !== "investigate") return;
    if (action.result.type === "patient_reply") {
      setTypingActionId(action.id);
      typingTimer.current = setTimeout(
        () => finishAction(action.id),
        typingDelay(action.result.content),
      );
      return;
    }
    finishAction(action.id);
  }

  function showCommit() {
    const leading = [...game.differential].sort((a, b) => a.rank - b.rank)[0]?.diagnosisId;
    setCommitDiagnosis(leading ?? caseDefinition.differential[0]?.id ?? "");
    setCommitTreatments(
      game.completedActions
        .filter((entry) => actionById.get(entry.actionId)?.category === "treat")
        .map((entry) => entry.actionId),
    );
    safelyUpdate((current) => openCommit(current, caseDefinition));
    setCommitOpen(true);
  }

  function closeCommit() {
    setCommitOpen(false);
    safelyUpdate((current) =>
      current.phase === "commit" ? cancelCommit(current, caseDefinition) : current,
    );
  }

  function submitCommit() {
    if (!commitDiagnosis) return;
    safelyUpdate((current) =>
      commitCase(current, caseDefinition, {
        diagnosisId: commitDiagnosis,
        treatmentIds: commitTreatments,
      }),
    );
    setCommitOpen(false);
  }

  function addDiagnosis(diagnosisId: string) {
    if (!diagnosisId) return;
    safelyUpdate((current) => addToDifferential(current, caseDefinition, diagnosisId));
  }

  function moveDiagnosis(diagnosisId: string, direction: -1 | 1) {
    const ranked = [...game.differential].sort((a, b) => a.rank - b.rank);
    const index = ranked.findIndex((entry) => entry.diagnosisId === diagnosisId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ranked.length) return;
    [ranked[index], ranked[target]] = [ranked[target]!, ranked[index]!];
    safelyUpdate((current) =>
      rankDifferential(
        current,
        caseDefinition,
        ranked.map((entry) => entry.diagnosisId),
      ),
    );
  }

  function dropDiagnosis(targetId: string) {
    if (!draggedDiagnosis || draggedDiagnosis === targetId) return;
    const ids = [...game.differential]
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.diagnosisId);
    const from = ids.indexOf(draggedDiagnosis);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    safelyUpdate((current) => rankDifferential(current, caseDefinition, ids));
    setDraggedDiagnosis(null);
  }

  function selectMobileZone(zone: MobileZone) {
    setMobileZone(zone);
    if (zone === "chart" || zone === "differential") setRightTab(zone);
  }

  if (game.phase === "debrief") {
    return (
      <BasicDebrief
        game={game}
        caseDefinition={caseDefinition}
        onRetry={() => setGame(createInitialState(caseDefinition))}
      />
    );
  }

  return (
    <div className="case-cockpit -mx-1 pb-24 md:-mx-2 lg:pb-0">
      <header className="sticky top-[72px] z-20 mb-3 rounded-[22px] bg-[#fdfcf8]/95 p-3 shadow-[0_10px_28px_-18px_rgb(20_45_52/45%)] backdrop-blur md:top-[84px] md:p-4">
        <div className="flex items-center gap-3">
          <Link
            to="/cases"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
            aria-label="Back to all cases"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span>{caseDefinition.setting}</span>
              <span aria-hidden="true">•</span>
              <span>{"●".repeat(caseDefinition.difficulty)}</span>
            </div>
            <h1 className="truncate font-display text-lg font-black text-slate-900 md:text-2xl">
              {caseDefinition.title}
            </h1>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <ScoreMeter score={game.score.total} maximum={game.score.maximum} />
            <span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm">
              {game.hintsUsed.length} hints
            </span>
          </div>
          <button
            type="button"
            onClick={showCommit}
            disabled={game.phase !== "investigate"}
            className={`case-primary-button shrink-0 px-4 py-2.5 text-xs sm:text-sm ${commitReadiness.ready ? "case-commit-ready" : ""}`}
          >
            Commit <span className="hidden sm:inline">diagnosis</span>
          </button>
        </div>
      </header>

      <CompactVitals game={game} />

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
        >
          <AlertTriangle className="size-4 shrink-0" /> {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(220px,25fr)_minmax(390px,45fr)_minmax(280px,30fr)]">
        <aside className={`${mobileZone === "patient" ? "block" : "hidden"} lg:block`}>
          <PatientPanel
            caseDefinition={caseDefinition}
            game={game}
            latestReply={latestReply}
            typing={Boolean(typingActionId)}
          />
        </aside>

        <main className={`${mobileZone === "actions" ? "block" : "hidden"} min-w-0 lg:block`}>
          <section className="case-panel min-h-[330px] overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#168d91]">
                    Live encounter
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    {game.phase === "hook"
                      ? "The patient arrives"
                      : (latestAction?.label ?? "What's your first move?")}
                  </h2>
                </div>
                <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/55">
                    Case clock
                  </p>
                  <p className="font-mono text-lg font-black">{formatCaseClock(game.timeMinute)}</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <StageResult
                caseDefinition={caseDefinition}
                game={game}
                latestAction={latestAction}
                typingAction={typingActionId ? actionById.get(typingActionId) : undefined}
                onStart={startCase}
              />
            </div>
          </section>

          <section className="case-panel mt-3 overflow-hidden">
            <div
              className="grid grid-cols-4 gap-1 border-b border-slate-100 bg-slate-50/70 p-2"
              role="tablist"
              aria-label="Clinical actions"
            >
              {(Object.keys(categoryMeta) as ActionCategory[]).map((category) => {
                const meta = categoryMeta[category];
                const Icon = meta.icon;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={actionCategory === category}
                    onClick={() => setActionCategory(category)}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-black transition-colors sm:flex-row sm:justify-center sm:text-xs ${actionCategory === category ? "bg-white text-[#107b80] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
                  >
                    <Icon className="size-4" /> {meta.label}
                  </button>
                );
              })}
            </div>
            <div className="grid max-h-[360px] gap-2 overflow-y-auto p-3 sm:grid-cols-2">
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  used={completedIds.has(action.id)}
                  busy={Boolean(typingActionId)}
                  disabled={game.phase !== "investigate"}
                  onChoose={() => chooseAction(action)}
                />
              ))}
            </div>
          </section>
        </main>

        <aside
          className={`${mobileZone === "chart" || mobileZone === "differential" ? "block" : "hidden"} lg:sticky lg:top-[174px] lg:block`}
        >
          <section className="case-panel flex max-h-[calc(100vh-195px)] min-h-[560px] flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-1 border-b border-slate-100 bg-slate-50/70 p-2">
              {(["chart", "differential"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightTab(tab)}
                  className={`rounded-xl px-3 py-2 text-xs font-black capitalize ${rightTab === tab ? "bg-white text-[#107b80] shadow-sm" : "text-slate-500"}`}
                >
                  {tab === "chart" ? "Chart" : "Differential"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {rightTab === "chart" ? (
                <ChartPanel game={game} caseDefinition={caseDefinition} />
              ) : (
                <DifferentialBoard
                  game={game}
                  caseDefinition={caseDefinition}
                  draggedDiagnosis={draggedDiagnosis}
                  onDragStart={setDraggedDiagnosis}
                  onDrop={dropDiagnosis}
                  onAdd={addDiagnosis}
                  onMove={moveDiagnosis}
                  onRemove={(diagnosisId) =>
                    safelyUpdate((current) =>
                      removeFromDifferential(current, caseDefinition, diagnosisId),
                    )
                  }
                  onConfidence={(diagnosisId, confidence) =>
                    safelyUpdate((current) =>
                      setDifferentialConfidence(current, caseDefinition, diagnosisId, confidence),
                    )
                  }
                  onTag={(diagnosisId, evidenceId, relationship) =>
                    safelyUpdate((current) =>
                      tagEvidence(current, caseDefinition, diagnosisId, evidenceId, relationship),
                    )
                  }
                />
              )}
            </div>
            <HintPanel
              game={game}
              nextHint={nextHint}
              onHint={() => safelyUpdate((current) => requestNextHint(current, caseDefinition))}
            />
          </section>
        </aside>
      </div>

      <footer className="mt-4 text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice · Content status: clinician review required
      </footer>

      <nav className="case-mobile-nav lg:hidden" aria-label="Case workspace">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectMobileZone(item.id)}
              className={mobileZone === item.id ? "is-active" : ""}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <CommitDialog
        open={commitOpen}
        caseDefinition={caseDefinition}
        diagnosisId={commitDiagnosis}
        treatmentIds={commitTreatments}
        onDiagnosis={setCommitDiagnosis}
        onToggleTreatment={(id) =>
          setCommitTreatments((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        onClose={closeCommit}
        onSubmit={submitCommit}
      />
    </div>
  );
}

function PatientPanel({
  caseDefinition,
  game,
  latestReply,
  typing,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  latestReply: CaseAction | undefined;
  typing: boolean;
}) {
  return (
    <section className="case-panel overflow-hidden">
      <div className="bg-gradient-to-b from-[#d9f4f0] to-[#f8fcfb] p-4 text-center">
        <PatientAvatar
          patient={caseDefinition.patient}
          expression={game.patientExpression}
          respiratoryRate={game.vitals.rr}
        />
        <h2 className="mt-2 text-lg font-black text-slate-900">
          {caseDefinition.patient.name}, {caseDefinition.patient.age}
        </h2>
        <p className="text-xs font-bold text-slate-500">{caseDefinition.patient.chiefComplaint}</p>
        <div className="relative mt-4 rounded-[18px] bg-white p-3 text-left text-sm leading-relaxed text-slate-700 shadow-sm before:absolute before:-top-2 before:left-1/2 before:size-4 before:-translate-x-1/2 before:rotate-45 before:bg-white">
          {typing ? (
            <TypingDots />
          ) : latestReply ? (
            <>“{latestReply.result.content}”</>
          ) : (
            <>“{caseDefinition.intro.split(". ").at(-1)}”</>
          )}
        </div>
      </div>
      <VitalsMonitor game={game} />
    </section>
  );
}

function VitalsMonitor({ game }: { game: GameState }) {
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  const warning = !critical && (game.vitals.hr > 120 || game.vitals.rr >= 28);
  const tone = critical ? "text-red-400" : warning ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="bg-[#17242c] p-4 text-white">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">
          Live monitor
        </span>
        <span
          className={`size-2 rounded-full ${critical ? "animate-pulse bg-red-400" : warning ? "bg-amber-300" : "bg-emerald-300"}`}
        />
      </div>
      <svg viewBox="0 0 260 48" className={`h-12 w-full ${tone}`} aria-label="Animated ECG trace">
        <path
          d="M0 27h35l7-5 8 5h17l7-18 10 35 10-29 9 12h38l7-5 8 5h18l7-18 10 35 10-29 9 12h42"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="case-ecg-trace"
        />
      </svg>
      <div className="grid grid-cols-2 gap-2 font-mono">
        <Vital label="HR" value={String(game.vitals.hr)} unit="bpm" alert={game.vitals.hr > 120} />
        <Vital
          label="BP"
          value={formatBloodPressure(game.vitals)}
          unit="mmHg"
          alert={game.vitals.systolicBp < 90}
        />
        <Vital label="RR" value={String(game.vitals.rr)} unit="/min" alert={game.vitals.rr >= 28} />
        <Vital
          label="SpO₂"
          value={`${game.vitals.spo2}%`}
          unit="room"
          alert={game.vitals.spo2 < 90}
        />
        <Vital label="Temp" value={`${game.vitals.temp.toFixed(1)}°`} unit="C" />
        <Vital label="Time" value={formatCaseClock(game.timeMinute)} unit="case" />
      </div>
    </div>
  );
}

function Vital({
  label,
  value,
  unit,
  alert = false,
}: {
  label: string;
  value: string;
  unit: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2.5 py-2 ${alert ? "bg-red-500/15 text-red-300" : "bg-white/5"}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">{label}</p>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[9px] text-white/40">{unit}</p>
    </div>
  );
}

function CompactVitals({ game }: { game: GameState }) {
  return (
    <div className="sticky top-[142px] z-10 mb-3 grid grid-cols-5 gap-1 rounded-2xl bg-[#17242c] p-2 font-mono text-white shadow-lg lg:hidden">
      {[
        ["HR", game.vitals.hr],
        ["BP", formatBloodPressure(game.vitals)],
        ["RR", game.vitals.rr],
        ["SpO₂", `${game.vitals.spo2}%`],
        ["Temp", `${game.vitals.temp.toFixed(1)}°`],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0 text-center">
          <p className="text-[8px] font-bold text-white/45">{label}</p>
          <p className="truncate text-xs font-black">{value}</p>
        </div>
      ))}
    </div>
  );
}

function StageResult({
  caseDefinition,
  game,
  latestAction,
  typingAction,
  onStart,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  latestAction: CaseAction | undefined;
  typingAction: CaseAction | undefined;
  onStart: () => void;
}) {
  if (game.phase === "hook") {
    return (
      <div className="flex min-h-[230px] flex-col justify-center">
        <p className="max-w-xl text-xl font-bold leading-relaxed text-slate-800 md:text-2xl">
          {caseDefinition.intro}
        </p>
        <p className="mt-4 text-sm font-bold text-[#107b80]">What's your first move?</p>
        <button
          type="button"
          onClick={onStart}
          className="case-primary-button mt-5 w-fit px-6 py-3"
        >
          Take over the case <ArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  if (typingAction) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <div className="rounded-[24px] bg-[#e8f8f5] px-6 py-5 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-[#107b80]">
            {caseDefinition.patient.name} is answering
          </p>
          <TypingDots className="mt-3 justify-center" />
        </div>
      </div>
    );
  }

  if (!latestAction) {
    return (
      <div className="grid min-h-[220px] place-items-center text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8f8f5] text-[#107b80]">
            <Stethoscope className="size-7" />
          </span>
          <p className="mt-4 text-lg font-black text-slate-800">What's your first move?</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask, examine, order a focused test, or stabilise the patient.
          </p>
        </div>
      </div>
    );
  }

  const asset = latestAction.result.assetId
    ? caseDefinition.assets.find((candidate) => candidate.id === latestAction.result.assetId)
    : undefined;

  if (asset && (latestAction.result.type === "image" || latestAction.result.type === "ecg")) {
    return (
      <CaseImageViewer
        asset={asset}
        assetPath={`/cases/${caseDefinition.slug}/${asset.filename}`}
        result={latestAction.result}
      />
    );
  }

  if (latestAction.result.type === "lab_table" && latestAction.result.labs) {
    return (
      <div>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">{latestAction.result.content}</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {latestAction.result.labs.map((lab) => (
                <tr key={lab.test} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">{lab.test}</td>
                  <td
                    className={`px-3 py-2 font-mono font-black ${lab.flag === "high" || lab.flag === "low" || lab.flag === "critical" ? "text-red-600" : "text-slate-700"}`}
                  >
                    {lab.result}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{lab.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[24px] p-5 ${latestAction.result.type === "patient_reply" ? "bg-[#e8f8f5]" : "bg-slate-50"}`}
    >
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-[#107b80] shadow-sm">
          {latestAction.result.type === "patient_reply" ? (
            <MessageCircleMore className="size-5" />
          ) : (
            <Activity className="size-5" />
          )}
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {latestAction.result.type === "patient_reply" ? caseDefinition.patient.name : "Finding"}
          </p>
          <p className="mt-1 text-base font-bold leading-relaxed text-slate-800">
            {latestAction.result.type === "patient_reply"
              ? `“${latestAction.result.content}”`
              : latestAction.result.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`} aria-label="Typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="case-typing-dot size-2 rounded-full bg-[#168d91]"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

function ActionCard({
  action,
  used,
  busy,
  disabled,
  onChoose,
}: {
  action: CaseAction;
  used: boolean;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const meta = categoryMeta[action.category];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      disabled={used || busy || disabled}
      onClick={onChoose}
      className={`group relative rounded-[18px] p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91] ${used ? "bg-slate-100 text-slate-400" : `${meta.tint} text-slate-800 hover:-translate-y-0.5 hover:shadow-md`} disabled:cursor-not-allowed`}
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-snug">{action.label}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-extrabold text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
              <Clock3 className="size-3" /> {action.timeCostMin}m
            </span>
            {action.moneyCost > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
                <BadgeDollarSign className="size-3" /> {action.moneyCost}
              </span>
            )}
          </div>
          {!used && action.riskNote && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-slate-500">
              {action.riskNote}
            </p>
          )}
        </div>
        {used && <Check className="size-4 shrink-0" />}
      </div>
    </button>
  );
}

function ChartPanel({ game, caseDefinition }: { game: GameState; caseDefinition: MedicalCase }) {
  const replies = game.completedActions
    .map((entry) => ({
      entry,
      action: caseDefinition.actions.find((action) => action.id === entry.actionId),
    }))
    .filter(({ action }) => action?.result.type === "patient_reply");
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Encounter timeline
        </h3>
        <ol className="mt-3 space-y-3">
          {game.timeline
            .filter((event) => !["hook", "case_started"].includes(event.type))
            .map((event) => (
              <li
                key={event.id}
                className="relative pl-7 text-xs before:absolute before:bottom-[-14px] before:left-[9px] before:top-4 before:w-px before:bg-slate-200 last:before:hidden"
              >
                <span
                  className={`absolute left-0 top-0 grid size-[19px] place-items-center rounded-full text-[9px] ${event.type === "deterioration" || event.type === "warning" ? "bg-red-100 text-red-700" : event.isKeyClue ? "bg-amber-100 text-amber-700" : "bg-[#dff4f1] text-[#107b80]"}`}
                >
                  {event.isKeyClue ? "★" : "•"}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-slate-700">{event.title}</p>
                  <time className="font-mono text-[10px] text-slate-400">+{event.timeMinute}m</time>
                </div>
                <p className="mt-0.5 line-clamp-3 leading-relaxed text-slate-500">{event.detail}</p>
              </li>
            ))}
          {game.timeline.length <= 2 && (
            <li className="text-sm text-slate-500">Findings will appear here as you work.</li>
          )}
        </ol>
      </div>
      {replies.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
            History transcript
          </h3>
          <div className="mt-3 space-y-2">
            {replies.map(({ entry, action }) => (
              <div
                key={entry.actionId}
                className="rounded-2xl bg-[#e8f8f5] p-3 text-xs leading-relaxed"
              >
                <p className="font-black text-[#107b80]">{action?.label}</p>
                <p className="mt-1 text-slate-600">“{action?.result.content}”</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DifferentialBoard({
  game,
  caseDefinition,
  draggedDiagnosis,
  onDragStart,
  onDrop,
  onAdd,
  onMove,
  onRemove,
  onConfidence,
  onTag,
}: {
  game: GameState;
  caseDefinition: MedicalCase;
  draggedDiagnosis: string | null;
  onDragStart: (id: string | null) => void;
  onDrop: (id: string) => void;
  onAdd: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onConfidence: (id: string, confidence: number) => void;
  onTag: (diagnosisId: string, evidenceId: string, relationship: "supports" | "against") => void;
}) {
  const ranked = [...game.differential].sort((a, b) => a.rank - b.rank);
  const available = caseDefinition.differential.filter(
    (diagnosis) => !ranked.some((entry) => entry.diagnosisId === diagnosis.id),
  );
  return (
    <div>
      <label
        className="text-xs font-black uppercase tracking-wider text-slate-500"
        htmlFor="add-diagnosis"
      >
        Add hypothesis
      </label>
      <div className="mt-2 flex gap-2">
        <select
          id="add-diagnosis"
          defaultValue=""
          onChange={(event) => {
            onAdd(event.target.value);
            event.target.value = "";
          }}
          className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#168d91]"
        >
          <option value="">Choose…</option>
          {available.map((diagnosis) => (
            <option key={diagnosis.id} value={diagnosis.id}>
              {diagnosis.label}
            </option>
          ))}
        </select>
        <span className="grid size-9 place-items-center rounded-xl bg-[#dff4f1] text-[#107b80]">
          <Plus className="size-4" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {ranked.map((entry, index) => {
          const diagnosis = caseDefinition.differential.find(
            (candidate) => candidate.id === entry.diagnosisId,
          );
          return (
            <article
              key={entry.diagnosisId}
              draggable
              onDragStart={() => onDragStart(entry.diagnosisId)}
              onDragEnd={() => onDragStart(null)}
              onDragOver={(event: DragEvent) => event.preventDefault()}
              onDrop={() => onDrop(entry.diagnosisId)}
              className={`rounded-2xl bg-slate-50 p-3 transition-opacity ${draggedDiagnosis === entry.diagnosisId ? "opacity-45" : ""}`}
            >
              <div className="flex items-start gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black shadow-sm">
                  {entry.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-slate-800">{diagnosis?.label}</h4>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Confidence {entry.confidence}%
                  </p>
                </div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => onMove(entry.diagnosisId, -1)}
                    disabled={index === 0}
                    className="rounded-md p-1 text-slate-500 disabled:opacity-25"
                    aria-label={`Move ${diagnosis?.label} up`}
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(entry.diagnosisId, 1)}
                    disabled={index === ranked.length - 1}
                    className="rounded-md p-1 text-slate-500 disabled:opacity-25"
                    aria-label={`Move ${diagnosis?.label} down`}
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.diagnosisId)}
                    className="rounded-md p-1 text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${diagnosis?.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={entry.confidence}
                onChange={(event) => onConfidence(entry.diagnosisId, Number(event.target.value))}
                aria-label={`${diagnosis?.label} confidence`}
                className="mt-2 h-1.5 w-full accent-[#168d91]"
              />
              {game.discoveredEvidence.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                  {game.discoveredEvidence.map((evidence) => {
                    const tag = entry.evidenceTags.find(
                      (candidate) => candidate.evidenceActionId === evidence.actionId,
                    );
                    return (
                      <div key={evidence.actionId} className="flex items-center gap-1 text-[9px]">
                        <span
                          className="min-w-0 flex-1 truncate text-slate-500"
                          title={evidence.result}
                        >
                          {evidence.isKeyClue ? "★ " : ""}
                          {evidence.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onTag(entry.diagnosisId, evidence.actionId, "supports")}
                          className={`rounded-full px-1.5 py-0.5 font-black ${tag?.relationship === "supports" ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400"}`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onTag(entry.diagnosisId, evidence.actionId, "against")}
                          className={`rounded-full px-1.5 py-0.5 font-black ${tag?.relationship === "against" ? "bg-red-100 text-red-700" : "bg-white text-slate-400"}`}
                        >
                          −
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
        {ranked.length === 0 && (
          <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs text-slate-500">
            Add and rank your working diagnoses at any time.
          </div>
        )}
      </div>
    </div>
  );
}

function HintPanel({
  game,
  nextHint,
  onHint,
}: {
  game: GameState;
  nextHint: MedicalCase["hints"][number] | undefined;
  onHint: () => void;
}) {
  const latest = game.hintsUsed.at(-1);
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  const expression: AmbroseExpression = critical
    ? "concerned"
    : latest
      ? "encouraging"
      : "thinking";
  return (
    <div className="border-t border-slate-100 bg-[#fff8df] p-4">
      <div className="flex gap-3">
        <DrAmbrose expression={expression} variant="logo" className="-ml-1 -mt-1 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
            {DR_AMBROSE.name}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-700">
            {latest?.text ?? "I’ll nudge your reasoning, but the decisions remain yours."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onHint}
        disabled={!nextHint || game.phase !== "investigate"}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-45"
      >
        <HelpCircle className="size-4" />{" "}
        {nextHint
          ? `Ask ${DR_AMBROSE.name} · Tier ${nextHint.tier} · ${nextHint.cost} pts`
          : "All hints used"}
      </button>
    </div>
  );
}

function CommitDialog({
  open,
  caseDefinition,
  diagnosisId,
  treatmentIds,
  onDiagnosis,
  onToggleTreatment,
  onClose,
  onSubmit,
}: {
  open: boolean;
  caseDefinition: MedicalCase;
  diagnosisId: string;
  treatmentIds: string[];
  onDiagnosis: (id: string) => void;
  onToggleTreatment: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const treatments = caseDefinition.actions.filter((action) => action.category === "treat");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-[28px] border-0 bg-[#fdfcf8] p-5 shadow-2xl sm:p-7">
        <DialogTitle className="font-display text-2xl font-black">Commit your decision</DialogTitle>
        <DialogDescription>
          Choose one final diagnosis and the treatment plan you would initiate. This ends the case.
        </DialogDescription>
        <fieldset className="mt-3 space-y-2">
          <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">
            Final diagnosis
          </legend>
          {caseDefinition.differential.map((diagnosis) => (
            <label
              key={diagnosis.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-sm font-bold ${diagnosisId === diagnosis.id ? "bg-[#dff4f1] text-[#0d686d]" : "bg-white"}`}
            >
              <input
                type="radio"
                name="final-diagnosis"
                value={diagnosis.id}
                checked={diagnosisId === diagnosis.id}
                onChange={() => onDiagnosis(diagnosis.id)}
                className="accent-[#168d91]"
              />
              {diagnosis.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">
            Treatment plan
          </legend>
          {treatments.map((action) => (
            <label
              key={action.id}
              className={`flex cursor-pointer items-start gap-2 rounded-2xl p-3 text-xs font-bold ${treatmentIds.includes(action.id) ? "bg-[#eeeafd]" : "bg-white"}`}
            >
              <input
                type="checkbox"
                checked={treatmentIds.includes(action.id)}
                onChange={() => onToggleTreatment(action.id)}
                className="mt-0.5 accent-[#7968ce]"
              />
              <span>
                {action.label}
                {action.riskNote && (
                  <span className="mt-1 block text-[10px] font-medium leading-snug text-slate-500">
                    {action.riskNote}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black"
          >
            Keep investigating
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!diagnosisId}
            className="case-primary-button justify-center px-5 py-3"
          >
            Commit and see outcome
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BasicDebrief({
  game,
  caseDefinition,
  onRetry,
}: {
  game: GameState;
  caseDefinition: MedicalCase;
  onRetry: () => void;
}) {
  const debrief = createDebrief(game, caseDefinition);
  const index = CASE_BANK.findIndex((candidate) => candidate.id === caseDefinition.id);
  const nextCase = CASE_BANK[(index + 1) % CASE_BANK.length];
  const tone =
    debrief.outcome === "diagnosed"
      ? "bg-emerald-50 text-emerald-900"
      : debrief.outcome === "missed"
        ? "bg-amber-50 text-amber-900"
        : "bg-red-50 text-red-900";
  const ambroseExpression: AmbroseExpression =
    debrief.outcome === "diagnosed"
      ? "proud"
      : debrief.outcome === "missed"
        ? "encouraging"
        : "concerned";
  return (
    <div className="case-cockpit mx-auto max-w-5xl space-y-4 pb-8">
      <Link
        to="/cases"
        className="inline-flex items-center gap-2 text-sm font-black text-slate-600"
      >
        <ArrowLeft className="size-4" /> All cases
      </Link>
      <section
        className={`case-panel grid items-center gap-4 p-6 md:grid-cols-[1fr_auto] md:p-8 ${tone}`}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]">Case complete</p>
          <h1 className="mt-2 text-3xl font-black capitalize">
            {debrief.outcome.replace("_", " ")}
          </h1>
          <p className="mt-2 max-w-2xl font-bold leading-relaxed">{debrief.outcomeReason}</p>
          <div className="mt-5 inline-flex items-end gap-2 rounded-2xl bg-white/70 px-4 py-3">
            <span className="font-mono text-4xl font-black">{debrief.score.total}</span>
            <span className="pb-1 text-xs font-bold">/ {debrief.score.maximum}</span>
          </div>
        </div>
        <DrAmbrose expression={ambroseExpression} className="mx-auto w-40 max-w-full md:w-44" />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="case-panel p-5">
          <h2 className="text-lg font-black">Correct diagnosis</h2>
          <p className="mt-2 font-bold text-[#107b80]">{debrief.correctDiagnosis}</p>
          <h3 className="mt-5 text-sm font-black">Why not the tempting answer?</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{debrief.whyNotTempting}</p>
        </section>
        <section className="case-panel p-5">
          <h2 className="text-lg font-black">Teaching summary</h2>
          <ul className="mt-3 space-y-3">
            {debrief.teachingPoints.map((point, pointIndex) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#dff4f1] text-xs font-black text-[#107b80]">
                  {pointIndex + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="case-panel p-5">
        <h2 className="text-lg font-black">Timeline snapshot</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {debrief.timeline
            .filter((event) =>
              ["action", "deterioration", "commit", "outcome"].includes(event.type),
            )
            .map((event) => (
              <div key={event.id} className="w-44 shrink-0 rounded-2xl bg-slate-50 p-3">
                <p className="font-mono text-[10px] text-slate-400">+{event.timeMinute}m</p>
                <p className="mt-1 text-xs font-black">{event.title}</p>
                <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-slate-500">
                  {event.detail}
                </p>
              </div>
            ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-3 text-sm font-black"
        >
          <RotateCcw className="size-4" /> Retry
        </button>
        {nextCase && (
          <Link
            to="/cases/$caseId"
            params={{ caseId: nextCase.id }}
            className="case-primary-button px-5 py-3"
          >
            Next case <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <p className="text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice · Comparison statistics are mock data.
      </p>
    </div>
  );
}

function ScoreMeter({ score, maximum }: { score: number; maximum: number }) {
  const percent = Math.round((score / maximum) * 100);
  return (
    <div
      className="w-28 rounded-full bg-white px-3 py-2 shadow-sm"
      aria-label={`Efficiency score ${score} of ${maximum}`}
    >
      <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-500">
        <span>Efficiency</span>
        <span>{score}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#168d91] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

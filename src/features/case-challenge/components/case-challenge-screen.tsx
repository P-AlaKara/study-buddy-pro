import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  MessageCircleMore,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Stethoscope,
  Syringe,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  addToDifferential,
  applyAction,
  beginCase,
  cancelCommit,
  commitCase,
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
import type { ActionCategory, CaseAction, MedicalCase } from "../schema.js";
import { CaseDebrief } from "./case-debrief.js";
import { CaseImageViewer } from "./case-image-viewer.js";
import { DR_AMBROSE, DrAmbrose, type AmbroseExpression } from "./dr-ambrose.js";
import { PatientAvatar } from "./patient-avatar.js";

type RightTab = "chart" | "notes" | "differential";
type AvatarReaction = ActionCategory | null;

const categoryMeta: Record<
  ActionCategory,
  { label: string; icon: ComponentType<{ className?: string }>; tint: string }
> = {
  ask: { label: "Ask", icon: MessageCircleMore, tint: "bg-[#e8f8f5]" },
  examine: { label: "Examine", icon: Stethoscope, tint: "bg-[#eeeafd]" },
  test: { label: "Tests", icon: FlaskConical, tint: "bg-[#e8f3ff]" },
  treat: { label: "Treat", icon: Syringe, tint: "bg-[#fff0ec]" },
};

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
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [unreadFindings, setUnreadFindings] = useState(0);
  const [workspacePulse, setWorkspacePulse] = useState(false);
  const [findingNotice, setFindingNotice] = useState(false);
  const [typingActionId, setTypingActionId] = useState<string | null>(null);
  const [avatarReaction, setAvatarReaction] = useState<AvatarReaction>(null);
  const [error, setError] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const [mobileCoachOpen, setMobileCoachOpen] = useState(false);
  const [commitDiagnosis, setCommitDiagnosis] = useState("");
  const [commitTreatments, setCommitTreatments] = useState<string[]>([]);
  const [draggedDiagnosis, setDraggedDiagnosis] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousEvidenceCount = useRef(0);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGame(createInitialState(caseDefinition));
    setActionCategory("ask");
    setRightTab("chart");
    setWorkspaceOpen(false);
    setClinicalNotes("");
    setUnreadFindings(0);
    setWorkspacePulse(false);
    setFindingNotice(false);
    setTypingActionId(null);
    setAvatarReaction(null);
    setError("");
    setCommitOpen(false);
    setMobileCoachOpen(false);
    previousEvidenceCount.current = 0;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
  }, [caseDefinition]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (game.caseId !== caseDefinition.id) return;
    const currentCount = game.discoveredEvidence.length;
    const newlyAdded = currentCount - previousEvidenceCount.current;
    previousEvidenceCount.current = currentCount;
    if (newlyAdded <= 0) return;

    setFindingNotice(true);
    if (!(workspaceOpen && rightTab === "chart")) {
      setUnreadFindings((count) => count + newlyAdded);
      setWorkspacePulse(true);
    }
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    noticeTimer.current = setTimeout(() => setFindingNotice(false), 4200);
    pulseTimer.current = setTimeout(() => setWorkspacePulse(false), 2400);
  }, [caseDefinition.id, game.caseId, game.discoveredEvidence.length, rightTab, workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const isDrawer = window.matchMedia("(max-width: 1279px)").matches;
    const focusFrame = isDrawer
      ? requestAnimationFrame(() => {
          workspaceDialogRef.current?.querySelector<HTMLElement>("button")?.focus();
        })
      : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkspaceOpen(false);
        requestAnimationFrame(() => workspaceTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !isDrawer || !workspaceDialogRef.current) return;
      const focusable = [
        ...workspaceDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [workspaceOpen]);

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
    const action = actionById.get(actionId);
    safelyUpdate((current) => applyAction(current, caseDefinition, actionId));
    setTypingActionId(null);
    if (action) {
      setAvatarReaction(action.category);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
      reactionTimer.current = setTimeout(() => setAvatarReaction(null), 1100);
    }
  }

  function chooseAction(action: CaseAction) {
    if (typingActionId || game.phase !== "investigate") return;
    if (action.result.type === "patient_reply") {
      setTypingActionId(action.id);
      setAvatarReaction("ask");
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

  function openWorkspace(tab: RightTab = rightTab) {
    setRightTab(tab);
    setWorkspaceOpen(true);
    if (tab === "chart") setUnreadFindings(0);
    setWorkspacePulse(false);
  }

  function closeWorkspace() {
    setWorkspaceOpen(false);
    requestAnimationFrame(() => workspaceTriggerRef.current?.focus());
  }

  function askForHint() {
    safelyUpdate((current) => requestNextHint(current, caseDefinition));
  }

  function workspacePanel(showClose: boolean) {
    return (
      <ClinicalWorkspace
        game={game}
        caseDefinition={caseDefinition}
        activeTab={rightTab}
        notes={clinicalNotes}
        draggedDiagnosis={draggedDiagnosis}
        showClose={showClose}
        onClose={closeWorkspace}
        onTab={(tab) => {
          setRightTab(tab);
          if (tab === "chart") setUnreadFindings(0);
        }}
        onNotes={setClinicalNotes}
        onDragStart={setDraggedDiagnosis}
        onDrop={dropDiagnosis}
        onAdd={addDiagnosis}
        onMove={moveDiagnosis}
        onRemove={(diagnosisId) =>
          safelyUpdate((current) => removeFromDifferential(current, caseDefinition, diagnosisId))
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
        nextHint={nextHint}
        onHint={askForHint}
      />
    );
  }

  if (game.phase === "debrief") {
    return (
      <CaseDebrief
        game={game}
        caseDefinition={caseDefinition}
        onRetry={() => {
          setGame(createInitialState(caseDefinition));
          setActionCategory("ask");
          setRightTab("chart");
          setWorkspaceOpen(false);
          setClinicalNotes("");
          setUnreadFindings(0);
          setFindingNotice(false);
          setAvatarReaction(null);
          previousEvidenceCount.current = 0;
          setMobileCoachOpen(false);
          setError("");
        }}
      />
    );
  }

  return (
    <div className="case-cockpit -mx-1 pb-8 md:-mx-2">
      <header className="case-command-bar sticky top-0 z-30 mb-4 rounded-[22px] bg-[#fdfcf8]/96 p-3 shadow-[0_12px_32px_-20px_rgb(20_45_52/48%)] backdrop-blur md:top-[84px] md:p-4">
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
          <div className="hidden items-center gap-2 lg:flex">
            <ScoreMeter score={game.score.total} maximum={game.score.maximum} />
            <span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm">
              {game.hintsUsed.length} hints
            </span>
          </div>
          <button
            ref={workspaceTriggerRef}
            type="button"
            onClick={showCommit}
            disabled={game.phase !== "investigate"}
            className={`case-primary-button shrink-0 px-3 py-2.5 text-xs sm:px-4 sm:text-sm ${commitReadiness.ready ? "case-commit-ready" : ""}`}
          >
            Commit <span className="hidden sm:inline">diagnosis</span>
          </button>
        </div>

        <div className="mt-3 flex items-stretch gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            aria-expanded={workspaceOpen}
            onClick={() => (workspaceOpen ? closeWorkspace() : openWorkspace())}
            className={`case-workspace-trigger min-w-0 flex-1 ${workspacePulse ? "is-discovered" : ""}`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#dff4f1] text-[#107b80]">
              <ClipboardList className="size-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-xs font-black text-slate-800">Clinical workspace</span>
              <span className="hidden truncate text-[10px] font-bold text-slate-500 sm:block">
                Chart · Notes · Differentials
              </span>
            </span>
            {unreadFindings > 0 && (
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#168d91] text-[10px] font-black text-white">
                {unreadFindings}
              </span>
            )}
            {workspaceOpen ? (
              <PanelRightClose className="size-4 shrink-0 text-slate-500" />
            ) : (
              <PanelRightOpen className="size-4 shrink-0 text-slate-500" />
            )}
          </button>

          <button
            type="button"
            aria-expanded={mobileCoachOpen}
            aria-controls="case-coach-popover"
            onClick={() => setMobileCoachOpen((open) => !open)}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-amber-100 bg-[#fff8df] px-3 text-xs font-black text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">Ask {DR_AMBROSE.name}</span>
          </button>

          <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-3 text-white">
            <Clock3 className="size-4 text-white/55" />
            <div>
              <p className="hidden text-[8px] font-bold uppercase tracking-widest text-white/50 sm:block">
                Case clock
              </p>
              <p className="font-mono text-sm font-black sm:text-base">
                {formatCaseClock(game.timeMinute)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <CompactVitals game={game} />

      {findingNotice && (
        <div className="case-finding-notice" role="status" aria-live="polite">
          <span className="grid size-8 place-items-center rounded-full bg-[#dff4f1] text-[#107b80]">
            <Check className="size-4" />
          </span>
          <span className="text-sm font-black text-slate-800">Finding added to chart</span>
          <button type="button" onClick={() => openWorkspace("chart")}>
            View chart <ChevronRight className="size-4" />
          </button>
        </div>
      )}

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

      <div
        className={`grid items-start gap-4 lg:grid-cols-[270px_minmax(0,1fr)] ${workspaceOpen ? "xl:grid-cols-[250px_minmax(420px,1fr)_360px]" : "xl:grid-cols-[280px_minmax(0,1fr)]"}`}
      >
        <aside className="lg:sticky lg:top-[226px]">
          <PatientPanel
            caseDefinition={caseDefinition}
            game={game}
            typing={Boolean(typingActionId)}
            reaction={avatarReaction}
          />
        </aside>

        <main className="min-w-0">
          <section className="case-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#168d91]">
                  Live encounter
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Clinical interaction</h2>
              </div>
              <span className="rounded-full bg-[#e8f8f5] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#107b80]">
                {game.phase === "hook" ? "Handover" : "In progress"}
              </span>
            </div>
            <InteractionFeed
              caseDefinition={caseDefinition}
              game={game}
              actionById={actionById}
              typingAction={typingActionId ? actionById.get(typingActionId) : undefined}
              onStart={startCase}
            />
          </section>

          <section
            className="case-panel mt-4 overflow-hidden"
            aria-labelledby="clinical-actions-title"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Your next move
                </p>
                <h2 id="clinical-actions-title" className="text-base font-black text-slate-900">
                  Clinical actions
                </h2>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {completedIds.size}/{caseDefinition.actions.length} completed
              </span>
            </div>
            <div
              className="grid grid-cols-4 gap-1 border-y border-slate-100 bg-slate-50/70 p-2"
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
                    className={`case-action-tab flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-black sm:flex-row sm:justify-center sm:text-xs ${actionCategory === category ? "is-active" : ""}`}
                  >
                    <Icon className="size-4" /> {meta.label}
                  </button>
                );
              })}
            </div>
            <div className="grid max-h-[350px] gap-2 overflow-y-auto p-3 sm:grid-cols-2">
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

        {workspaceOpen && (
          <aside className="sticky top-[226px] hidden min-w-0 xl:block">
            {workspacePanel(false)}
          </aside>
        )}
      </div>

      <footer className="mt-5 text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice · Content status:{" "}
        {caseDefinition.reviewStatus === "clinician_reviewed"
          ? "clinician reviewed"
          : "clinician review required"}
      </footer>

      {workspaceOpen && (
        <div className="case-workspace-mobile xl:hidden">
          <button
            type="button"
            className="case-workspace-scrim"
            onClick={closeWorkspace}
            aria-label="Close clinical workspace"
          />
          <div
            ref={workspaceDialogRef}
            className="case-workspace-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Clinical workspace"
          >
            {workspacePanel(true)}
          </div>
        </div>
      )}

      {mobileCoachOpen && (
        <div
          id="case-coach-popover"
          role="region"
          aria-label={`${DR_AMBROSE.name} hint panel`}
          className="case-coach-popover"
        >
          <button
            type="button"
            onClick={() => setMobileCoachOpen(false)}
            className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-2 text-slate-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
            aria-label="Close coach"
          >
            <X className="size-4" />
          </button>
          <HintPanel game={game} nextHint={nextHint} onHint={askForHint} />
        </div>
      )}

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
  typing,
  reaction,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  reaction: AvatarReaction;
}) {
  const activeReaction = typing ? "ask" : reaction;
  const ReactionIcon = activeReaction ? categoryMeta[activeReaction].icon : Activity;
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  return (
    <section className="case-panel overflow-hidden">
      <div className="bg-gradient-to-b from-[#d9f4f0] to-[#f8fcfb] p-4">
        <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 lg:block lg:text-center">
          <div className="relative mx-auto w-full max-w-32 lg:max-w-48">
            <PatientAvatar
              patient={caseDefinition.patient}
              expression={game.patientExpression}
              respiratoryRate={game.vitals.rr}
              reaction={activeReaction}
            />
            {activeReaction && activeReaction !== "ask" && (
              <span className="case-avatar-reaction" aria-hidden="true">
                <ReactionIcon className="size-4" />
              </span>
            )}
          </div>
          <div className="min-w-0 lg:mt-2">
            <div className="mb-2 flex flex-wrap items-center gap-2 lg:justify-center">
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${critical ? "bg-red-100 text-red-700" : "bg-white/85 text-[#107b80]"}`}
              >
                {game.patientExpression.replaceAll("_", " ")}
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                {caseDefinition.patient.sex}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {caseDefinition.patient.name}, {caseDefinition.patient.age}
            </h2>
            <p className="mt-1 text-xs font-black leading-relaxed text-slate-700">
              {caseDefinition.patient.chiefComplaint}
            </p>
            <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-500">
              {caseDefinition.patient.personality}
            </p>
            {typing && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#107b80] shadow-sm">
                Speaking <TypingDots />
              </div>
            )}
          </div>
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
  const traceDuration = Math.max(0.65, 120 / Math.max(game.vitals.hr, 1));
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
          style={{ animationDuration: `${traceDuration}s` }}
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
    <div className="mb-3 grid grid-cols-5 gap-1 rounded-2xl bg-[#17242c] p-2 font-mono text-white shadow-lg lg:hidden">
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

function InteractionFeed({
  caseDefinition,
  game,
  actionById,
  typingAction,
  onStart,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  actionById: Map<string, CaseAction>;
  typingAction: CaseAction | undefined;
  onStart: () => void;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [followingLatest, setFollowingLatest] = useState(true);
  const visibleEvents = game.timeline.filter((event) =>
    ["hook", "case_started", "action", "deterioration", "warning"].includes(event.type),
  );

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const feed = feedRef.current;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior });
    setFollowingLatest(true);
  }

  useEffect(() => {
    if (!followingLatest) return;
    const frame = requestAnimationFrame(() => scrollToLatest("smooth"));
    return () => cancelAnimationFrame(frame);
  }, [game.timeline.length, typingAction?.id, followingLatest]);

  return (
    <div className="relative">
      <div
        ref={feedRef}
        className="case-interaction-feed max-h-[520px] min-h-[380px] overflow-y-auto px-4 py-5 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chronological clinical interaction"
        onScroll={(event) => {
          const target = event.currentTarget;
          const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
          setFollowingLatest(distanceFromBottom < 56);
        }}
      >
        <ol className="mx-auto max-w-3xl space-y-4">
          {visibleEvents.map((event) => {
            if (event.type === "hook") {
              return (
                <li key={event.id} className="case-feed-entry">
                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#107b80]">
                        <HeartPulse className="size-4" /> Opening presentation
                      </span>
                      <time className="font-mono text-[10px] font-bold text-slate-400">
                        +{event.timeMinute}m
                      </time>
                    </div>
                    <p className="mt-3 text-base font-bold leading-relaxed text-slate-800 sm:text-lg">
                      {event.detail}
                    </p>
                    {game.phase === "hook" && (
                      <button
                        type="button"
                        onClick={onStart}
                        className="case-primary-button mt-5 px-5 py-3 text-sm"
                      >
                        Take over the case <ArrowRight className="size-4" />
                      </button>
                    )}
                  </article>
                </li>
              );
            }

            if (event.type === "case_started") {
              return (
                <li key={event.id} className="case-feed-entry flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Encounter started · +{event.timeMinute}m
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </li>
              );
            }

            if (event.type === "action" && event.actionId) {
              const action = actionById.get(event.actionId);
              if (!action) return null;
              const MetaIcon = categoryMeta[action.category].icon;
              return (
                <li key={event.id} className="case-feed-entry space-y-2.5">
                  <article className="ml-auto max-w-[92%] rounded-[18px] rounded-br-md bg-slate-900 px-4 py-3 text-white sm:max-w-[78%]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
                        <MetaIcon className="size-3.5" /> You ·{" "}
                        {actionCategoryLabel(action.category)}
                      </p>
                      <time className="font-mono text-[10px] text-white/40">
                        +{event.timeMinute}m
                      </time>
                    </div>
                    <p className="mt-1.5 text-sm font-bold leading-relaxed">{action.label}</p>
                  </article>
                  <ActionResultEntry action={action} caseDefinition={caseDefinition} />
                </li>
              );
            }

            return (
              <li key={event.id} className="case-feed-entry">
                <article
                  className={`flex gap-3 rounded-[18px] border p-3 ${event.type === "deterioration" || event.type === "warning" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black">{event.title}</p>
                      <time className="font-mono text-[10px] opacity-55">+{event.timeMinute}m</time>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed opacity-80">{event.detail}</p>
                  </div>
                </article>
              </li>
            );
          })}

          {game.phase === "investigate" && game.completedActions.length === 0 && !typingAction && (
            <li className="case-feed-entry py-3 text-center text-sm font-bold text-slate-500">
              Choose an action below to begin your assessment.
            </li>
          )}

          {typingAction && (
            <li className="case-feed-entry space-y-2.5">
              <article className="ml-auto max-w-[92%] rounded-[18px] rounded-br-md bg-slate-900 px-4 py-3 text-white sm:max-w-[78%]">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
                  <MessageCircleMore className="size-3.5" /> You · History taking
                </p>
                <p className="mt-1.5 text-sm font-bold">{typingAction.label}</p>
              </article>
              <article className="mr-auto flex max-w-[92%] items-center gap-3 rounded-[18px] rounded-bl-md bg-[#e8f8f5] px-4 py-3 sm:max-w-[78%]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#107b80] shadow-sm">
                  <UserRound className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#107b80]">
                    Patient · {caseDefinition.patient.name}
                  </p>
                  <TypingDots className="mt-2" />
                </div>
              </article>
            </li>
          )}
        </ol>
      </div>
      {!followingLatest && (
        <button
          type="button"
          onClick={() => scrollToLatest()}
          className="absolute bottom-3 right-3 rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
        >
          Latest interaction <ChevronDown className="ml-1 inline size-3.5" />
        </button>
      )}
    </div>
  );
}

function actionCategoryLabel(category: ActionCategory): string {
  if (category === "ask") return "History taking";
  if (category === "examine") return "Physical examination";
  if (category === "test") return "Diagnostic investigation";
  return "Treatment";
}

function ActionResultEntry({
  action,
  caseDefinition,
}: {
  action: CaseAction;
  caseDefinition: MedicalCase;
}) {
  const asset = action.result.assetId
    ? caseDefinition.assets.find((candidate) => candidate.id === action.result.assetId)
    : undefined;
  const isPatientReply = action.result.type === "patient_reply";
  const title = isPatientReply
    ? `Patient · ${caseDefinition.patient.name}`
    : action.category === "examine"
      ? "Examination findings"
      : action.category === "test"
        ? "Investigation result"
        : action.category === "treat"
          ? "Treatment response"
          : "Clinical finding";

  return (
    <article
      className={`mr-auto max-w-[96%] rounded-[18px] rounded-bl-md border p-4 sm:max-w-[88%] ${isPatientReply ? "border-[#c8e9e4] bg-[#e8f8f5]" : "border-slate-200 bg-white shadow-[0_8px_22px_-20px_rgb(15_23_42/45%)]"}`}
    >
      <div className="flex gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full ${isPatientReply ? "bg-white text-[#107b80]" : "bg-slate-100 text-slate-600"}`}
        >
          {isPatientReply ? <UserRound className="size-4" /> : <Activity className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-800">
            {isPatientReply ? `“${action.result.content}”` : action.result.content}
          </p>
        </div>
      </div>

      {action.result.type === "lab_table" && action.result.labs && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {action.result.labs.map((lab) => (
                <tr key={lab.test} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">{lab.test}</td>
                  <td
                    className={`px-3 py-2 font-mono font-black ${lab.flag && lab.flag !== "normal" ? "text-red-600" : "text-slate-700"}`}
                  >
                    {lab.result}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{lab.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {asset && (action.result.type === "image" || action.result.type === "ecg") && (
        <div className="mt-3 overflow-hidden rounded-xl">
          <CaseImageViewer
            asset={asset}
            assetPath={`/cases/${caseDefinition.slug}/${asset.filename}`}
            result={action.result}
          />
        </div>
      )}
    </article>
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

function ClinicalWorkspace({
  game,
  caseDefinition,
  activeTab,
  notes,
  draggedDiagnosis,
  showClose,
  onClose,
  onTab,
  onNotes,
  onDragStart,
  onDrop,
  onAdd,
  onMove,
  onRemove,
  onConfidence,
  onTag,
  nextHint,
  onHint,
}: {
  game: GameState;
  caseDefinition: MedicalCase;
  activeTab: RightTab;
  notes: string;
  draggedDiagnosis: string | null;
  showClose: boolean;
  onClose: () => void;
  onTab: (tab: RightTab) => void;
  onNotes: (notes: string) => void;
  onDragStart: (id: string | null) => void;
  onDrop: (id: string) => void;
  onAdd: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onConfidence: (id: string, confidence: number) => void;
  onTag: (diagnosisId: string, evidenceId: string, relationship: "supports" | "against") => void;
  nextHint: MedicalCase["hints"][number] | undefined;
  onHint: () => void;
}) {
  const tabs: Array<{
    id: RightTab;
    label: string;
    icon: ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: "chart", label: "Chart", icon: ClipboardList, count: game.discoveredEvidence.length },
    { id: "notes", label: "Notes", icon: NotebookPen },
    { id: "differential", label: "Differentials", icon: FileText, count: game.differential.length },
  ];

  return (
    <section className="case-panel case-workspace-panel flex h-[calc(100vh-246px)] min-h-[500px] max-h-[720px] flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#dff4f1] text-[#107b80]">
          <ClipboardList className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-slate-900">Clinical workspace</h2>
          <p className="mt-0.5 text-[10px] font-bold text-slate-500">
            Chart · Notes · Differentials
          </p>
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91]"
            aria-label="Close clinical workspace"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div
        className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-slate-50/70 p-2"
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTab(tab.id)}
              className={`min-w-0 rounded-xl px-1 py-2 text-[10px] font-black transition-colors ${activeTab === tab.id ? "bg-white text-[#107b80] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
            >
              <Icon className="mx-auto mb-1 size-4" />
              <span className="block truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-1.5 text-[8px] text-slate-500">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "chart" && <ChartPanel game={game} caseDefinition={caseDefinition} />}
        {activeTab === "notes" && <NotesPanel notes={notes} onNotes={onNotes} />}
        {activeTab === "differential" && (
          <DifferentialBoard
            game={game}
            caseDefinition={caseDefinition}
            draggedDiagnosis={draggedDiagnosis}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onAdd={onAdd}
            onMove={onMove}
            onRemove={onRemove}
            onConfidence={onConfidence}
            onTag={onTag}
          />
        )}
      </div>
      <HintPanel game={game} nextHint={nextHint} onHint={onHint} />
    </section>
  );
}

function ChartPanel({ game, caseDefinition }: { game: GameState; caseDefinition: MedicalCase }) {
  const records = game.completedActions.flatMap((entry) => {
    const action = caseDefinition.actions.find((candidate) => candidate.id === entry.actionId);
    return action ? [{ entry, action }] : [];
  });
  const sections: Array<{
    category: ActionCategory;
    title: string;
    empty: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      category: "ask",
      title: "History",
      empty: "No history recorded yet.",
      icon: MessageCircleMore,
    },
    {
      category: "examine",
      title: "Examination findings",
      empty: "No examination findings recorded yet.",
      icon: Stethoscope,
    },
    {
      category: "test",
      title: "Investigations",
      empty: "No investigation results recorded yet.",
      icon: FlaskConical,
    },
    {
      category: "treat",
      title: "Treatment record",
      empty: "No treatments recorded yet.",
      icon: Syringe,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Recorded information</h3>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
            Findings appear here only after you discover them.
          </p>
        </div>
        <span className="rounded-full bg-[#e8f8f5] px-2.5 py-1 text-[10px] font-black text-[#107b80]">
          {game.discoveredEvidence.length} findings
        </span>
      </div>

      {sections.map((section) => {
        const items = records.filter(({ action }) => action.category === section.category);
        const Icon = section.icon;
        return (
          <section key={section.category} aria-labelledby={`chart-${section.category}`}>
            <div className="flex items-center gap-2">
              <Icon className="size-3.5 text-slate-400" />
              <h4
                id={`chart-${section.category}`}
                className="text-[10px] font-black uppercase tracking-wider text-slate-500"
              >
                {section.title}
              </h4>
              <span className="ml-auto text-[9px] font-black text-slate-400">{items.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {items.map(({ entry, action }) => (
                <article
                  key={action.id}
                  className={`rounded-2xl border p-3 transition-colors ${game.latestActionId === action.id && action.clueTier !== "none" ? "case-new-chart-entry border-[#8fcfca] bg-[#effaf8]" : "border-slate-100 bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-black text-slate-800">{action.label}</p>
                    <time className="shrink-0 font-mono text-[9px] text-slate-400">
                      +{entry.completedAtMinute}m
                    </time>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                    {action.result.content}
                  </p>
                  {action.category === "test" && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#107b80]">
                      <Check className="size-3" /> Result recorded
                    </span>
                  )}
                </article>
              ))}
              {items.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                  {section.empty}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NotesPanel({ notes, onNotes }: { notes: string; onNotes: (notes: string) => void }) {
  const notesId = useId();
  return (
    <div>
      <label htmlFor={notesId} className="text-sm font-black text-slate-900">
        Clinical notes
      </label>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Capture your reasoning, questions, and management priorities. Notes stay available while you
        work through this case.
      </p>
      <textarea
        id={notesId}
        value={notes}
        onChange={(event) => onNotes(event.target.value)}
        placeholder="Write your clinical notes…"
        className="mt-3 min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-[#168d91] focus:bg-white focus:ring-4 focus:ring-[#168d91]/10"
      />
      <p className="mt-2 text-right text-[10px] font-bold text-slate-400">
        {notes.length} characters
      </p>
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
  const diagnosisSelectId = useId();
  const ranked = [...game.differential].sort((a, b) => a.rank - b.rank);
  const available = caseDefinition.differential.filter(
    (diagnosis) => !ranked.some((entry) => entry.diagnosisId === diagnosis.id),
  );
  return (
    <div>
      <label
        className="text-xs font-black uppercase tracking-wider text-slate-500"
        htmlFor={diagnosisSelectId}
      >
        Add hypothesis
      </label>
      <div className="mt-2 flex gap-2">
        <select
          id={diagnosisSelectId}
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

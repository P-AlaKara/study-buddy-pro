import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronRight, X } from "lucide-react";
import {
  addToDifferential,
  applyAction,
  beginCase,
  cancelCommit,
  commitCase,
  createInitialState,
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
import { clearEncounter, loadEncounter, saveEncounter } from "../use-case-persistence.js";
import { CaseDebrief } from "./case-debrief.js";
import { CasePanel } from "./case-panel.js";
import { ClinicalDock } from "./clinical-dock.js";
import { ClinicalWorkspace, HintPanel } from "./clinical-workspace.js";
import { CommitDialog } from "./commit-dialog.js";
import { DR_AMBROSE, DrAmbrose } from "./dr-ambrose.js";
import { EncounterTopBar } from "./encounter-top-bar.js";
import { InteractionHistory } from "./interaction-history.js";
import { VitalsMonitor } from "./vitals-strip.js";
import { PatientStatusChips, WardBackdrop } from "./ward-backdrop.js";
import {
  engineMessage,
  typingDelay,
  workspaceToolMeta,
  type AvatarReaction,
  type RightTab,
} from "./case-constants.js";

export function CaseChallengeScreen({ caseDefinition }: { caseDefinition: MedicalCase }) {
  const [game, setGame] = useState<GameState>(() => createInitialState(caseDefinition));
  const [actionCategory, setActionCategory] = useState<ActionCategory>("ask");
  const [activeTool, setActiveTool] = useState<RightTab>("chart");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [unreadFindings, setUnreadFindings] = useState(0);
  const [findingNotice, setFindingNotice] = useState(false);
  const [typingActionId, setTypingActionId] = useState<string | null>(null);
  const [avatarReaction, setAvatarReaction] = useState<AvatarReaction>(null);
  const [error, setError] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDiagnosis, setCommitDiagnosis] = useState("");
  const [commitTreatments, setCommitTreatments] = useState<string[]>([]);
  const [draggedDiagnosis, setDraggedDiagnosis] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [casePanelOpen, setCasePanelOpen] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousEvidenceCount = useRef(0);
  // Null until the encounter for the current case has been resolved (restored
  // from storage or freshly created); gates autosave so a fresh initial state
  // never overwrites saved progress before we've read it.
  const hydratedCaseRef = useRef<string | null>(null);

  function resetEphemeralUi() {
    setActionCategory("ask");
    setActiveTool("chart");
    setWorkspaceOpen(false);
    setUnreadFindings(0);
    setFindingNotice(false);
    setTypingActionId(null);
    setAvatarReaction(null);
    setError("");
    setCommitOpen(false);
    setHistoryOpen(false);
    setCoachOpen(false);
    setTrayOpen(false);
    setCasePanelOpen(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }

  // Resolve the encounter for the active case: restore saved progress (full
  // timeline + notes) if present, otherwise start fresh. Runs on mount and on
  // case change, so it is the single source of truth for (re)initialisation —
  // no competing reset effect to race with the restore.
  useEffect(() => {
    const saved = loadEncounter(caseDefinition.id);
    const firstMount = hydratedCaseRef.current === null;
    if (saved) {
      // A reload mid-commit would otherwise leave the encounter frozen with the
      // dialog closed; reopen investigation instead.
      const restored =
        saved.game.phase === "commit" ? cancelCommit(saved.game, caseDefinition) : saved.game;
      setGame(restored);
      setClinicalNotes(saved.notes);
      previousEvidenceCount.current = restored.discoveredEvidence.length;
    } else if (!firstMount) {
      setGame(createInitialState(caseDefinition));
      setClinicalNotes("");
      previousEvidenceCount.current = 0;
    }
    resetEphemeralUi();
    hydratedCaseRef.current = caseDefinition.id;
  }, [caseDefinition]);

  // Autosave the live encounter once hydration for this case has settled.
  useEffect(() => {
    if (hydratedCaseRef.current !== caseDefinition.id) return;
    saveEncounter(caseDefinition.id, game, clinicalNotes);
  }, [caseDefinition.id, game, clinicalNotes]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // Surface a "finding added" toast + unread badge when new evidence is revealed.
  useEffect(() => {
    if (game.caseId !== caseDefinition.id) return;
    const currentCount = game.discoveredEvidence.length;
    const newlyAdded = currentCount - previousEvidenceCount.current;
    previousEvidenceCount.current = currentCount;
    if (newlyAdded <= 0) return;

    setFindingNotice(true);
    if (!(workspaceOpen && activeTool === "chart")) {
      setUnreadFindings((count) => count + newlyAdded);
    }
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setFindingNotice(false), 4200);
  }, [caseDefinition.id, game.caseId, game.discoveredEvidence.length, activeTool, workspaceOpen]);

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

  function openWorkspace(tool: RightTab = activeTool) {
    setActiveTool(tool);
    setWorkspaceOpen(true);
    if (tool === "chart") setUnreadFindings(0);
  }

  function closeWorkspace() {
    setWorkspaceOpen(false);
  }

  function askForHint() {
    safelyUpdate((current) => requestNextHint(current, caseDefinition));
  }

  /** Tap a dock category to open its tray; tap it again to put the ward back. */
  function selectCategory(category: ActionCategory) {
    if (trayOpen && actionCategory === category) {
      setTrayOpen(false);
      return;
    }
    setActionCategory(category);
    setTrayOpen(true);
  }

  const workspacePanel = (
    <ClinicalWorkspace
      game={game}
      caseDefinition={caseDefinition}
      tool={activeTool}
      notes={clinicalNotes}
      draggedDiagnosis={draggedDiagnosis}
      onClose={closeWorkspace}
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
    />
  );

  if (game.phase === "debrief") {
    return (
      <CaseDebrief
        game={game}
        caseDefinition={caseDefinition}
        onRetry={() => {
          clearEncounter(caseDefinition.id);
          setGame(createInitialState(caseDefinition));
          setClinicalNotes("");
          previousEvidenceCount.current = 0;
          resetEphemeralUi();
        }}
      />
    );
  }

  const casePanel = (className: string) => (
    <CasePanel
      caseDefinition={caseDefinition}
      game={game}
      onOpenWorkspace={(tool) => {
        setCasePanelOpen(false);
        openWorkspace(tool);
      }}
      unreadFindings={unreadFindings}
      className={className}
    />
  );

  const historyPanel = (expandControls: boolean, className: string) => (
    <InteractionHistory
      caseDefinition={caseDefinition}
      game={game}
      actionById={actionById}
      typingAction={typingActionId ? actionById.get(typingActionId) : undefined}
      onStart={startCase}
      expanded={expandControls ? historyExpanded : undefined}
      onToggleExpand={expandControls ? () => setHistoryExpanded((open) => !open) : undefined}
      className={className}
    />
  );

  return (
    <div className="case-cockpit case-immersive">
      {/* The ward itself — a static render; everything below floats over it */}
      <WardBackdrop caseDefinition={caseDefinition} />

      <div className="case-immersive-ui" data-history={historyExpanded ? "expanded" : "normal"}>
        <div className="case-ui-top">
          <EncounterTopBar
            caseDefinition={caseDefinition}
            game={game}
            commitReady={commitReadiness.ready}
            onCommit={showCommit}
            onOpenHistory={() => setHistoryOpen(true)}
            onToggleCoach={() => setCoachOpen((open) => !open)}
            coachOpen={coachOpen}
          />
        </div>

        {/* Bedside monitor strip under the top bar */}
        <div className="case-ui-vitals">
          <VitalsMonitor game={game} />
        </div>

        {/* Case identity + tools (desktop) */}
        <aside className="case-ui-left">{casePanel("min-h-0 overflow-y-auto")}</aside>

        {/* Over the patient: status, errors, and the phone-sized patient chip */}
        <div className="case-ui-center">
          <PatientStatusChips game={game} typing={Boolean(typingActionId)} />
          {error && (
            <div
              role="alert"
              className="case-float-panel flex items-center gap-2 px-4 py-3 text-sm font-bold text-[var(--case-critical)]"
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
          <button
            type="button"
            onClick={() => setCasePanelOpen(true)}
            className="case-float-panel case-patient-chip lg:hidden"
            aria-label={`Patient ${caseDefinition.patient.name}: open case details`}
          >
            <span className="flex items-baseline gap-2">
              <span className="font-display text-base font-black text-slate-900">
                {caseDefinition.patient.name}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {caseDefinition.patient.age} · {caseDefinition.patient.sex}
              </span>
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[12px] font-bold leading-snug text-slate-600">
              {caseDefinition.patient.chiefComplaint}
            </span>
          </button>
        </div>

        {/* Complete history (desktop) */}
        <aside className="case-ui-right">{historyPanel(true, "min-h-0 flex-1")}</aside>

        {/* Clinical actions */}
        <div className="case-ui-bottom">
          <ClinicalDock
            caseDefinition={caseDefinition}
            game={game}
            actions={actions}
            category={actionCategory}
            trayOpen={trayOpen}
            completedIds={completedIds}
            busy={Boolean(typingActionId)}
            onSelectCategory={selectCategory}
            onCloseTray={() => setTrayOpen(false)}
            onChoose={chooseAction}
            onStart={startCase}
          />
        </div>

        <div className="case-ui-commit">
          <button
            type="button"
            onClick={showCommit}
            disabled={game.phase !== "investigate"}
            className={`case-primary-button px-6 py-3.5 text-base ${commitReadiness.ready ? "case-commit-ready" : ""}`}
          >
            <span className="grid size-6 place-items-center rounded-full bg-white/20">
              <Check className="size-4" />
            </span>
            Commit diagnosis
          </button>
        </div>
      </div>

      {findingNotice && (
        <div className="case-finding-notice" role="status" aria-live="polite">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--case-mint-soft)] text-[var(--case-mint-ink)]">
            <Check className="size-4" />
          </span>
          <span className="text-sm font-black text-slate-800">Finding added to chart</span>
          <button type="button" onClick={() => openWorkspace("chart")}>
            View chart <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Dr. Ambrose coach — the single home for hints, at every breakpoint */}
      <div className="case-coach-anchor">
        {coachOpen && (
          <div className="case-coach-popover mb-2 !static w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl">
            <HintPanel game={game} nextHint={nextHint} onHint={askForHint} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setCoachOpen((open) => !open)}
          aria-expanded={coachOpen}
          aria-label={`Request a hint from ${DR_AMBROSE.name}`}
          className="hidden items-center gap-2 rounded-full border border-[var(--case-yellow)] lg:flex bg-[var(--case-yellow-soft)] py-1 pl-1 pr-2 shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-yellow)] sm:pr-3"
        >
          <DrAmbrose expression="thinking" variant="logo" className="w-10 shrink-0" />
          <span className="hidden text-xs font-black text-[var(--case-yellow-ink)] sm:inline">
            Request a hint
          </span>
        </button>
      </div>

      {/* Case panel sheet (tablet / mobile) */}
      <MobileSheet
        open={casePanelOpen}
        label="Case details"
        onClose={() => setCasePanelOpen(false)}
      >
        {casePanel("h-full overflow-y-auto rounded-none border-0 bg-white shadow-none")}
      </MobileSheet>

      {/* History drawer (tablet / mobile) */}
      <MobileSheet
        open={historyOpen}
        label="Interaction history"
        onClose={() => setHistoryOpen(false)}
      >
        {historyPanel(false, "h-full rounded-none border-0 shadow-none")}
      </MobileSheet>

      {/* Clinical workspace drawer — one tool at a time */}
      <MobileSheet
        open={workspaceOpen}
        label={workspaceToolMeta[activeTool].label}
        onClose={closeWorkspace}
        withCloseRow={false}
      >
        {workspacePanel}
      </MobileSheet>

      <CommitDialog
        open={commitOpen}
        caseDefinition={caseDefinition}
        diagnosisId={commitDiagnosis}
        treatmentIds={commitTreatments}
        readiness={commitReadiness}
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

/** Accessible bottom-sheet used for the Zone A, Zone C and workspace drawers. */
function MobileSheet({
  open,
  label,
  onClose,
  withCloseRow = true,
  children,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  /** Panels that render their own header/back button opt out of this row. */
  withCloseRow?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Callers pass a fresh `onClose` every render. Read it through a ref so the
  // effect below runs only when the sheet opens; otherwise every keystroke in a
  // child input (e.g. clinical notes) re-runs it and steals focus.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("button, [href], textarea, input, select")
        ?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="case-workspace-mobile">
      <button
        type="button"
        className="case-workspace-scrim"
        onClick={onClose}
        aria-label={`Close ${label.toLowerCase()}`}
      />
      <div
        ref={dialogRef}
        className="case-workspace-drawer flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {withCloseRow && (
          <div className="flex justify-end px-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
              aria-label={`Close ${label.toLowerCase()}`}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

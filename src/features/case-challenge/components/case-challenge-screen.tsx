import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  History,
  PanelLeft,
  X,
} from "lucide-react";
import {
  addToDifferential,
  applyAction,
  beginCase,
  cancelCommit,
  commitCase,
  createInitialState,
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
import { clearEncounter, loadEncounter, saveEncounter } from "../use-case-persistence.js";
import { CaseDebrief } from "./case-debrief.js";
import { CaseSidebar } from "./case-sidebar.js";
import { ClinicalWorkspace, HintPanel } from "./clinical-workspace.js";
import { CommitDialog } from "./commit-dialog.js";
import { DR_AMBROSE, DrAmbrose } from "./dr-ambrose.js";
import { InteractionHistory } from "./interaction-history.js";
import { PatientStage } from "./patient-stage.js";
import { VitalsStrip } from "./vitals-strip.js";
import {
  categoryMeta,
  engineMessage,
  typingDelay,
  type AvatarReaction,
  type RightTab,
} from "./case-constants.js";
import { ActionCard, ScoreMeter } from "./case-ui.js";

export function CaseChallengeScreen({ caseDefinition }: { caseDefinition: MedicalCase }) {
  const [game, setGame] = useState<GameState>(() => createInitialState(caseDefinition));
  const [actionCategory, setActionCategory] = useState<ActionCategory>("ask");
  const [rightTab, setRightTab] = useState<RightTab>("chart");
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

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
    setRightTab("chart");
    setWorkspaceOpen(false);
    setUnreadFindings(0);
    setFindingNotice(false);
    setTypingActionId(null);
    setAvatarReaction(null);
    setError("");
    setCommitOpen(false);
    setSidebarOpen(false);
    setHistoryOpen(false);
    setCoachOpen(false);
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
      setGame(saved.game);
      setClinicalNotes(saved.notes);
      previousEvidenceCount.current = saved.game.discoveredEvidence.length;
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
    if (!(workspaceOpen && rightTab === "chart")) {
      setUnreadFindings((count) => count + newlyAdded);
    }
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setFindingNotice(false), 4200);
  }, [caseDefinition.id, game.caseId, game.discoveredEvidence.length, rightTab, workspaceOpen]);

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
    setSidebarOpen(false);
    if (tab === "chart") setUnreadFindings(0);
  }

  function closeWorkspace() {
    setWorkspaceOpen(false);
  }

  function askForHint() {
    safelyUpdate((current) => requestNextHint(current, caseDefinition));
  }

  function selectStage(category: ActionCategory) {
    setActionCategory(category);
    setSidebarOpen(false);
  }

  const workspacePanel = (showClose: boolean) => (
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

  const sidebar = (
    <CaseSidebar
      caseDefinition={caseDefinition}
      game={game}
      activeCategory={actionCategory}
      onSelectStage={selectStage}
      onOpenWorkspace={openWorkspace}
      unreadFindings={unreadFindings}
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
    <div className="case-cockpit -mx-1 pb-8 md:-mx-2">
      <header className="case-command-bar sticky top-0 z-30 mb-4 rounded-[22px] bg-white/95 p-3 shadow-[0_12px_32px_-20px_rgb(37_48_68/35%)] backdrop-blur md:top-[84px]">
        <div className="flex items-center gap-2.5">
          <Link
            to="/cases"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
            aria-label="Back to all cases"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] lg:hidden"
            aria-label="Open case tools"
          >
            <PanelLeft className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--case-accent-ink)]">
              {caseDefinition.setting}
            </p>
            <h1 className="truncate font-display text-base font-black text-slate-900 md:text-lg">
              {caseDefinition.title}
            </h1>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <ScoreMeter score={game.score.total} maximum={game.score.maximum} />
            <span className="rounded-full border border-[var(--case-border)] bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm">
              {game.hintsUsed.length} hints
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-2 font-mono text-sm font-black text-white">
              {formatCaseClock(game.timeMinute)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="relative grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] xl:hidden"
            aria-label="Open interaction history"
          >
            <History className="size-4" />
          </button>

          <button
            type="button"
            onClick={showCommit}
            disabled={game.phase !== "investigate"}
            className={`case-primary-button shrink-0 px-3 py-2.5 text-xs sm:px-4 sm:text-sm ${commitReadiness.ready ? "case-commit-ready" : ""}`}
          >
            Commit <span className="hidden sm:inline">diagnosis</span>
          </button>
        </div>
      </header>

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

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-2xl bg-[var(--case-critical-soft)] px-4 py-3 text-sm font-bold text-[var(--case-critical)]"
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

      <div className="case-shell" data-history={historyExpanded ? "expanded" : "normal"}>
        {/* Zone A — clinical workspace tools (desktop) */}
        <aside className="case-zone-sticky hidden self-start lg:block">{sidebar}</aside>

        {/* Zone B — patient interaction area */}
        <main className="min-w-0 space-y-4">
          <PatientStage
            caseDefinition={caseDefinition}
            game={game}
            typing={Boolean(typingActionId)}
            reaction={avatarReaction}
          />

          <VitalsStrip game={game} />

          <section className="case-panel overflow-hidden" aria-labelledby="clinical-actions-title">
            {game.phase === "hook" ? (
              <div className="p-5 sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--case-accent-ink)]">
                  Handover
                </p>
                <h2 id="clinical-actions-title" className="mt-1 text-lg font-black text-slate-900">
                  You’re taking over this patient
                </h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
                  {caseDefinition.intro}
                </p>
                <button
                  type="button"
                  onClick={startCase}
                  className="case-primary-button mt-4 px-5 py-3 text-sm"
                >
                  Take over the case <ArrowRight className="size-4" />
                </button>
              </div>
            ) : (
              <>
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
                  className="grid grid-cols-4 gap-1 border-y border-[var(--case-border)] bg-slate-50/70 p-2"
                  role="tablist"
                  aria-label="Clinical interaction categories"
                >
                  {(Object.keys(categoryMeta) as ActionCategory[]).map((category) => {
                    const meta = categoryMeta[category];
                    const Icon = meta.icon;
                    const active = actionCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActionCategory(category)}
                        style={
                          {
                            "--cat": meta.color,
                            color: active ? meta.ink : undefined,
                          } as CSSProperties
                        }
                        className={`case-interaction-category flex min-w-0 flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-[11px] font-black text-slate-500 sm:flex-row sm:justify-center sm:text-xs ${active ? "is-active" : "hover:bg-white/70"}`}
                      >
                        <Icon className="size-4" /> {meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid max-h-[320px] gap-2 overflow-y-auto p-3 sm:grid-cols-2">
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
                  {actions.length === 0 && (
                    <p className="col-span-full py-6 text-center text-xs font-bold text-slate-400">
                      No {categoryMeta[actionCategory].label.toLowerCase()} options in this case.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </main>

        {/* Zone C — persistent complete interaction history (desktop) */}
        <aside className="case-zone-sticky hidden self-start xl:block">
          {historyPanel(true, "h-[calc(100vh-7.5rem)] max-h-[48rem]")}
        </aside>
      </div>

      <footer className="mt-5 text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice
      </footer>

      {/* Dr. Ambrose coach — bottom-left on desktop */}
      <div className="fixed bottom-4 left-4 z-40 hidden lg:block">
        {coachOpen && (
          <div className="case-coach-popover mb-2 !static w-80 overflow-hidden rounded-2xl">
            <HintPanel game={game} nextHint={nextHint} onHint={askForHint} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setCoachOpen((open) => !open)}
          aria-expanded={coachOpen}
          className="flex items-center gap-2 rounded-full border border-[var(--case-yellow)] bg-[var(--case-yellow-soft)] py-1 pl-1 pr-3 shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-yellow)]"
        >
          <DrAmbrose expression="thinking" variant="logo" className="w-10 shrink-0" />
          <span className="text-xs font-black text-[var(--case-yellow-ink)]">
            Ask {DR_AMBROSE.name}
          </span>
        </button>
      </div>

      {/* Zone A drawer (tablet / mobile) */}
      <MobileSheet open={sidebarOpen} label="Case tools" onClose={() => setSidebarOpen(false)}>
        <div className="h-full overflow-y-auto p-4">{sidebar}</div>
      </MobileSheet>

      {/* Zone C drawer (tablet / mobile) */}
      <MobileSheet
        open={historyOpen}
        label="Interaction history"
        onClose={() => setHistoryOpen(false)}
      >
        {historyPanel(false, "h-full rounded-none border-0 shadow-none")}
      </MobileSheet>

      {/* Clinical workspace drawer */}
      <MobileSheet open={workspaceOpen} label="Clinical workspace" onClose={closeWorkspace}>
        {workspacePanel(false)}
      </MobileSheet>

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

/** Accessible bottom-sheet used for the Zone A, Zone C and workspace drawers. */
function MobileSheet({
  open,
  label,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("button, [href], textarea, input, select")
        ?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

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
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

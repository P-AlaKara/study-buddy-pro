import { useId, type ComponentType, type DragEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  FlaskConical,
  HelpCircle,
  MessageCircleMore,
  NotebookPen,
  Plus,
  Stethoscope,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import type { GameState } from "../engine.js";
import type { ActionCategory, MedicalCase } from "../schema.js";
import { DR_AMBROSE, DrAmbrose, type AmbroseExpression } from "./dr-ambrose.js";
import type { RightTab } from "./case-constants.js";

export function ClinicalWorkspace({
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
    <section className="case-panel case-workspace-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-[var(--case-border)] px-4 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]">
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
            className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
            aria-label="Close clinical workspace"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div
        className="grid grid-cols-3 gap-1 border-b border-[var(--case-border)] bg-slate-50/70 p-2"
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
              className={`min-w-0 rounded-xl px-1 py-2 text-[10px] font-black transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-[var(--case-accent-ink)] shadow-sm"
                  : "text-slate-500 hover:bg-white/70"
              }`}
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
        <span className="rounded-full bg-[var(--case-accent-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--case-accent-ink)]">
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
                  className={`rounded-2xl border p-3 transition-colors ${
                    game.latestActionId === action.id && action.clueTier !== "none"
                      ? "case-new-chart-entry border-[color-mix(in_srgb,var(--case-accent)_45%,white)] bg-[var(--case-accent-soft)]"
                      : "border-slate-100 bg-slate-50"
                  }`}
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
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-black text-[var(--case-mint-ink)]">
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
        className="mt-3 min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-[var(--case-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--case-accent)]/15"
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
          className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--case-accent)]"
        >
          <option value="">Choose…</option>
          {available.map((diagnosis) => (
            <option key={diagnosis.id} value={diagnosis.id}>
              {diagnosis.label}
            </option>
          ))}
        </select>
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]">
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
              className={`rounded-2xl bg-slate-50 p-3 transition-opacity ${
                draggedDiagnosis === entry.diagnosisId ? "opacity-45" : ""
              }`}
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
                    className="rounded-md p-1 text-slate-400 hover:text-[var(--case-critical)]"
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
                className="mt-2 h-1.5 w-full accent-[var(--case-accent)]"
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
                          className={`rounded-full px-1.5 py-0.5 font-black ${
                            tag?.relationship === "supports"
                              ? "bg-[var(--case-mint-soft)] text-[var(--case-mint-ink)]"
                              : "bg-white text-slate-400"
                          }`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onTag(entry.diagnosisId, evidence.actionId, "against")}
                          className={`rounded-full px-1.5 py-0.5 font-black ${
                            tag?.relationship === "against"
                              ? "bg-[var(--case-critical-soft)] text-[var(--case-critical)]"
                              : "bg-white text-slate-400"
                          }`}
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

export function HintPanel({
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
    <div className="border-t border-[var(--case-border)] bg-[var(--case-yellow-soft)] p-4">
      <div className="flex gap-3">
        <DrAmbrose expression={expression} variant="logo" className="-ml-1 -mt-1 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--case-yellow-ink)]">
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

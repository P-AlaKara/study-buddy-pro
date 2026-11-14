import { useId, type ComponentType, type DragEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  HelpCircle,
  MessageCircleMore,
  Plus,
  Stethoscope,
  Syringe,
  Trash2,
} from "lucide-react";
import type { GameState } from "../engine.js";
import type { ActionCategory, MedicalCase } from "../schema.js";
import { DR_AMBROSE, DrAmbrose, type AmbroseExpression } from "./dr-ambrose.js";
import { workspaceToolMeta, type RightTab } from "./case-constants.js";

/**
 * Shows exactly one clinical tool — the one the student asked for. There is no
 * tab strip: opening "Clinical notes" lands on the notes, and nothing else.
 */
export function ClinicalWorkspace({
  game,
  caseDefinition,
  tool,
  notes,
  draggedDiagnosis,
  onClose,
  onNotes,
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
  tool: RightTab;
  notes: string;
  draggedDiagnosis: string | null;
  onClose: () => void;
  onNotes: (notes: string) => void;
  onDragStart: (id: string | null) => void;
  onDrop: (id: string) => void;
  onAdd: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onConfidence: (id: string, confidence: number) => void;
  onTag: (diagnosisId: string, evidenceId: string, relationship: "supports" | "against") => void;
}) {
  const meta = workspaceToolMeta[tool];
  const Icon = meta.icon;

  return (
    <section className="case-panel case-workspace-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--case-border)] px-4 py-4">
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
          aria-label="Back to the patient"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black text-slate-900">{meta.label}</h2>
          <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{meta.blurb}</p>
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-y-auto ${tool === "notes" ? "flex flex-col p-4" : "p-4"}`}
      >
        {tool === "chart" && <ChartPanel game={game} caseDefinition={caseDefinition} />}
        {tool === "notes" && <NotesPanel notes={notes} onNotes={onNotes} />}
        {tool === "differential" && (
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
    <div className="flex min-h-0 flex-1 flex-col">
      <label htmlFor={notesId} className="text-[11px] leading-relaxed text-slate-500">
        Jot down your reasoning, questions and management priorities. Notes are saved automatically
        and stay with this case.
      </label>
      <textarea
        id={notesId}
        value={notes}
        onChange={(event) => onNotes(event.target.value)}
        placeholder="e.g. Tearing chest pain radiating to the back — widened mediastinum on CXR. Rule out dissection before anticoagulating…"
        className="mt-3 min-h-64 w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[var(--case-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--case-accent)]/15"
      />
      <p className="mt-2 shrink-0 text-right text-[10px] font-bold text-slate-400">
        {notes.length > 0 ? `${notes.length} characters · saved` : "Nothing written yet"}
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
        Add a diagnosis
      </label>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Pick a diagnosis, then drag or use the arrows to put your most likely one first.
      </p>
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
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Does each finding fit?{" "}
                    <span className="normal-case">+ supports · − against</span>
                  </p>
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
          ? `Request hint · Tier ${nextHint.tier} · ${nextHint.cost} pts`
          : "All hints used"}
      </button>
    </div>
  );
}

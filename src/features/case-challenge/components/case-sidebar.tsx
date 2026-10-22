import { type ComponentType } from "react";
import {
  Check,
  ClipboardList,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  ListChecks,
  MessageCircleMore,
  NotebookPen,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type { GameState } from "../engine.js";
import type { ActionCategory, MedicalCase } from "../schema.js";
import type { RightTab } from "./case-constants.js";

function caseNumberLabel(id: string): string {
  const match = id.match(/(\d+)/);
  return match?.[1] ? `Case ${match[1].padStart(2, "0")}` : "Case";
}

const STAGES: Array<{
  category: ActionCategory;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { category: "ask", label: "History", icon: MessageCircleMore },
  { category: "examine", label: "Examination", icon: Stethoscope },
  { category: "test", label: "Investigations", icon: FlaskConical },
  { category: "treat", label: "Management", icon: Syringe },
];

const TOOLS: Array<{
  tab: RightTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
  withBadge?: boolean;
}> = [
  { tab: "chart", label: "Patient chart", icon: ClipboardList, withBadge: true },
  { tab: "notes", label: "Clinical notes", icon: NotebookPen },
  { tab: "differential", label: "Differentials", icon: ListChecks },
  { tab: "chart", label: "Investigations & results", icon: FlaskConical },
  { tab: "chart", label: "Imaging", icon: ImageIcon },
];

/**
 * Zone A — case context, a non-locking progression indicator (clicking a stage
 * simply focuses that interaction category; students may revisit any stage),
 * and launchers that open the clinical workspace without leaving the encounter.
 */
export function CaseSidebar({
  caseDefinition,
  game,
  activeCategory,
  onSelectStage,
  onOpenWorkspace,
  unreadFindings,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  activeCategory: ActionCategory;
  onSelectStage: (category: ActionCategory) => void;
  onOpenWorkspace: (tab: RightTab) => void;
  unreadFindings: number;
}) {
  const completedCategories = new Set(
    game.completedActions.flatMap((entry) => {
      const action = caseDefinition.actions.find((candidate) => candidate.id === entry.actionId);
      return action ? [action.category] : [];
    }),
  );

  return (
    <nav className="space-y-3" aria-label="Case workspace">
      <section className="case-panel p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--case-accent-ink)]">
          {caseNumberLabel(caseDefinition.id)}
        </p>
        <h1 className="mt-1 font-display text-lg font-black leading-tight text-slate-900">
          {caseDefinition.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-slate-500">
          <span>{caseDefinition.setting}</span>
          <span aria-hidden="true">·</span>
          <span aria-label={`Difficulty ${caseDefinition.difficulty} of 3`}>
            {"●".repeat(caseDefinition.difficulty)}
            <span className="text-slate-300">{"●".repeat(3 - caseDefinition.difficulty)}</span>
          </span>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-700">
          {caseDefinition.patient.name}, {caseDefinition.patient.age} · {caseDefinition.patient.sex}
        </p>
      </section>

      <section className="case-panel p-3">
        <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
          Encounter progress
        </p>
        <ol className="space-y-0.5">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const done = completedCategories.has(stage.category);
            const active = activeCategory === stage.category;
            return (
              <li key={stage.category}>
                <button
                  type="button"
                  onClick={() => onSelectStage(stage.category)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] ${
                    active
                      ? "bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] ${
                      done
                        ? "bg-[var(--case-mint)] text-white"
                        : active
                          ? "bg-[var(--case-accent)] text-white"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <Icon className="size-4 shrink-0 opacity-70" />
                  <span className="flex-1 truncate">{stage.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="case-panel p-3">
        <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
          Clinical tools
        </p>
        <ul className="space-y-0.5">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const badge = tool.withBadge && unreadFindings > 0 ? unreadFindings : 0;
            return (
              <li key={tool.label}>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(tool.tab)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 truncate">{tool.label}</span>
                  {badge > 0 && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--case-pink)] text-[10px] font-black text-white">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-slate-400">
        <FileText className="size-3.5" />
        {caseDefinition.reviewStatus === "clinician_reviewed"
          ? "Clinician reviewed"
          : "Clinician review required"}
      </p>
    </nav>
  );
}

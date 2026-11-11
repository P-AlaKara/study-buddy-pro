import { useState, type CSSProperties } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type { GameState } from "../engine.js";
import type { ActionCategory, CaseAction, MedicalCase } from "../schema.js";
import {
  categoryMeta,
  workspaceToolMeta,
  WORKSPACE_TOOLS,
  type RightTab,
} from "./case-constants.js";
import { ActionCard } from "./case-ui.js";

/**
 * The clinical-actions dock that floats over the bottom of the ward scene.
 * It shows the handover before the case starts, then the four interaction
 * categories with a single scrolling row of actions. "Show all" expands it
 * into a taller grid for a full overview; collapsing keeps the patient in view.
 * Below `lg` the three clinical-tool launchers live in its header, so chart,
 * notes and differentials are one tap from the patient on every screen.
 */
export function ClinicalDock({
  caseDefinition,
  game,
  actions,
  actionCategory,
  completedIds,
  busy,
  unreadFindings,
  onCategory,
  onChoose,
  onStart,
  onOpenWorkspace,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  actions: CaseAction[];
  actionCategory: ActionCategory;
  completedIds: ReadonlySet<string>;
  busy: boolean;
  unreadFindings: number;
  onCategory: (category: ActionCategory) => void;
  onChoose: (action: CaseAction) => void;
  onStart: () => void;
  onOpenWorkspace: (tool: RightTab) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (game.phase === "hook") {
    return (
      <div className="case-dock-panel p-4 sm:p-5" aria-labelledby="clinical-actions-title">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--case-accent-ink)]">
          Handover
        </p>
        <h2
          id="clinical-actions-title"
          className="mt-1 text-base font-black text-slate-900 sm:text-lg"
        >
          You’re taking over this patient
        </h2>
        <p className="mt-1.5 text-[13px] font-bold leading-relaxed text-slate-700 sm:text-sm">
          {caseDefinition.intro}
        </p>
        {/* Right-aligned on phones so the fixed Dr. Ambrose button never covers it. */}
        <div className="mt-3 flex justify-end sm:justify-start">
          <button
            type="button"
            onClick={onStart}
            className="case-primary-button px-5 py-2.5 text-sm"
          >
            Take over the case <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="case-dock-panel"
      data-expanded={expanded ? "true" : "false"}
      aria-labelledby="clinical-actions-title"
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <h2
            id="clinical-actions-title"
            className="text-[13px] font-black text-slate-900 sm:text-sm"
          >
            Clinical actions
            <span className="ml-2 text-[10px] font-bold text-slate-400">
              {completedIds.size}/{caseDefinition.actions.length} done
            </span>
          </h2>
          {completedIds.size === 0 && (
            <p className="truncate text-[11px] font-bold text-slate-500">
              Pick a category, then an action. Each one costs clinical time.
            </p>
          )}
        </div>

        {/* Clinical-tool launchers where the sidebar is folded away */}
        <div className="flex items-center gap-1 lg:hidden" aria-label="Clinical tools">
          {WORKSPACE_TOOLS.map((tool) => {
            const meta = workspaceToolMeta[tool];
            const Icon = meta.icon;
            const badge = tool === "chart" ? unreadFindings : 0;
            return (
              <button
                key={tool}
                type="button"
                onClick={() => onOpenWorkspace(tool)}
                className="relative grid size-9 place-items-center rounded-xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)] transition-colors hover:bg-[var(--case-accent)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
                aria-label={meta.label}
                title={meta.label}
              >
                <Icon className="size-4" />
                {badge > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-[var(--case-pink)] text-[9px] font-black text-white ring-2 ring-white">
                    {badge}
                    <span className="sr-only"> new findings</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] sm:inline-flex"
        >
          {expanded ? (
            <>
              Compact <ChevronDown className="size-3.5" />
            </>
          ) : (
            <>
              Show all <ChevronUp className="size-3.5" />
            </>
          )}
        </button>
      </div>

      <div
        className="mx-3 mt-2 grid grid-cols-4 gap-1 rounded-xl bg-slate-50/80 p-1 sm:mx-4"
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
              onClick={() => onCategory(category)}
              style={
                {
                  "--cat": meta.color,
                  color: active ? meta.ink : undefined,
                } as CSSProperties
              }
              className={`case-interaction-category flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-transparent px-1 py-1.5 text-[11px] font-black text-slate-500 sm:text-xs ${active ? "is-active" : "hover:bg-white/80"}`}
            >
              <Icon className="size-4" /> {meta.label}
            </button>
          );
        })}
      </div>

      <div className="case-dock-cards" role="tabpanel">
        {actions.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            used={completedIds.has(action.id)}
            busy={busy}
            disabled={game.phase !== "investigate"}
            onChoose={() => onChoose(action)}
          />
        ))}
        {actions.length === 0 && (
          <p className="col-span-full py-6 text-center text-xs font-bold text-slate-400">
            No {categoryMeta[actionCategory].label.toLowerCase()} options in this case.
          </p>
        )}
      </div>
    </div>
  );
}

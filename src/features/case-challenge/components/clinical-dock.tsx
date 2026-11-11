import { useState, type CSSProperties } from "react";
import { ArrowRight, ChevronDown, ChevronUp, X } from "lucide-react";
import type { GameState } from "../engine.js";
import type { ActionCategory, CaseAction, MedicalCase } from "../schema.js";
import { categoryMeta } from "./case-constants.js";
import { ActionCard } from "./case-ui.js";

const CATEGORY_SUBLABEL: Record<ActionCategory, string> = {
  ask: "History",
  examine: "Patient",
  test: "Investigations",
  treat: "Management",
};

/**
 * The clinical-actions dock floating over the foot of the bed. Before the case
 * starts it carries the handover; afterwards it is four large category
 * buttons. Picking one raises a tray with that category's actions (a single
 * scrolling row, or "Show all" for a grid), so the ward stays visible until
 * the student actually needs the list.
 */
export function ClinicalDock({
  caseDefinition,
  game,
  actions,
  category,
  trayOpen,
  completedIds,
  busy,
  onSelectCategory,
  onCloseTray,
  onChoose,
  onStart,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  /** Actions in the open category. */
  actions: CaseAction[];
  category: ActionCategory;
  trayOpen: boolean;
  completedIds: ReadonlySet<string>;
  busy: boolean;
  onSelectCategory: (category: ActionCategory) => void;
  onCloseTray: () => void;
  onChoose: (action: CaseAction) => void;
  onStart: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (game.phase === "hook") {
    return (
      <div className="case-dock">
        <div
          className="case-float-panel case-dock-handover"
          aria-labelledby="clinical-actions-title"
        >
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
      </div>
    );
  }

  const meta = categoryMeta[category];
  const MetaIcon = meta.icon;
  const doneInCategory = actions.filter((action) => completedIds.has(action.id)).length;

  return (
    <div className="case-dock">
      {trayOpen && (
        <div
          className="case-float-panel case-dock-tray"
          data-expanded={expanded ? "true" : "false"}
          role="region"
          aria-labelledby="clinical-actions-title"
        >
          <div className="flex items-center gap-2 px-4 pt-3">
            <span
              className="grid size-8 place-items-center rounded-xl text-white"
              style={{ backgroundColor: meta.color }}
            >
              <MetaIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="clinical-actions-title" className="text-sm font-black text-slate-900">
                {meta.label} · {CATEGORY_SUBLABEL[category]}
                <span className="ml-2 text-[10px] font-bold text-slate-400">
                  {doneInCategory}/{actions.length} done
                </span>
              </h2>
              {completedIds.size === 0 && (
                <p className="truncate text-[11px] font-bold text-slate-500">
                  Each action costs clinical time. Choose wisely.
                </p>
              )}
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
            <button
              type="button"
              onClick={onCloseTray}
              className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
              aria-label="Close actions"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="case-dock-cards">
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
                No {meta.label.toLowerCase()} options in this case.
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className="case-float-panel case-dock-bar"
        role="tablist"
        aria-label="Clinical interaction categories"
      >
        {(Object.keys(categoryMeta) as ActionCategory[]).map((item) => {
          const itemMeta = categoryMeta[item];
          const Icon = itemMeta.icon;
          const active = trayOpen && category === item;
          const inCategory = caseDefinition.actions.filter((action) => action.category === item);
          const done = inCategory.filter((action) => completedIds.has(action.id)).length;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectCategory(item)}
              style={{ "--cat": itemMeta.color, "--cat-soft": itemMeta.soft } as CSSProperties}
              className="case-dock-category"
              data-active={active ? "true" : "false"}
            >
              <span className="case-dock-category-icon">
                <Icon className="size-5" />
                {done > 0 && (
                  <span className="case-dock-category-count" aria-hidden="true">
                    {done}/{inCategory.length}
                  </span>
                )}
              </span>
              <span className="text-[13px] font-black leading-tight text-slate-900 sm:text-sm">
                {itemMeta.label}
              </span>
              <span className="hidden text-[11px] font-bold leading-tight text-slate-500 sm:block">
                {CATEGORY_SUBLABEL[item]}
              </span>
              <span className="sr-only">
                , {done} of {inCategory.length} done
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

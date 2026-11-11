import { ChevronRight, FileText } from "lucide-react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { WORKSPACE_TOOLS, workspaceToolMeta, type RightTab } from "./case-constants.js";

function caseNumberLabel(id: string): string {
  const match = id.match(/(\d+)/);
  return match?.[1] ? `Case ${match[1].padStart(2, "0")}` : "Case";
}

/**
 * Zone A — case context plus the three clinical-tool launchers. Each launcher
 * opens that one tool in the workspace; progression through the interaction
 * categories lives on the action panel itself, so there is no second, competing
 * stage list here.
 */
export function CaseSidebar({
  caseDefinition,
  game,
  onOpenWorkspace,
  unreadFindings,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  onOpenWorkspace: (tool: RightTab) => void;
  unreadFindings: number;
}) {
  const toolCounts: Record<RightTab, number> = {
    chart: game.discoveredEvidence.length,
    notes: 0,
    differential: game.differential.length,
  };

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
          Clinical tools
        </p>
        <ul className="space-y-1">
          {WORKSPACE_TOOLS.map((tool) => {
            const meta = workspaceToolMeta[tool];
            const Icon = meta.icon;
            const badge = tool === "chart" ? unreadFindings : 0;
            const count = toolCounts[tool];
            return (
              <li key={tool}>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(tool)}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
                >
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]">
                    <Icon className="size-[18px]" />
                    {badge > 0 && (
                      <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-[var(--case-pink)] text-[9px] font-black text-white ring-2 ring-white">
                        {badge}
                        <span className="sr-only"> new findings</span>
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[13px] font-black text-slate-800">
                        {meta.label}
                      </span>
                      {count > 0 && (
                        <span className="shrink-0 text-[10px] font-black text-slate-400">
                          {count}
                          <span className="sr-only"> {meta.unit}</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-500">
                      {meta.blurb}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
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

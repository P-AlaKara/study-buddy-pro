import { ChevronRight, FileText } from "lucide-react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { WORKSPACE_TOOLS, workspaceToolMeta, type RightTab } from "./case-constants.js";
import { presentingTags } from "./patient-media.js";

export function caseNumberLabel(id: string): string {
  const match = id.match(/(\d+)/);
  return match?.[1] ? `Case ${match[1].padStart(2, "0")}` : "Case";
}

/**
 * The floating case panel: setting, title, who the patient is and why they
 * are here, then the three clinical-tool launchers. Each launcher opens that
 * one tool in the workspace; progression through the interaction categories
 * lives on the dock, so there is no second, competing stage list here.
 */
export function CasePanel({
  caseDefinition,
  game,
  onOpenWorkspace,
  unreadFindings,
  className = "",
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  onOpenWorkspace: (tool: RightTab) => void;
  unreadFindings: number;
  className?: string;
}) {
  const { patient } = caseDefinition;
  const tags = presentingTags(caseDefinition);
  const toolCounts: Record<RightTab, number> = {
    chart: game.discoveredEvidence.length,
    notes: 0,
    differential: game.differential.length,
  };

  return (
    <nav className={`case-float-panel flex flex-col ${className}`} aria-label="Case workspace">
      <section className="px-4 pb-3.5 pt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--case-accent-ink)]">
          {caseDefinition.setting}
        </p>
        <h1 className="mt-0.5 font-display text-[22px] font-black leading-tight text-slate-900">
          {caseDefinition.title}
        </h1>
        <p className="mt-2 text-[15px] font-black text-[var(--case-accent-ink)]">
          {patient.name}, {patient.age} <span className="text-slate-400">•</span> {patient.sex}
        </p>
        <p className="mt-1 text-[13px] font-bold leading-snug text-slate-700">
          {patient.chiefComplaint}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--case-accent-ink)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--case-accent)]" aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="border-t border-white/70 px-3 pb-2.5 pt-2.5">
        <p className="px-1.5 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          Case tools
        </p>
        <ul className="space-y-1.5">
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
                  className="group flex w-full items-center gap-3 rounded-2xl bg-white/60 px-3 py-2.5 text-left transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
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
                      <span className="truncate text-[14px] font-black text-slate-800">
                        {meta.label}
                      </span>
                      {count > 0 && (
                        <span className="shrink-0 text-[10px] font-black text-slate-400">
                          {count}
                          <span className="sr-only"> {meta.unit}</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">
                      {meta.blurb}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 flex items-center gap-1.5 px-1.5 text-[10px] font-bold text-slate-500">
          <FileText className="size-3.5" />
          {caseDefinition.reviewStatus === "clinician_reviewed"
            ? "Clinician reviewed"
            : "Clinician review required"}
        </p>
      </section>
    </nav>
  );
}

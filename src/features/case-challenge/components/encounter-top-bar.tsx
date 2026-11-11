import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock3, HeartPulse, History, Lightbulb, UserRound } from "lucide-react";
import { DR_AMBROSE, DrAmbrose } from "./dr-ambrose.js";
import { useAuth } from "@/features/auth/auth-context";
import { formatCaseClock, type GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { caseNumberLabel } from "./case-panel.js";
import { ScoreMeter } from "./case-ui.js";
import { SceneViewControls, type SceneViewState } from "./scene-backdrop.js";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * The floating command bar over the ward: way home, case identity, the
 * simulated clock, scene controls and the student's standing. Below `lg` it
 * also carries the history and commit actions, since the side panels fold
 * into sheets there.
 */
export function EncounterTopBar({
  caseDefinition,
  game,
  sceneView,
  commitReady,
  onCommit,
  onOpenHistory,
  onToggleCoach,
  coachOpen,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  sceneView: SceneViewState;
  commitReady: boolean;
  onCommit: () => void;
  onOpenHistory: () => void;
  onToggleCoach: () => void;
  coachOpen: boolean;
}) {
  const { profile } = useAuth();
  const name = profile?.name ?? "";

  return (
    <header className="case-topbar">
      <div className="case-topbar-group">
        <Link
          to="/cases"
          className="case-hud-icon grid size-11"
          aria-label="Back to all cases"
          title="All cases"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <Link
          to="/"
          className="case-float-pill hidden items-center gap-2 py-1.5 pl-1.5 pr-3 font-display text-[22px] font-black text-slate-900 md:flex"
          aria-label="Medley home"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-pink text-slate-900">
            <HeartPulse size={19} strokeWidth={2.5} />
          </span>
          <span>
            medley<span className="text-pink">.</span>
          </span>
        </Link>
      </div>

      <div className="case-float-pill case-topbar-center">
        <span className="hidden rounded-full bg-[var(--case-accent-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[var(--case-accent-ink)] md:inline-flex">
          {caseNumberLabel(caseDefinition.id)}
        </span>
        <h1 className="min-w-0 truncate font-display text-[15px] font-black text-slate-900 md:text-lg">
          {caseDefinition.title}
        </h1>
        <span className="hidden h-6 w-px bg-[var(--case-border)] md:block" aria-hidden="true" />
        <span className="flex shrink-0 items-center gap-1.5 text-slate-700">
          <Clock3 className="size-4 text-slate-400" />
          <span className="font-mono text-sm font-black">{formatCaseClock(game.timeMinute)}</span>
          <span className="hidden text-[10px] font-bold text-slate-400 md:inline">
            Simulated time
          </span>
        </span>
      </div>

      <div className="case-topbar-group justify-end">
        <div className="hidden xl:block">
          <ScoreMeter score={game.score.total} maximum={game.score.maximum} />
        </div>
        <span
          className="case-float-pill hidden items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-slate-700 lg:inline-flex"
          title="Hints used"
        >
          <Lightbulb className="size-4 text-[var(--case-yellow-ink)]" />
          {game.hintsUsed.length} hints
        </span>
        <div className="hidden items-center gap-1.5 sm:flex">
          <SceneViewControls sceneView={sceneView} />
        </div>
        <span
          className="case-float-pill hidden size-11 place-items-center bg-[var(--case-mint-soft)] text-xs font-black text-[var(--case-mint-ink)] lg:grid"
          aria-label={name ? `Signed in as ${name}` : "Signed in"}
          title={name || undefined}
        >
          {name ? initials(name) : <UserRound className="size-4" />}
        </span>

        {/* Folded-away panels, the coach and the commit action, below lg */}
        <button
          type="button"
          onClick={onToggleCoach}
          aria-expanded={coachOpen}
          aria-label={`Ask ${DR_AMBROSE.name} for a hint`}
          className={`case-hud-icon grid size-11 overflow-hidden !p-0 lg:hidden ${coachOpen ? "ring-2 ring-[var(--case-yellow)]" : ""}`}
        >
          <DrAmbrose expression="thinking" variant="logo" className="w-9" />
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="case-hud-icon grid size-11 lg:hidden"
          aria-label="Open interaction history"
        >
          <History className="size-[18px]" />
        </button>
        <span className="lg:hidden">
          <button
            type="button"
            onClick={onCommit}
            disabled={game.phase !== "investigate"}
            className={`case-primary-button size-11 !rounded-full !p-0 ${commitReady ? "case-commit-ready" : ""}`}
            aria-label="Commit diagnosis"
            title="Commit diagnosis"
          >
            <Check className="size-5" />
          </button>
        </span>
      </div>
    </header>
  );
}

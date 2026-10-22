import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { Patient3D } from "../patient-3d/patient-3d.js";
import { resolveVisualState } from "../patient-3d/patient-visual-state.js";
import { PatientAvatar } from "./patient-avatar.js";
import { categoryMeta, type AvatarReaction } from "./case-constants.js";
import { TypingDots } from "./case-ui.js";

/**
 * Zone B patient viewport. A lit, animated Quaternius 3D patient fills a neutral,
 * slightly recessed hospital frame; the 2D `PatientAvatar` is the graceful
 * fallback (SSR, no WebGL, reduced-motion, or load error). The patient's
 * animation/posture is linked to live case state via `resolveVisualState`.
 */
export function PatientStage({
  caseDefinition,
  game,
  typing,
  reaction,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  reaction: AvatarReaction;
}) {
  const { patient } = caseDefinition;
  const activeReaction = typing ? "ask" : reaction;
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  const ReactionIcon = activeReaction ? categoryMeta[activeReaction].icon : null;
  const visualState = resolveVisualState(game, typing);

  const avatarFallback = (
    <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-center">
      <div className="relative w-[58%] max-w-[18rem] translate-y-[6%] sm:w-[48%]">
        <PatientAvatar
          patient={patient}
          expression={game.patientExpression}
          respiratoryRate={game.vitals.rr}
          reaction={activeReaction}
        />
        {activeReaction && activeReaction !== "ask" && ReactionIcon && (
          <span className="case-avatar-reaction" aria-hidden="true">
            <ReactionIcon className="size-4" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <section
      className="case-patient-stage aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-[16/9]"
      aria-label={`Patient: ${patient.name}`}
    >
      <div className="case-patient-floor" aria-hidden="true" />

      {/* Patient visualization: 3D when available, 2D avatar as fallback. */}
      <Patient3D state={visualState} fallback={avatarFallback} />

      {/* Patient details overlay */}
      <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur-sm sm:left-4 sm:top-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-base font-black leading-none text-slate-900 sm:text-lg">
            {patient.name}
          </h2>
          <span className="text-[11px] font-bold text-slate-500">
            {patient.age} · {patient.sex}
          </span>
        </div>
        <p className="mt-1.5 text-xs font-bold leading-snug text-slate-700">
          {patient.chiefComplaint}
        </p>
        <span
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
            critical
              ? "bg-[var(--case-critical-soft)] text-[var(--case-critical)]"
              : "bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              critical ? "animate-pulse bg-[var(--case-critical)]" : "bg-[var(--case-accent)]"
            }`}
          />
          {game.patientExpression.replaceAll("_", " ")}
        </span>
      </div>

      {typing && (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-[var(--case-blue-ink)] shadow-sm backdrop-blur-sm sm:right-4 sm:top-4">
          Speaking <TypingDots />
        </div>
      )}
    </section>
  );
}

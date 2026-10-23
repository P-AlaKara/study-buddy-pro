import { Maximize2 } from "lucide-react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { type AvatarReaction } from "./case-constants.js";
import { TypingDots } from "./case-ui.js";
import { patientImageForCase, presentingTags } from "./patient-media.js";

/**
 * Zone B patient viewport. A photographic patient, semi-reclined in a hospital
 * bed, fills a large rounded frame (`object-fit: cover`). The image is chosen
 * from the patient's sex (see `patientImageForCase`). A floating card overlays
 * the patient identity, chief complaint and presenting-feature chips.
 */
export function PatientStage({
  caseDefinition,
  game,
  typing,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  /** Retained for API compatibility with the previous 3D stage. */
  reaction?: AvatarReaction;
}) {
  const { patient } = caseDefinition;
  const image = patientImageForCase(caseDefinition);
  const tags = presentingTags(caseDefinition);
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;

  return (
    <section
      className="case-patient-stage aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-[16/9]"
      aria-label={`Patient: ${patient.name}`}
    >
      <img
        src={image.src}
        alt={image.alt}
        className="case-patient-photo"
        loading="eager"
        decoding="async"
      />
      <div className="case-patient-vignette" aria-hidden="true" />

      {/* Patient details overlay */}
      <div className="case-patient-overlay">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-display text-lg font-black leading-none text-slate-900 sm:text-xl">
            {patient.name}
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {patient.age} · {patient.sex}
          </span>
        </div>
        <p className="mt-1.5 max-w-[22rem] text-[13px] font-bold leading-snug text-slate-700">
          {patient.chiefComplaint}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag, index) => {
            const accent = index === tags.length - 1 && tags.length > 1;
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                  accent
                    ? "bg-[var(--case-pink-soft)] text-[var(--case-pink-ink)]"
                    : "bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]"
                }`}
              >
                {!accent && (
                  <span className="size-1.5 rounded-full bg-[var(--case-accent)]" aria-hidden="true" />
                )}
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Status / expand controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
        {critical && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--case-critical)] shadow-sm backdrop-blur-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--case-critical)]" />
            {game.patientExpression.replaceAll("_", " ")}
          </span>
        )}
        {typing && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-[var(--case-blue-ink)] shadow-sm backdrop-blur-sm">
            Speaking <TypingDots />
          </span>
        )}
        <span
          className="grid size-9 place-items-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm"
          aria-hidden="true"
        >
          <Maximize2 className="size-4" />
        </span>
      </div>
    </section>
  );
}

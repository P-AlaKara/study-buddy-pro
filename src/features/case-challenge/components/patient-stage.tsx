import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Image, Loader2, Rotate3d, Box } from "lucide-react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import {
  HospitalSceneHost,
  type SceneStatus,
  type SceneView,
} from "../scene/hospital-scene-host.js";
import { resolvePatientModel } from "../scene/patient-model.js";
import { derivePatientVisualState } from "../scene/patient-visual-state.js";
import { type AvatarReaction } from "./case-constants.js";
import { TypingDots } from "./case-ui.js";
import { patientImageForCase, presentingTags } from "./patient-media.js";
import { VitalsMonitor } from "./vitals-strip.js";

const VIEW_STORAGE_KEY = "medley.case.stage-view";

function readStoredView(): SceneView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "photo" ? "photo" : "scene";
  } catch {
    return "scene";
  }
}

function storeView(view: SceneView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* private mode: the choice simply does not persist */
  }
}

/**
 * Zone B — the patient encounter. A 3D hospital ward fills the stage and the
 * clinical HUD floats above it: patient identity (top-left), status chips and
 * view controls (top-right), the vitals monitor (right on wide screens, a
 * strip along the bottom on phones) and the clinical-actions dock (`dock`),
 * which overlays the bottom of the scene from the `sm` breakpoint and sits
 * below the viewport on phones so the patient is never covered.
 *
 * Every control is ordinary React DOM layered over the WebGL canvas; the
 * scene receives only the patient model and a derived visual state.
 */
export function PatientStage({
  caseDefinition,
  game,
  typing,
  dock,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  /** Clinical actions (or the handover) rendered in the bottom dock. */
  dock: ReactNode;
  /** Retained for API compatibility; reactions will drive animation later. */
  reaction?: AvatarReaction;
}) {
  const { patient } = caseDefinition;
  const poster = patientImageForCase(caseDefinition);
  const tags = presentingTags(caseDefinition);
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  const model = useMemo(() => resolvePatientModel(caseDefinition), [caseDefinition]);
  const visualState = useMemo(
    () => derivePatientVisualState(game, { talking: typing }),
    [game, typing],
  );

  const [view, setView] = useState<SceneView>("scene");
  const [orbit, setOrbit] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [status, setStatus] = useState<SceneStatus>("idle");

  // Restore the student's view choice after mount (never during SSR/hydration).
  useEffect(() => {
    setView(readStoredView());
  }, []);

  const toggleView = useCallback(() => {
    setView((current) => {
      const next: SceneView = current === "scene" ? "photo" : "scene";
      storeView(next);
      if (next === "photo") setOrbit(false);
      return next;
    });
  }, []);

  const handleStatus = useCallback((next: SceneStatus) => setStatus(next), []);
  const sceneLive = view === "scene" && status === "ready";
  const sceneBusy = view === "scene" && (status === "loading" || status === "slow");

  return (
    <section className="case-stage" aria-label={`Patient encounter: ${patient.name}`}>
      <div className="case-stage-viewport">
        <HospitalSceneHost
          model={model.spec}
          visualState={visualState}
          view={view}
          orbit={orbit}
          poster={poster}
          onStatusChange={handleStatus}
        />
        <div className="case-stage-vignette" aria-hidden="true" />

        {/* HUD layer — pointer events only on the panels themselves */}
        <div className="case-hud">
          {/* Patient identity */}
          <div className="case-hud-panel case-hud-patient" data-open={infoOpen ? "true" : "false"}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h2 className="font-display text-base font-black leading-none text-slate-900 sm:text-xl">
                    {patient.name}
                  </h2>
                  <span className="text-[11px] font-bold text-slate-500 sm:text-xs">
                    {patient.age} · {patient.sex}
                  </span>
                </div>
                {infoOpen && (
                  <p className="mt-1.5 max-w-[22rem] text-[12px] font-bold leading-snug text-slate-700 sm:text-[13px]">
                    {patient.chiefComplaint}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInfoOpen((open) => !open)}
                className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
                aria-expanded={infoOpen}
                aria-label={infoOpen ? "Collapse patient details" : "Expand patient details"}
              >
                {infoOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            </div>
            {infoOpen && (
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
                        <span
                          className="size-1.5 rounded-full bg-[var(--case-accent)]"
                          aria-hidden="true"
                        />
                      )}
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status chips + view controls */}
          <div className="case-hud-topright">
            {critical && (
              <span className="case-hud-chip text-[var(--case-critical)]">
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--case-critical)]" />
                {game.patientExpression.replaceAll("_", " ")}
              </span>
            )}
            {typing && (
              <span className="case-hud-chip text-[var(--case-blue-ink)]">
                Speaking <TypingDots />
              </span>
            )}
            {sceneBusy && (
              <span className="case-hud-chip text-slate-600" role="status">
                <Loader2 className="size-3.5 animate-spin" />
                {status === "slow" ? "Still loading the ward…" : "Loading ward"}
              </span>
            )}
            {view === "scene" && (status === "failed" || status === "unavailable") && (
              <span className="case-hud-chip text-slate-600" role="status">
                3D view unavailable
              </span>
            )}
            {model.source === "fallback" && (
              <span
                className="case-hud-chip text-slate-500"
                title="Case data did not specify a patient model"
              >
                Standard patient model
              </span>
            )}
            {orbit && (
              <span className="case-hud-chip hidden text-slate-600 lg:inline-flex" role="status">
                Drag to look around · scroll to zoom
              </span>
            )}
            <button
              type="button"
              onClick={() => setOrbit((on) => !on)}
              disabled={!sceneLive}
              aria-pressed={orbit}
              className="case-hud-icon"
              aria-label={orbit ? "Lock the camera" : "Look around the room"}
              title={orbit ? "Lock camera" : "Look around"}
            >
              <Rotate3d className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggleView}
              disabled={status === "unavailable"}
              aria-pressed={view === "photo"}
              className="case-hud-icon"
              aria-label={view === "photo" ? "Show the 3D ward" : "Switch to photo view"}
              title={view === "photo" ? "3D ward" : "Photo view"}
            >
              {view === "photo" ? <Box className="size-4" /> : <Image className="size-4" />}
            </button>
          </div>

          {/* Vitals monitor */}
          <VitalsMonitor game={game} className="case-hud-monitor" />
        </div>
      </div>

      <div className="case-stage-dock">{dock}</div>
    </section>
  );
}

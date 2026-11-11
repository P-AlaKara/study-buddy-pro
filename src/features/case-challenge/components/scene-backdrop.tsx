import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Image, Loader2, Rotate3d } from "lucide-react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import {
  HospitalSceneHost,
  type SceneStatus,
  type SceneView,
} from "../scene/hospital-scene-host.js";
import { resolvePatientModel } from "../scene/patient-model.js";
import { derivePatientVisualState } from "../scene/patient-visual-state.js";
import { TypingDots } from "./case-ui.js";
import { patientImageForCase } from "./patient-media.js";

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
 * View state for the ward scene — which presentation is showing (3D or the
 * photo), whether the student is looking around, and how far the scene has
 * loaded. Owned by the encounter screen so the backdrop, the top-bar toggles
 * and the status chips all read one source of truth.
 */
export function useSceneView() {
  const [view, setView] = useState<SceneView>("scene");
  const [orbit, setOrbit] = useState(false);
  const [status, setStatus] = useState<SceneStatus>("idle");
  const [attempt, setAttempt] = useState(0);

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
  const toggleOrbit = useCallback(() => setOrbit((on) => !on), []);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const onStatusChange = useCallback((next: SceneStatus) => setStatus(next), []);

  return {
    view,
    orbit,
    status,
    attempt,
    retry,
    toggleView,
    toggleOrbit,
    onStatusChange,
    sceneLive: view === "scene" && status === "ready",
    sceneBusy: view === "scene" && (status === "loading" || status === "slow"),
  };
}

export type SceneViewState = ReturnType<typeof useSceneView>;

/**
 * The hospital ward filling the whole encounter viewport. Everything clinical
 * floats above it as ordinary DOM; the scene only receives the resolved patient
 * model and a derived visual state, never the engine state itself.
 */
export function SceneBackdrop({
  caseDefinition,
  game,
  typing,
  sceneView,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  sceneView: SceneViewState;
}) {
  const poster = patientImageForCase(caseDefinition);
  const model = useMemo(() => resolvePatientModel(caseDefinition), [caseDefinition]);
  const visualState = useMemo(
    () => derivePatientVisualState(game, { talking: typing }),
    [game, typing],
  );

  return (
    <div className="case-backdrop" aria-label={`Hospital ward with ${caseDefinition.patient.name}`}>
      <HospitalSceneHost
        model={model.spec}
        visualState={visualState}
        view={sceneView.view}
        orbit={sceneView.orbit}
        poster={poster}
        attempt={sceneView.attempt}
        onStatusChange={sceneView.onStatusChange}
      />
      <div className="case-stage-vignette" aria-hidden="true" />
    </div>
  );
}

/** Live status over the patient: distress, speech, and the scene's own state. */
export function SceneStatusChips({
  caseDefinition,
  game,
  typing,
  sceneView,
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  typing: boolean;
  sceneView: SceneViewState;
}) {
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  const model = useMemo(() => resolvePatientModel(caseDefinition), [caseDefinition]);
  const { status, view, sceneBusy, orbit, retry } = sceneView;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {critical && (
        <span className="case-hud-chip inline-flex text-[var(--case-critical)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--case-critical)]" />
          {game.patientExpression.replaceAll("_", " ")}
        </span>
      )}
      {typing && (
        <span className="case-hud-chip inline-flex text-[var(--case-blue-ink)]">
          Speaking <TypingDots />
        </span>
      )}
      {sceneBusy && (
        <span className="case-hud-chip inline-flex text-slate-600" role="status">
          <Loader2 className="size-3.5 animate-spin" />
          {status === "slow" ? "Still loading the ward…" : "Loading ward"}
        </span>
      )}
      {view === "scene" && status === "unavailable" && (
        <span className="case-hud-chip inline-flex text-slate-600" role="status">
          3D view unavailable
        </span>
      )}
      {view === "scene" && status === "failed" && (
        <button
          type="button"
          onClick={retry}
          className="case-hud-chip inline-flex text-[var(--case-accent-ink)] hover:text-[var(--case-accent-strong)]"
        >
          3D view unavailable · retry
        </button>
      )}
      {model.source === "fallback" && (
        <span
          className="case-hud-chip inline-flex text-slate-500"
          title="Case data did not specify a patient model"
        >
          Standard patient model
        </span>
      )}
      {orbit && (
        <span
          className="case-hud-chip inline-flex hidden text-slate-600 lg:inline-flex"
          role="status"
        >
          Drag to look around · scroll to zoom
        </span>
      )}
    </div>
  );
}

/** Look-around and photo-view toggles for the top bar. */
export function SceneViewControls({ sceneView }: { sceneView: SceneViewState }) {
  const { view, orbit, status, sceneLive, toggleOrbit, toggleView } = sceneView;
  return (
    <>
      <button
        type="button"
        onClick={toggleOrbit}
        disabled={!sceneLive}
        aria-pressed={orbit}
        className="case-hud-icon grid"
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
        className="case-hud-icon grid"
        aria-label={view === "photo" ? "Show the 3D ward" : "Switch to photo view"}
        title={view === "photo" ? "3D ward" : "Photo view"}
      >
        {view === "photo" ? <Box className="size-4" /> : <Image className="size-4" />}
      </button>
    </>
  );
}

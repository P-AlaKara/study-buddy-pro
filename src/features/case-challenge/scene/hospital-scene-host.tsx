import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PatientVisualState } from "./patient-visual-state.js";
import { detectRenderTier, type RenderTier } from "./render-tier.js";
import type { PatientModelSpec } from "./scene-config.js";

// Code-split: three.js / R3F / drei only load on the client, on demand.
const HospitalScene = lazy(() => import("./hospital-scene.js"));

/** What the stage should tell the student about the 3D view. */
export type SceneStatus =
  "idle" | "loading" | "ready" | "slow" | "unavailable" | "failed" | "photo";

export type SceneView = "scene" | "photo";

const SLOW_AFTER_MS = 12_000;
const GIVE_UP_AFTER_MS = 40_000;

class SceneErrorBoundary extends Component<
  { onError: (reason: string) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("Hospital scene failed; showing the photo view instead.", error);
    this.props.onError(error instanceof Error ? error.message : "render-error");
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface HospitalSceneHostProps {
  model: PatientModelSpec;
  visualState: PatientVisualState;
  /** `photo` forces the still image, e.g. by user choice. */
  view: SceneView;
  orbit: boolean;
  /** Still image used while loading, when WebGL is unavailable and in photo view. */
  poster: { src: string; alt: string };
  onStatusChange?: (status: SceneStatus) => void;
}

/**
 * Client-only shell around the WebGL scene. It decides whether the device can
 * run the scene, shows the photographic poster while assets stream in, and
 * degrades to that poster on any failure — SSR, no WebGL, asset errors, lost
 * context or a load that never finishes. The scene itself never touches case
 * state; it only receives the patient model and the derived visual state.
 */
export function HospitalSceneHost({
  model,
  visualState,
  view,
  orbit,
  poster,
  onStatusChange,
}: HospitalSceneHostProps) {
  const [tier, setTier] = useState<RenderTier | null>(null);
  const [status, setStatus] = useState<SceneStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    setTier(detectRenderTier());
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const sceneEnabled = tier !== null && tier !== "off" && view === "scene";

  // Drive the loading / slow / give-up timeline for this attempt.
  useEffect(() => {
    if (!sceneEnabled) {
      setStatus(tier === "off" ? "unavailable" : view === "photo" ? "photo" : "idle");
      return;
    }
    setStatus("loading");
    const slow = window.setTimeout(() => {
      if (statusRef.current === "loading") setStatus("slow");
    }, SLOW_AFTER_MS);
    const giveUp = window.setTimeout(() => {
      if (statusRef.current === "loading" || statusRef.current === "slow") setStatus("failed");
    }, GIVE_UP_AFTER_MS);
    return () => {
      window.clearTimeout(slow);
      window.clearTimeout(giveUp);
    };
  }, [sceneEnabled, tier, view, model.id, attempt]);

  const handleReady = useCallback(() => {
    if (statusRef.current === "loading" || statusRef.current === "slow") setStatus("ready");
  }, []);
  const handleFail = useCallback((reason: string) => {
    console.warn("Hospital scene unavailable:", reason);
    setStatus("failed");
  }, []);

  const showScene = sceneEnabled && status !== "failed";
  const sceneVisible = showScene && status === "ready";

  return (
    <div className="case-stage-media" data-status={status}>
      <img
        src={poster.src}
        alt={poster.alt}
        className="case-patient-photo"
        data-hidden={sceneVisible ? "true" : "false"}
        loading="eager"
        decoding="async"
      />
      {showScene && (
        <div className="case-stage-canvas-wrap" data-visible={sceneVisible ? "true" : "false"}>
          <SceneErrorBoundary key={attempt} onError={handleFail}>
            <Suspense fallback={null}>
              <HospitalScene
                model={model}
                visualState={visualState}
                tier={tier === "lite" ? "lite" : "full"}
                orbit={orbit}
                onReady={handleReady}
                onFail={handleFail}
              />
            </Suspense>
          </SceneErrorBoundary>
        </div>
      )}
      {status === "failed" && view === "scene" && (
        <button
          type="button"
          className="case-stage-retry"
          onClick={() => setAttempt((count) => count + 1)}
        >
          Retry 3D view
        </button>
      )}
    </div>
  );
}

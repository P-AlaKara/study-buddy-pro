import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { isWebGLAvailable, prefersReducedMotion } from "./webgl.js";
import type { PatientVisualState } from "./patient-visual-state.js";

// Code-split: three.js/R3F load only on the client, on demand.
const PatientScene = lazy(() => import("./patient-scene.js"));

class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("3D patient failed to render; using 2D fallback.", error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Renders the WebGL patient, falling back to `fallback` (the 2D avatar) during
 * SSR, before mount, when WebGL is unavailable, when the viewer prefers reduced
 * motion, or if the scene throws. The accessible non-3D path is never a primary
 * presentation — only a graceful degradation.
 */
export function Patient3D({ state, fallback }: { state: PatientVisualState; fallback: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isWebGLAvailable() && !prefersReducedMotion());
  }, []);

  if (!enabled) return <>{fallback}</>;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <PatientScene state={state} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

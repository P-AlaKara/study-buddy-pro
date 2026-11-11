/**
 * How much rendering the viewer's device can comfortably take.
 *
 * - `full`: shadows, environment reflections, 2× pixel ratio.
 * - `lite`: 1× pixel ratio, cheaper shadows, no environment pass.
 * - `off`: no usable WebGL — the stage shows the photographic fallback.
 *
 * Decided once on the client; the user can always switch to the photo view
 * from the HUD, and the host also falls back on WebGL context loss or an
 * asset failure.
 */
export type RenderTier = "full" | "lite" | "off";

export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

export function detectRenderTier(): RenderTier {
  if (!isWebGLAvailable()) return "off";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2;
  const fewCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2;
  const smallScreen = Math.min(window.screen.width, window.screen.height) <= 480;
  let saveData = false;
  try {
    const connection = (nav as Navigator & { connection?: { saveData?: boolean } }).connection;
    saveData = Boolean(connection?.saveData);
  } catch {
    saveData = false;
  }
  if (lowMemory || fewCores || saveData || smallScreen) return "lite";
  return "full";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

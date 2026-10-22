import type { GameState } from "../engine.js";

/**
 * High-level visual states for the 3D patient, linked to case state. These are
 * desired presentations — each maps to the closest available Quaternius clip
 * plus restrained, code-driven breathing/posture on top (see `patient-model`).
 */
export type PatientVisualState =
  "idle" | "attentive" | "discomfort" | "respiratory_distress" | "recovering";

export interface VisualStateConfig {
  /** Clip name in UAL1_Standard.glb; falls back to any available clip. */
  clip: string;
  /** Breathing oscillation rate multiplier and depth (radians at the chest). */
  breathRate: number;
  breathDepth: number;
  /** Sustained forward lean at the chest (radians) suggesting effort/guarding. */
  lean: number;
}

// In-place standing idle clips (no root translation), framed chest-up so the
// clinical focus is the face + chest, where the breathing/guarding reads.
export const VISUAL_STATE_CONFIG: Record<PatientVisualState, VisualStateConfig> = {
  idle: { clip: "Idle_Loop", breathRate: 1.1, breathDepth: 0.022, lean: 0 },
  attentive: { clip: "Idle_Talking_Loop", breathRate: 1.2, breathDepth: 0.02, lean: 0.02 },
  discomfort: { clip: "Idle_Loop", breathRate: 1.9, breathDepth: 0.045, lean: 0.1 },
  respiratory_distress: { clip: "Idle_Loop", breathRate: 2.7, breathDepth: 0.075, lean: 0.06 },
  recovering: { clip: "Idle_Loop", breathRate: 0.9, breathDepth: 0.02, lean: 0 },
};

/**
 * Derive the patient's visual state from live case state. `typing` means the
 * patient is being addressed / replying, which takes priority as "attentive"
 * unless the scenario has the patient in genuine distress.
 */
export function resolveVisualState(game: GameState, typing: boolean): PatientVisualState {
  if (game.outcome === "diagnosed") return "recovering";
  const expression = game.patientExpression;
  if (expression === "struggling_to_breathe") return "respiratory_distress";
  if (expression === "relieved") return "recovering";
  if (typing) return "attentive";
  if (expression === "in_pain" || expression === "anxious" || expression === "drowsy") {
    return "discomfort";
  }
  return "idle";
}

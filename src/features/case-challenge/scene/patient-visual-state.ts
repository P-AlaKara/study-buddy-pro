import type { GameState } from "../engine.js";
import type { PatientExpression } from "../schema.js";

export type BreathingPattern = "normal" | "rapid" | "laboured";

/**
 * Everything the patient's body needs to know to look right, derived from the
 * engine state. The scene receives only this object, never `GameState`, so
 * rendering stays decoupled from case logic.
 *
 * Today the figure is static and only `expression`/`talking` reach the HUD.
 * The animation sprint will map these fields onto clips: `breathing` drives
 * idle/rapid/laboured chest motion, `cues` toggle coughing, shivering, pain and
 * fever layers, and `talking` gates the speaking loop.
 */
export interface PatientVisualState {
  expression: PatientExpression;
  breathing: BreathingPattern;
  /** Breaths per minute, so a controller can time the chest cycle exactly. */
  respiratoryRate: number;
  heartRate: number;
  talking: boolean;
  cues: {
    pain: boolean;
    fever: boolean;
    shivering: boolean;
    coughing: boolean;
    drowsy: boolean;
  };
}

export function derivePatientVisualState(
  game: Pick<GameState, "vitals" | "patientExpression">,
  options: { talking: boolean },
): PatientVisualState {
  const { rr, hr, temp } = game.vitals;
  const expression = game.patientExpression;
  const breathing: BreathingPattern =
    expression === "struggling_to_breathe" || rr >= 30 ? "laboured" : rr >= 22 ? "rapid" : "normal";
  return {
    expression,
    breathing,
    respiratoryRate: rr,
    heartRate: hr,
    talking: options.talking,
    cues: {
      pain: expression === "in_pain",
      fever: temp >= 38,
      shivering: temp >= 39 || temp < 35.5,
      coughing: false,
      drowsy: expression === "drowsy",
    },
  };
}

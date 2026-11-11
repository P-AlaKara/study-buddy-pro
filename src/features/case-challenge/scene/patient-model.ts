import type { MedicalCase } from "../schema.js";
import {
  FALLBACK_PATIENT_MODEL,
  PATIENT_MODELS,
  type PatientModelId,
  type PatientModelSpec,
} from "./scene-config.js";

export interface PatientModelChoice {
  spec: PatientModelSpec;
  /** `case` when the model came from the case data, `fallback` otherwise. */
  source: "case" | "fallback";
}

function modelIdFromSex(sex: string): PatientModelId | null {
  const value = sex.trim().toLowerCase();
  if (value === "f" || value.startsWith("fem") || value.startsWith("woman")) return "female";
  if (value === "m" || value.startsWith("male") || value.startsWith("man")) return "male";
  return null;
}

/**
 * Pick the 3D patient for a case. An explicit `patient.model` wins; otherwise
 * the model follows `patient.sex`. Anything else uses `FALLBACK_PATIENT_MODEL`
 * and reports `source: "fallback"` so the UI can stay honest about it.
 */
export function resolvePatientModel(caseDefinition: MedicalCase): PatientModelChoice {
  const explicit = caseDefinition.patient.model;
  if (explicit && explicit in PATIENT_MODELS) {
    return { spec: PATIENT_MODELS[explicit], source: "case" };
  }
  const fromSex = modelIdFromSex(caseDefinition.patient.sex);
  if (fromSex) return { spec: PATIENT_MODELS[fromSex], source: "case" };
  return { spec: PATIENT_MODELS[FALLBACK_PATIENT_MODEL], source: "fallback" };
}

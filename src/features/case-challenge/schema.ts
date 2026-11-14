export const ACTION_CATEGORIES = ["ask", "examine", "test", "treat"] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

export const CLUE_TIERS = ["none", "obvious", "buried", "contradicting", "red_herring"] as const;
export type ClueTier = (typeof CLUE_TIERS)[number];

export const RESULT_TYPES = ["patient_reply", "text", "image", "lab_table", "ecg"] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export type ReviewStatus = "needs_clinician_review" | "clinician_reviewed";
export type PatientExpression =
  "neutral" | "in_pain" | "anxious" | "struggling_to_breathe" | "drowsy" | "relieved";

export interface PatientAvatarConfig {
  skinTone: string;
  hair: string;
  outfit: string;
  ageCues?: "young_adult" | "middle_aged" | "older_adult";
}

export interface CasePatient {
  name: string;
  age: number;
  sex: string;
  avatar: PatientAvatarConfig;
  personality: string;
  chiefComplaint: string;
  /**
   * Short presenting-feature chips shown on the patient viewport overlay
   * (e.g. "Short of breath", "Chest pain"). Falls back to the case specialty
   * when absent.
   */
  presentingTags?: string[];
  /**
   * Explicit choice of the pre-rendered hospital-ward background. When absent
   * the image is chosen from `sex` (see `components/patient-media.ts`).
   */
  model?: "female" | "male";
  initialExpression: PatientExpression;
}

export interface VitalsSnapshot {
  tMinute: number;
  hr: number;
  bp: string;
  rr: number;
  spo2: number;
  temp: number;
}

export interface VitalsDelta {
  hr?: number;
  systolicBp?: number;
  diastolicBp?: number;
  rr?: number;
  spo2?: number;
  temp?: number;
}

export interface DeteriorationRule {
  id: string;
  ifNotDoneBy: number;
  action: string;
  effect: VitalsDelta;
  alertLine: string;
  source: "nurse" | "patient" | "monitor";
  triggersEvent: string;
  lossAtMinute?: number;
}

export interface LabRow {
  test: string;
  result: string;
  reference?: string;
  flag?: "normal" | "high" | "low" | "critical";
}

/** Morphology presets the ECG generator (`ecg.ts`) can draw. */
export const ECG_PRESETS = [
  "sinus_normal",
  "pe_early",
  "pe_rv_strain",
  "lvh_strain",
  "lvh_effusion",
] as const;
export type EcgPreset = (typeof ECG_PRESETS)[number];

/**
 * A 12-lead ECG drawn at runtime rather than loaded from a file, so the
 * tracing always matches the patient's live heart rate. The engine fills in
 * `heartRate` when the action completes.
 */
export interface EcgTracing {
  preset: EcgPreset;
  heartRate?: number;
}

export interface CaseActionResult {
  type: ResultType;
  /**
   * May contain live-vital tokens resolved when the action completes:
   * `{hr}`, `{bp}`, `{sbp}`, `{dbp}`, `{rr}`, `{spo2}`, `{temp}` (each also
   * accepts an offset such as `{sbp-34}`) and `{rhythm}` ("Sinus
   * tachycardia" / "Sinus rhythm" / "Sinus bradycardia" from the rate).
   */
  content: string;
  assetId?: string;
  ecg?: EcgTracing;
  labs?: LabRow[];
  annotation?: {
    xPercent: number;
    yPercent: number;
    radiusPercent: number;
    label: string;
  };
}

export type VitalSign = "hr" | "systolicBp" | "diastolicBp" | "rr" | "spo2" | "temp";

/**
 * When a result variant applies. Every listed condition must hold; it is
 * evaluated against the patient at the moment the action completes (after
 * any deterioration during it, before the action's own vitals effect).
 */
export interface ResultCondition {
  /** All of these actions were completed earlier. */
  afterActions?: string[];
  /** None of these actions were completed earlier. */
  notAfterActions?: string[];
  /** All of these deterioration rules have fired. */
  afterDeterioration?: string[];
  /** Live vital-sign ranges: `atLeast` is inclusive, `below` is exclusive. */
  vitals?: Partial<Record<VitalSign, { atLeast?: number; below?: number }>>;
}

export interface ResultVariant {
  when: ResultCondition;
  /** Merged over the action's base result. */
  result: Partial<CaseActionResult>;
  /** Replaces the action's base vitals effect when this variant applies. */
  vitalsEffect?: VitalsDelta;
}

export interface ActionSafetyGate {
  explanation: string;
  anyActionIds?: string[];
  allActionIds?: string[];
  supportingActionThreshold?: {
    actionIds: string[];
    minimumCompleted: number;
  };
}

export interface CaseAction {
  id: string;
  category: ActionCategory;
  label: string;
  timeCostMin: number;
  moneyCost: number;
  riskNote: string;
  result: CaseActionResult;
  /**
   * State-dependent alternatives to `result`; the first matching variant
   * wins, otherwise the base result is used. This is how an action's response
   * tracks the patient (a repeat set of vitals, an ECG after deterioration).
   */
  variants?: ResultVariant[];
  clueTier: ClueTier;
  supports: string[];
  against: string[];
  triggersEvent: string;
  isKeyClue?: boolean;
  isCritical?: boolean;
  isUnnecessary?: boolean;
  harmful?: boolean;
  penalizeWhenUnsafe?: boolean;
  immediateFailure?: boolean;
  vitalsEffect?: VitalsDelta;
  safeWhen?: ActionSafetyGate;
}

export interface DifferentialDiagnosis {
  id: string;
  label: string;
  isCorrect: boolean;
  isTempting: boolean;
}

export interface CaseHint {
  tier: 1 | 2 | 3;
  cost: number;
  text: string;
}

export interface CaseSolution {
  diagnosis: string;
  diagnosisId: string;
  keyTreatment: string[];
  teachingPoints: [string, string, string];
  whyNotTempting: string;
  harmfulActionDebrief: Record<string, string>;
}

export interface CaseScoring {
  base: number;
  perMinutePenaltyAfter: number;
  perMinutePenalty: number;
  perUnnecessaryTest: number;
  perHarmfulAction: number;
  bonusKeyClueFoundEarly: number;
  earlyClueCutoffMinute: number;
  incorrectDiagnosisPenalty: number;
  perMissedKeyTreatment: number;
}

export interface CaseAsset {
  id: string;
  filename: string;
  sourceUrl: string;
  author: string;
  license: string;
  requiredAttributionText: string;
  altText: string;
  isPlaceholder: boolean;
}

export interface MedicalCase {
  id: string;
  slug: string;
  title: string;
  difficulty: 1 | 2 | 3;
  specialty: string[];
  setting: string;
  intro: string;
  reviewStatus: ReviewStatus;
  patient: CasePatient;
  vitalsTimeline: VitalsSnapshot[];
  deteriorationRules: DeteriorationRule[];
  actions: CaseAction[];
  differential: DifferentialDiagnosis[];
  hints: [CaseHint, CaseHint, CaseHint];
  solution: CaseSolution;
  scoring: CaseScoring;
  assets: CaseAsset[];
  mockComparisonPercent: number;
}

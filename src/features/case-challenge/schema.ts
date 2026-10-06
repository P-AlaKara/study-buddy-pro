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

export interface CaseActionResult {
  type: ResultType;
  content: string;
  assetId?: string;
  labs?: LabRow[];
  annotation?: {
    xPercent: number;
    yPercent: number;
    radiusPercent: number;
    label: string;
  };
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
  clueTier: ClueTier;
  supports: string[];
  against: string[];
  triggersEvent: string;
  isKeyClue?: boolean;
  isCritical?: boolean;
  isUnnecessary?: boolean;
  harmful?: boolean;
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

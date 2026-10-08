import type { PatientAvatarConfig } from "../case-challenge/schema.js";

export const OSCE_MODES = ["learn", "practice", "exam"] as const;
export type OsceMode = (typeof OSCE_MODES)[number];

export const OSCE_CATEGORIES = [
  "opening",
  "presenting_complaint",
  "history_of_symptom",
  "past_and_drug_history",
  "family_and_social",
  "communicate",
  "closing",
] as const;
export type OsceCategory = (typeof OSCE_CATEGORIES)[number];

export const CARD_STYLES = [
  "open",
  "closed",
  "leading",
  "judgmental",
  "jargon",
  "empathic",
  "facilitation",
  "multi_barrelled",
  "irrelevant",
  "dismissive",
] as const;
export type OsceCardStyle = (typeof CARD_STYLES)[number];

export const POOR_TECHNIQUE_STYLES = [
  "leading",
  "judgmental",
  "jargon",
  "multi_barrelled",
  "irrelevant",
  "dismissive",
] as const satisfies readonly OsceCardStyle[];

export type PatientExpression =
  "neutral" | "guarded" | "anxious" | "in_pain" | "relieved" | "tearful" | "worried" | "irritated";

export type RapportBand = "low" | "mid" | "high";
export type ExaminerSignal = "nod" | "eyebrow_raised" | "slight_frown" | "impressed" | "none";
export type CurveballResponseKind =
  "false_reassurance" | "evasive" | "deflecting" | "honest_empathic";

export interface OscePatient {
  name: string;
  age: number;
  sex: string;
  avatar: PatientAvatarConfig;
  personality: string;
  openingLine: string;
  initialExpression: PatientExpression;
}

export interface OsceCard {
  id: string;
  category: OsceCategory;
  label: string;
  style: OsceCardStyle;
  qualityTag?: string;
  timeCostSec: number;
  repeatable: boolean;
  sensitive: boolean;
  earlyRapportPenalty: number;
  unlockedBy: string[];
  availableOnlyInWindowOfCue: string | null;
  replies: Record<RapportBand, string>;
  revealsFacts: string[];
  conditionalFactReveal?: {
    minimumRapportBand: Exclude<RapportBand, "low">;
    factIds: string[];
  };
  satisfies: string[];
  penalises: string[];
  rapportDelta: number;
  examinerReaction: ExaminerSignal;
  triggersCue: string | null;
  triggersCurveball: boolean;
  curveballResponseKind?: CurveballResponseKind;
}

export interface OsceCue {
  id: string;
  type: "emotional" | "informational";
  patientLine: string;
  pickupCardIds: string[];
  idealResponseCardId: string;
  minimumRapportBand: RapportBand;
  requiresCardIds: string[];
  windowActions: number;
  missedRapportPenalty: number;
}

export interface OsceCurveball {
  triggerAtPercentClock: number;
  patientLine: string;
  responseCardIds: string[];
  criticalFailCardIds: string[];
}

export interface OsceChecklistItem {
  id: string;
  domain:
    | "opening_and_consent"
    | "history_content"
    | "risk_and_red_flags"
    | "ice"
    | "communication"
    | "closing_and_safety";
  label: string;
  weight: number;
  criticalFailIfMissing: boolean;
  coachingLine: string;
}

export interface OsceCriticalFail {
  id: string;
  label: string;
  trigger: "action" | "missing_any_checklist" | "missing_all_checklist";
  triggeredBy: string[];
}

export interface ExaminerQuestionOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface ExaminerQuestion {
  id: string;
  prompt: string;
  type: "single" | "multi";
  options: ExaminerQuestionOption[];
  explanation: string;
}

export interface ModelRunStep {
  cardId: string;
  reason: string;
}

export interface RatingThresholds {
  borderline: number;
  pass: number;
  good: number;
  excellent: number;
  criticalFailCap: "clear_fail";
  componentWeights: {
    checklist: number;
    communication: number;
    timeManagement: number;
    examinerQuestions: number;
  };
  communicationCaps: {
    borderlineIfRapportBelow: number;
    borderlineIfCommunicationBelow: number;
  };
}

export interface OsceNudge {
  tier: 1 | 2 | 3;
  pointCost: number;
  text: string;
}

export interface OsceStation {
  id: string;
  type: "history_taking";
  reviewStatus: "needs_clinician_review" | "clinician_reviewed";
  title: string;
  setting: string;
  clockSeconds: number;
  readingSeconds: number;
  candidateInstructions: string;
  examinerNote: string;
  patient: OscePatient;
  facts: Record<string, string>;
  cards: OsceCard[];
  cues: OsceCue[];
  curveball: OsceCurveball;
  checklist: OsceChecklistItem[];
  criticalFails: OsceCriticalFail[];
  examinerQuestions: ExaminerQuestion[];
  modelRun: ModelRunStep[];
  nudges: [OsceNudge, OsceNudge, OsceNudge];
  ratingThresholds: RatingThresholds;
  idleDrift: {
    startsAfterRealSeconds: number;
    realSecondsPerSimulatedSecond: number;
    pausedInLearn: boolean;
  };
}

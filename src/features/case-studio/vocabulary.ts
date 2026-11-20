import type {
  ActionCategory,
  ClueTier,
  EcgPreset,
  PatientExpression,
  ResultType,
  VitalSign,
} from "@/features/case-challenge/schema";

/*
 * Plain-language vocabulary for the case studio.
 *
 * Every term a clinician sees in the builder or the review comes from here, so
 * the wording stays consistent between "create" and "review" and nobody has
 * to learn the schema's field names. Descriptions state what the simulator
 * actually does with a value; nothing here adds behaviour.
 */

/* ---- Steps ------------------------------------------------------------- */

export const BUILD_STEPS = [
  "basics",
  "patient",
  "history",
  "examination",
  "tests",
  "treatment",
  "progression",
  "scoring",
  "finish",
] as const;
export type BuildStep = (typeof BUILD_STEPS)[number];

export const REVIEW_STAGES = [
  "patient",
  "history",
  "examination",
  "tests",
  "treatment",
  "progression",
  "scoring",
  "decision",
] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export const BUILD_STEP_META: Record<BuildStep, { title: string; short: string; blurb: string }> = {
  basics: {
    title: "Case basics & learning goals",
    short: "Basics",
    blurb: "Name the case, set the diagnosis and decide what students should take away.",
  },
  patient: {
    title: "Patient & first impressions",
    short: "Patient",
    blurb: "Who the patient is, where they are, and how they look on arrival.",
  },
  history: {
    title: "History taking",
    short: "History",
    blurb: "The questions students can ask and how the patient answers.",
  },
  examination: {
    title: "Physical examination",
    short: "Examination",
    blurb: "The examinations students can perform and what they find.",
  },
  tests: {
    title: "Tests & results",
    short: "Tests",
    blurb: "The investigations students can order, their results and any images.",
  },
  treatment: {
    title: "Treatment & management",
    short: "Treatment",
    blurb: "What students can do for the patient, and what happens when they do.",
  },
  progression: {
    title: "Patient progression",
    short: "Progression",
    blurb: "How the patient deteriorates over time when key actions are missed.",
  },
  scoring: {
    title: "Scoring & safety",
    short: "Scoring",
    blurb: "How students earn and lose points, the treatments they must give, and hints.",
  },
  finish: {
    title: "Preview & publish",
    short: "Finish",
    blurb: "Fix anything flagged, read the whole case, playtest it and publish it.",
  },
};

export const REVIEW_STAGE_META: Record<
  ReviewStage,
  { title: string; short: string; blurb: string }
> = {
  patient: {
    title: "Patient & clinical context",
    short: "Patient",
    blurb: "Meet the patient as the student does, then check the goals and diagnosis.",
  },
  history: {
    title: "History taking",
    short: "History",
    blurb: "Every question a student can ask, with the patient's reply and its significance.",
  },
  examination: {
    title: "Physical examination",
    short: "Examination",
    blurb: "Each examination and its finding. Check they fit the diagnosis.",
  },
  tests: {
    title: "Tests & results",
    short: "Tests",
    blurb: "Every investigation, its result, reference ranges and images.",
  },
  treatment: {
    title: "Treatment & management",
    short: "Treatment",
    blurb: "What students can do, and what happens to the patient afterwards.",
  },
  progression: {
    title: "Patient timeline",
    short: "Timeline",
    blurb: "How the patient improves, deteriorates or is lost over time.",
  },
  scoring: {
    title: "Scoring & patient safety",
    short: "Scoring",
    blurb: "How students are assessed, and why actions are judged safe or unsafe.",
  },
  decision: {
    title: "Summary & next steps",
    short: "Summary",
    blurb: "What you've covered, anything still flagged, and where the case goes next.",
  },
};

export const CATEGORY_STEP: Record<ActionCategory, BuildStep & ReviewStage> = {
  ask: "history",
  examine: "examination",
  test: "tests",
  treat: "treatment",
};

/** Builder step ↔ review stage, for switching modes without losing your place. */
export function reviewStageForStep(step: BuildStep): ReviewStage {
  if (step === "basics") return "patient";
  if (step === "finish") return "decision";
  return step;
}
export function buildStepForStage(stage: ReviewStage): BuildStep {
  return stage === "decision" ? "finish" : stage;
}

/* ---- Action categories --------------------------------------------------- */

export const CATEGORY_META: Record<
  ActionCategory,
  {
    noun: string;
    plural: string;
    /** Label for the student-facing action text field. */
    actionLabel: string;
    actionHelp: string;
    actionExample: string;
    /** Label for the response text field. */
    responseLabel: string;
    responseHelp: string;
    addLabel: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  ask: {
    noun: "question",
    plural: "questions",
    actionLabel: "What does the student ask?",
    actionHelp: "Write it as a button label the student taps.",
    actionExample: "Ask about recent travel",
    responseLabel: "What does the patient say?",
    responseHelp: "The patient's reply, in their own voice.",
    addLabel: "Add a question",
    emptyTitle: "No history questions yet",
    emptyBody:
      "Start with the presenting complaint, then add the questions that uncover risk factors and red flags.",
  },
  examine: {
    noun: "examination",
    plural: "examinations",
    actionLabel: "What does the student examine?",
    actionHelp: "Name the examination as the student would choose it.",
    actionExample: "Auscultate the chest",
    responseLabel: "What does the student find?",
    responseHelp: "The finding, written as the student would observe it.",
    addLabel: "Add an examination",
    emptyTitle: "No examinations yet",
    emptyBody:
      "Add each system the student can examine. Split inspection, palpation and auscultation into separate actions if the findings differ.",
  },
  test: {
    noun: "test",
    plural: "tests",
    actionLabel: "Which test does the student order?",
    actionHelp: "Use the name a clinician would request it by.",
    actionExample: "Chest X-ray",
    responseLabel: "Result summary",
    responseHelp: "The report or interpretation the student reads with the result.",
    addLabel: "Add a test",
    emptyTitle: "No tests yet",
    emptyBody:
      "Add the bedside, laboratory and imaging tests students may reach for, including ones that are not needed.",
  },
  treat: {
    noun: "treatment",
    plural: "treatments",
    actionLabel: "What does the student do?",
    actionHelp: "Include the drug, dose or route if it matters clinically.",
    actionExample: "Give supplemental oxygen",
    responseLabel: "What happens next?",
    responseHelp: "What the student sees after giving this treatment.",
    addLabel: "Add a treatment",
    emptyTitle: "No treatments yet",
    emptyBody:
      "Add the treatments that help, the ones that harm, and the tempting wrong ones. Students choose from all of them.",
  },
};

/**
 * Suggested clinical headings for each step. Authors can type their own; these
 * keep cases consistent and appear in this order.
 */
export const GROUP_PRESETS: Record<ActionCategory, readonly string[]> = {
  ask: [
    "Presenting complaint",
    "Associated symptoms",
    "Past medical & surgical history",
    "Medications & allergies",
    "Family & social history",
    "Sexual & reproductive history",
    "Risk factors & exposures",
  ],
  examine: [
    "General & observations",
    "Cardiovascular",
    "Respiratory",
    "Abdominal",
    "Neurological",
    "Pelvic & genitourinary",
    "Limbs & peripheral vascular",
    "Other examinations",
  ],
  test: ["Bedside tests", "Laboratory tests", "Imaging", "Referral & procedures", "Other tests"],
  treat: [
    "Resuscitation & stabilisation",
    "Fluids, electrolytes & blood",
    "Medications",
    "Referral & procedures",
    "Disposition",
    "Other management",
  ],
};

export const UNGROUPED = "Not grouped yet";

/* ---- Clue types ---------------------------------------------------------- */

export const CLUE_META: Record<ClueTier, { label: string; description: string }> = {
  none: {
    label: "Not a clue",
    description: "Has no diagnostic weight. Usual for treatments and routine steps.",
  },
  obvious: {
    label: "Obvious clue",
    description: "Points clearly towards (or away from) a diagnosis.",
  },
  buried: {
    label: "Hidden clue",
    description: "Only found if the student thinks to ask or look for it.",
  },
  contradicting: {
    label: "Challenging clue",
    description: "Goes against the first impression and makes the student think again.",
  },
  red_herring: {
    label: "Red herring",
    description: "Plausible but misleading. It points away from the real answer.",
  },
};

/* ---- Results ------------------------------------------------------------- */

export const RESULT_META: Record<ResultType, { label: string; description: string }> = {
  patient_reply: { label: "Patient's reply", description: "Spoken by the patient." },
  text: { label: "Written finding", description: "A finding, report or narration." },
  lab_table: { label: "Lab results table", description: "Rows of results with ranges." },
  image: { label: "Image", description: "An X-ray, scan, photo or other image." },
  ecg: { label: "12-lead ECG", description: "Drawn live at the patient's heart rate." },
};

/** The response formats offered for each step (any existing value stays selectable). */
export const RESULT_TYPES_FOR: Record<ActionCategory, readonly ResultType[]> = {
  ask: ["patient_reply", "text"],
  examine: ["text", "image"],
  test: ["text", "lab_table", "image", "ecg"],
  treat: ["text"],
};

export const ECG_META: Record<EcgPreset, { label: string; description: string }> = {
  sinus_normal: {
    label: "Normal",
    description: "Normal axis, intervals and ST segments.",
  },
  pe_early: {
    label: "Early pulmonary embolism",
    description: "Subtle T-wave inversion in V1 only; no ST elevation.",
  },
  pe_rv_strain: {
    label: "Right ventricular strain",
    description: "S1Q3T3, right axis, incomplete RBBB, T inversion V1–V4.",
  },
  lvh_strain: {
    label: "LV hypertrophy with strain",
    description: "High voltages with lateral ST depression and T inversion.",
  },
  lvh_effusion: {
    label: "LVH with pericardial effusion",
    description: "Unexpectedly low voltages with electrical alternans.",
  },
};

export const LAB_FLAG_META = {
  normal: { label: "Normal", symbol: "" },
  high: { label: "High", symbol: "↑" },
  low: { label: "Low", symbol: "↓" },
  critical: { label: "Critical", symbol: "!!" },
} as const;

/** Live-value tokens the engine fills in when an action completes. */
export const LIVE_TOKENS = [
  { token: "{hr}", label: "Heart rate" },
  { token: "{bp}", label: "Blood pressure" },
  { token: "{rr}", label: "Resp. rate" },
  { token: "{spo2}", label: "SpO₂" },
  { token: "{temp}", label: "Temperature" },
  { token: "{rhythm}", label: "Rhythm name" },
] as const;

/* ---- Vital signs --------------------------------------------------------- */

export const VITAL_META: Record<VitalSign, { label: string; short: string; unit: string }> = {
  hr: { label: "Heart rate", short: "HR", unit: "bpm" },
  systolicBp: { label: "Systolic BP", short: "SBP", unit: "mmHg" },
  diastolicBp: { label: "Diastolic BP", short: "DBP", unit: "mmHg" },
  rr: { label: "Respiratory rate", short: "RR", unit: "/min" },
  spo2: { label: "Oxygen saturation", short: "SpO₂", unit: "%" },
  temp: { label: "Temperature", short: "Temp", unit: "°C" },
};
export const VITAL_ORDER: readonly VitalSign[] = [
  "hr",
  "systolicBp",
  "diastolicBp",
  "rr",
  "spo2",
  "temp",
];

/* ---- Patient --------------------------------------------------------------- */

export const EXPRESSION_META: Record<PatientExpression, string> = {
  neutral: "Calm",
  in_pain: "In pain",
  anxious: "Anxious",
  struggling_to_breathe: "Struggling to breathe",
  drowsy: "Drowsy",
  relieved: "Relieved",
};

export const ALERT_SOURCE_META = {
  nurse: { label: "The nurse", verb: "tells the student" },
  patient: { label: "The patient", verb: "says" },
  monitor: { label: "The monitor", verb: "alarms" },
} as const;

export const SPECIALTY_SUGGESTIONS = [
  "Emergency",
  "Cardiology",
  "Pulmonology",
  "Endocrinology",
  "Internal Medicine",
  "Obstetrics & Gynaecology",
  "General Surgery",
  "Paediatrics",
  "Neurology",
  "Infectious Diseases",
  "Nephrology",
  "Gastroenterology",
  "Psychiatry",
  "Toxicology",
];

export const DIFFICULTY_META: Record<1 | 2 | 3, { label: string; description: string }> = {
  1: { label: "Foundation", description: "Early clinical years; a classic presentation." },
  2: { label: "Clinical", description: "Final-year level; one well-hidden clue." },
  3: { label: "Advanced", description: "Atypical presentation or a strong decoy." },
};

import {
  ACTION_CATEGORIES,
  type ActionCategory,
  type CaseAction,
  type MedicalCase,
} from "@/features/case-challenge/schema";
import { validateCase, type CaseValidationIssue } from "@/features/case-challenge/validator";

/*
 * Case helpers shared by the case studio and the case store on the server.
 *
 * Cases live in Supabase (`public.clinical_cases`, see
 * `src/server/cases/case-store.server.ts`). Drafts used to live only in the
 * browser; `loadLegacyDrafts` reads any left behind so the studio can move
 * them into the shared library.
 */

const LEGACY_DRAFTS_KEY = "medley.case-studio.drafts.v1";

export interface LegacyDraft {
  definition: MedicalCase;
  updatedAt: string;
  revisionOf?: string | undefined;
}

export function loadLegacyDrafts(): LegacyDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LegacyDraft =>
        !!entry &&
        typeof entry === "object" &&
        isRecord((entry as LegacyDraft).definition) &&
        typeof (entry as LegacyDraft).definition.id === "string",
    );
  } catch {
    return [];
  }
}

/** Forget browser-only drafts once they are in the shared library. */
export function clearLegacyDrafts(ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    const remaining = loadLegacyDrafts().filter((draft) => !ids.includes(draft.definition.id));
    if (remaining.length) window.localStorage.setItem(LEGACY_DRAFTS_KEY, JSON.stringify(remaining));
    else window.localStorage.removeItem(LEGACY_DRAFTS_KEY);
  } catch {
    // Nothing to clean up.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function newCaseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/** The next free `case_NNN` slug given the slugs already in use. */
export function nextSlug(taken: readonly string[]): string {
  const numbers = taken
    .map((slug) => /^case_(\d+)$/.exec(slug)?.[1])
    .filter((value): value is string => !!value)
    .map(Number);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `case_${String(next).padStart(3, "0")}`;
}

export function blankAction(category: ActionCategory, id = ""): CaseAction {
  return {
    id,
    category,
    label: "",
    timeCostMin: 1,
    moneyCost: 0,
    riskNote: "",
    result: { type: category === "ask" ? "patient_reply" : "text", content: "" },
    clueTier: "none",
    supports: [],
    against: [],
    triggersEvent: "",
  };
}

/** A skeleton case with sensible defaults; everything else is filled in by the author. */
export function blankCase(slug: string): MedicalCase {
  return {
    id: newCaseId(),
    slug,
    title: "",
    difficulty: 2,
    specialty: [],
    setting: "",
    intro: "",
    reviewStatus: "needs_clinician_review",
    patient: {
      name: "",
      age: 40,
      sex: "Female",
      avatar: { skinTone: "medium_brown", hair: "short_black", outfit: "plain_shirt" },
      personality: "",
      chiefComplaint: "",
      presentingTags: [],
      initialExpression: "neutral",
    },
    vitalsTimeline: [{ tMinute: 0, hr: 90, bp: "120/78", rr: 18, spo2: 97, temp: 37.0 }],
    deteriorationRules: [],
    actions: [],
    differential: [],
    hints: [
      { tier: 1, cost: 0, text: "" },
      { tier: 2, cost: 5, text: "" },
      { tier: 3, cost: 10, text: "" },
    ],
    solution: {
      diagnosis: "",
      diagnosisId: "",
      keyTreatment: [],
      teachingPoints: ["", "", ""],
      whyNotTempting: "",
      harmfulActionDebrief: {},
    },
    scoring: {
      base: 100,
      perMinutePenaltyAfter: 20,
      perMinutePenalty: -1,
      perUnnecessaryTest: -3,
      perHarmfulAction: -15,
      bonusKeyClueFoundEarly: 10,
      earlyClueCutoffMinute: 8,
      incorrectDiagnosisPenalty: -40,
      perMissedKeyTreatment: -5,
    },
    assets: [],
    mockComparisonPercent: 60,
  };
}

/**
 * Copy a case to start a new one. The server assigns the real id and slug;
 * images keep pointing at the files the source case uses.
 */
export function duplicateCase(source: MedicalCase, slug: string): MedicalCase {
  const copy = structuredClone(source);
  return {
    ...copy,
    id: newCaseId(),
    slug,
    title: `${source.title} (copy)`,
    reviewStatus: "needs_clinician_review",
    assets: copy.assets.map((asset) =>
      asset.url ? asset : { ...asset, url: `/cases/${source.slug}/${asset.filename}` },
    ),
  };
}

/*
 * ---- Validation -----------------------------------------------------------
 * The shared validator assumes a well-typed `MedicalCase`. Drafts arrive as
 * JSON, so the studio first checks the shape (so nothing throws), then runs
 * the same validator CI uses, then adds non-blocking quality warnings.
 */

export interface StudioIssue extends CaseValidationIssue {
  severity: "error" | "warning";
}

const ARRAY_FIELDS = [
  "specialty",
  "vitalsTimeline",
  "deteriorationRules",
  "actions",
  "differential",
  "hints",
  "assets",
] as const;

/** Structural problems that would stop the editor or the engine from reading a case. */
export function checkCaseShape(value: unknown): StudioIssue[] {
  const issues: StudioIssue[] = [];
  if (!isRecord(value)) {
    return [{ severity: "error", path: "case", message: "A case must be a JSON object." }];
  }
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) {
      issues.push({ severity: "error", path: field, message: `${field} must be an array.` });
    }
  }
  for (const field of ["patient", "solution", "scoring"] as const) {
    if (!isRecord(value[field])) {
      issues.push({ severity: "error", path: field, message: `${field} must be an object.` });
    }
  }
  const solution = value["solution"];
  if (isRecord(solution)) {
    if (!Array.isArray(solution["keyTreatment"])) {
      issues.push({
        severity: "error",
        path: "solution.keyTreatment",
        message: "keyTreatment must be an array of treatment action ids.",
      });
    }
    if (!Array.isArray(solution["teachingPoints"])) {
      issues.push({
        severity: "error",
        path: "solution.teachingPoints",
        message: "teachingPoints must be an array of three strings.",
      });
    }
    if (!isRecord(solution["harmfulActionDebrief"])) {
      issues.push({
        severity: "error",
        path: "solution.harmfulActionDebrief",
        message: "harmfulActionDebrief must be an object keyed by action id.",
      });
    }
  }
  if (Array.isArray(value["actions"])) {
    (value["actions"] as unknown[]).forEach((action, index) => {
      if (!isRecord(action)) {
        issues.push({ severity: "error", path: `actions.${index}`, message: "Not an object." });
        return;
      }
      const path = `actions.${typeof action["id"] === "string" && action["id"] ? action["id"] : index}`;
      if (!ACTION_CATEGORIES.includes(action["category"] as ActionCategory)) {
        issues.push({ severity: "error", path, message: "Unknown action category." });
      }
      if (!isRecord(action["result"])) {
        issues.push({ severity: "error", path, message: "Action has no result." });
      }
      for (const field of ["supports", "against"] as const) {
        if (!Array.isArray(action[field])) {
          issues.push({ severity: "error", path, message: `${field} must be an array.` });
        }
      }
    });
  }
  return issues;
}

const CATEGORY_PLURAL: Record<ActionCategory, string> = {
  ask: "history questions",
  examine: "examinations",
  test: "tests",
  treat: "treatments",
};

/*
 * Authoring-quality suggestions. Unlike validator errors these never block a
 * case; they are worded for clinicians and their paths tell the studio which
 * step to open (`actions.@<flag>` paths point at a step, not one action).
 */
function qualityWarnings(definition: MedicalCase): StudioIssue[] {
  const warnings: StudioIssue[] = [];
  const warn = (path: string, message: string) =>
    warnings.push({ severity: "warning", path, message });

  for (const category of ACTION_CATEGORIES) {
    if (!definition.actions.some((action) => action.category === category)) {
      warn(`actions.@${category}`, `No ${CATEGORY_PLURAL[category]} yet.`);
    }
  }
  const keyClues = definition.actions.filter((action) => action.isKeyClue);
  if (keyClues.length < 2) {
    warn(
      "actions.@keyClue",
      "Mark at least two findings as key clues so one lucky question can't give the case away.",
    );
  }
  if (
    keyClues.length &&
    Math.min(...keyClues.map((action) => action.timeCostMin)) >
      definition.scoring.earlyClueCutoffMinute
  ) {
    warn(
      "scoring.earlyClueCutoffMinute",
      `No key clue can be found by minute ${definition.scoring.earlyClueCutoffMinute}, so the early-clue bonus can never be earned.`,
    );
  }
  if (!definition.deteriorationRules.length) {
    warn(
      "deteriorationRules",
      "Nothing is time-critical yet. Add at least one deterioration event.",
    );
  } else if (!definition.deteriorationRules.some((rule) => rule.lossAtMinute !== undefined)) {
    warn("deteriorationRules", "No event can lose the patient, so delay never ends the case.");
  }
  if (!definition.actions.some((action) => action.harmful)) {
    warn("actions.@harmful", "Add at least one harmful action so students meet a penalised path.");
  }
  if (!definition.actions.some((action) => action.immediateFailure)) {
    warn("actions.@fatal", "Add an action that ends the case, such as an unsafe discharge.");
  }
  if (!definition.actions.some((action) => action.isUnnecessary)) {
    warn("actions.@unnecessary", "Add an unnecessary test to discourage over-investigation.");
  }
  if (!definition.patient.presentingTags?.length) {
    warn("patient.presentingTags", "Add a few key features to show on the patient card.");
  }
  if (!definition.patient.personality.trim()) {
    warn(
      "patient.personality",
      "Describe how the patient speaks so their replies stay in character.",
    );
  }
  if (!definition.patient.chiefComplaint.trim()) {
    warn("patient.chiefComplaint", "Add the presenting complaint.");
  }
  for (const action of definition.actions) {
    if (!action.label.trim()) warn(`actions.${action.id}.label`, "This action has no wording yet.");
    if (!action.result.content.trim()) {
      warn(`actions.${action.id}.result`, "The response students see is empty.");
    }
    if (action.clueTier !== "none" && !action.supports.length && !action.against.length) {
      warn(
        `actions.${action.id}.evidence`,
        "This clue isn't linked to any diagnosis, so students can't use it as evidence.",
      );
    }
  }
  if (!definition.solution.whyNotTempting.trim()) {
    warn(
      "solution.whyNotTempting",
      "Explain why the tempting diagnosis is wrong (shown in the debrief).",
    );
  }
  if (definition.solution.teachingPoints.some((point) => !point.trim())) {
    warn("solution.teachingPoints", "A teaching point is empty.");
  }
  for (const asset of definition.assets) {
    if (asset.isPlaceholder) {
      warn(`assets.${asset.id}`, "This image is a placeholder; its licence is not confirmed yet.");
    }
  }
  return warnings;
}

/** Everything the studio knows about a case definition, errors first. */
export function inspectCase(value: unknown): StudioIssue[] {
  const shape = checkCaseShape(value);
  if (shape.length) return shape;
  const definition = value as MedicalCase;
  try {
    const errors = validateCase(definition).map<StudioIssue>((issue) => ({
      ...issue,
      severity: "error",
    }));
    // An image added in the studio but never uploaded has nothing to show.
    for (const asset of definition.assets) {
      if (!asset.url && !asset.filename) {
        errors.push({
          severity: "error",
          path: `assets.${asset.id}`,
          message: "Upload the image file, or remove this image.",
        });
      }
    }
    return [...errors, ...qualityWarnings(definition)];
  } catch (error) {
    return [
      {
        severity: "error",
        path: "case",
        message: `Validation crashed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

/** Parse a pasted / uploaded JSON case. Throws a readable message on failure. */
export function parseCaseJson(text: string): MedicalCase {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const shape = checkCaseShape(parsed);
  if (shape.length) {
    throw new Error(shape.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
  return parsed as MedicalCase;
}

export function downloadTextFile(filename: string, content: string, type = "text/plain"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

import {
  ACTION_CATEGORIES,
  type ActionCategory,
  type CaseAction,
  type MedicalCase,
} from "@/features/case-challenge/schema";
import { validateCase, type CaseValidationIssue } from "@/features/case-challenge/validator";

/*
 * Draft storage and helpers for the case studio.
 *
 * The case bank is source code (`src/features/case-challenge/cases/*.ts`), so a
 * draft is not "published" by the studio: it is validated here, exported as a
 * TypeScript module and committed by a developer. Drafts autosave to this
 * browser's localStorage so a creator can work across sessions; "Export" and
 * "Import JSON" move them between people or machines.
 */

const DRAFTS_KEY = "medley.case-studio.drafts.v1";

export interface CaseDraft {
  definition: MedicalCase;
  updatedAt: string;
}

export function loadDrafts(): CaseDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CaseDraft =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as CaseDraft).updatedAt === "string" &&
        isRecord((entry as CaseDraft).definition) &&
        typeof (entry as CaseDraft).definition.id === "string",
    );
  } catch {
    return [];
  }
}

export function saveDrafts(drafts: readonly CaseDraft[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Private mode / quota: the studio keeps working in memory.
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

/** Copy a bank case into a new draft with a fresh id and slug. */
export function duplicateCase(source: MedicalCase, slug: string): MedicalCase {
  return {
    ...structuredClone(source),
    id: newCaseId(),
    slug,
    title: `${source.title} (copy)`,
    reviewStatus: "needs_clinician_review",
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

function shapeIssues(value: unknown): StudioIssue[] {
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

function qualityWarnings(definition: MedicalCase): StudioIssue[] {
  const warnings: StudioIssue[] = [];
  const warn = (path: string, message: string) =>
    warnings.push({ severity: "warning", path, message });

  if (definition.reviewStatus !== "clinician_reviewed") {
    warn("reviewStatus", "Needs clinician review before release.");
  }
  for (const category of ACTION_CATEGORIES) {
    if (!definition.actions.some((action) => action.category === category)) {
      warn("actions", `No "${category}" actions; every category should offer something.`);
    }
  }
  const keyClues = definition.actions.filter((action) => action.isKeyClue);
  if (keyClues.length < 2) warn("actions", "Fewer than two key clues makes the case guessable.");
  if (
    keyClues.length &&
    Math.min(...keyClues.map((action) => action.timeCostMin)) >
      definition.scoring.earlyClueCutoffMinute
  ) {
    warn("scoring.earlyClueCutoffMinute", "No key clue can be found before the early-clue cutoff.");
  }
  if (!definition.deteriorationRules.length) {
    warn("deteriorationRules", "No deterioration rules: nothing is time-critical.");
  } else if (!definition.deteriorationRules.some((rule) => rule.lossAtMinute !== undefined)) {
    warn("deteriorationRules", "No rule has a lossAtMinute, so the patient can never be lost.");
  }
  if (!definition.actions.some((action) => action.harmful)) {
    warn("actions", "No harmful actions: there is no penalised path to learn from.");
  }
  if (!definition.actions.some((action) => action.immediateFailure)) {
    warn("actions", "No immediate-failure action (e.g. a discharge) defines a loss ending.");
  }
  if (!definition.actions.some((action) => action.isUnnecessary)) {
    warn("actions", "No unnecessary test to penalise over-investigation.");
  }
  if (!definition.actions.some((action) => action.isCritical)) {
    warn("actions", "Mark stabilising actions (monitoring, access, oxygen…) as critical.");
  }
  if (!definition.patient.presentingTags?.length) {
    warn("patient.presentingTags", "Add presenting-feature chips for the ward overlay.");
  }
  if (!definition.patient.personality.trim()) {
    warn("patient.personality", "Describe the patient's voice so replies stay in character.");
  }
  if (!definition.patient.chiefComplaint.trim()) {
    warn("patient.chiefComplaint", "Add a chief complaint.");
  }
  for (const action of definition.actions) {
    if (!action.label.trim()) warn(`actions.${action.id}`, "Action has no label.");
    if (!action.result.content.trim()) {
      warn(`actions.${action.id}.result`, "Result text is empty.");
    }
    if (action.clueTier !== "none" && !action.supports.length && !action.against.length) {
      warn(`actions.${action.id}`, "Evidence that supports or refutes nothing cannot be tagged.");
    }
  }
  if (definition.vitalsTimeline.length < 2) {
    warn("vitalsTimeline", "Add a later snapshot so authors can see the deterioration arc.");
  }
  if (!definition.solution.whyNotTempting.trim()) {
    warn("solution.whyNotTempting", "Explain why the tempting diagnosis fails.");
  }
  if (definition.solution.teachingPoints.some((point) => !point.trim())) {
    warn("solution.teachingPoints", "A teaching point is empty.");
  }
  for (const asset of definition.assets) {
    if (asset.isPlaceholder) warn(`assets.${asset.id}`, "Placeholder asset; see TODO_ASSETS.md.");
  }
  return warnings;
}

/** Everything the studio knows about a case definition, errors first. */
export function inspectCase(value: unknown): StudioIssue[] {
  const shape = shapeIssues(value);
  if (shape.length) return shape;
  const definition = value as MedicalCase;
  try {
    const errors = validateCase(definition).map<StudioIssue>((issue) => ({
      ...issue,
      severity: "error",
    }));
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
  const shape = shapeIssues(parsed);
  if (shape.length) {
    throw new Error(shape.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
  return parsed as MedicalCase;
}

/*
 * ---- Structure summary ----------------------------------------------------
 */

export interface CaseSummary {
  actionsByCategory: Record<ActionCategory, number>;
  clueTiers: Record<string, number>;
  keyClues: number;
  harmful: number;
  unnecessary: number;
  critical: number;
  gated: number;
  variants: number;
  /** Case minutes of the cheapest route through every key treatment. */
  earliestLoss: number | undefined;
  totalActionMinutes: number;
}

export function summarizeCase(definition: MedicalCase): CaseSummary {
  const actionsByCategory = { ask: 0, examine: 0, test: 0, treat: 0 };
  const clueTiers: Record<string, number> = {};
  let keyClues = 0;
  let harmful = 0;
  let unnecessary = 0;
  let critical = 0;
  let gated = 0;
  let variants = 0;
  let totalActionMinutes = 0;
  for (const action of definition.actions) {
    actionsByCategory[action.category] += 1;
    clueTiers[action.clueTier] = (clueTiers[action.clueTier] ?? 0) + 1;
    if (action.isKeyClue) keyClues += 1;
    if (action.harmful) harmful += 1;
    if (action.isUnnecessary) unnecessary += 1;
    if (action.isCritical) critical += 1;
    if (action.safeWhen) gated += 1;
    variants += action.variants?.length ?? 0;
    totalActionMinutes += action.timeCostMin;
  }
  const losses = definition.deteriorationRules
    .map((rule) => rule.lossAtMinute)
    .filter((minute): minute is number => minute !== undefined);
  return {
    actionsByCategory,
    clueTiers,
    keyClues,
    harmful,
    unnecessary,
    critical,
    gated,
    variants,
    earliestLoss: losses.length ? Math.min(...losses) : undefined,
    totalActionMinutes,
  };
}

/*
 * ---- Export ---------------------------------------------------------------
 */

export function toCamelCase(text: string): string {
  const words = text
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "untitledCase";
  const [first, ...rest] = words;
  const camel =
    first!.toLowerCase() +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
  return /^[0-9]/.test(camel) ? `case${camel}` : camel;
}

export function toKebabCase(text: string): string {
  const kebab = text
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return kebab || "untitled-case";
}

export function exportFileName(definition: MedicalCase): string {
  return `${toKebabCase(definition.title || definition.slug)}.ts`;
}

export function exportVariableName(definition: MedicalCase): string {
  return toCamelCase(definition.title || definition.slug);
}

/** A ready-to-commit module for `src/features/case-challenge/cases/`. */
export function toTypeScriptModule(definition: MedicalCase): string {
  const name = exportVariableName(definition);
  return [
    'import type { MedicalCase } from "../schema.js";',
    "",
    `export const ${name}: MedicalCase = ${JSON.stringify(definition, null, 2)};`,
    "",
  ].join("\n");
}

/** The `public/cases/<slug>/assets.manifest.json` that mirrors the case assets. */
export function toAssetManifest(definition: MedicalCase): string {
  return `${JSON.stringify(definition.assets, null, 2)}\n`;
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

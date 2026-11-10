// Prompt builders + strict structured-output schemas for the Exam Generator.
//
// Pure module (only depends on zod) so it is unit-testable and safe to import
// anywhere. Every schema is OpenAI-strict friendly: all fields required, with
// `.nullable()` (never `.optional()`) for fields that may be absent.
import { z } from "zod";

export const EXAM_SYSTEM_PROMPT = [
  "You are an expert medical examiner writing assessment items for health-science students.",
  "You work ONLY from the source material the user provides. Never invent facts, drugs, values,",
  "guidelines, or findings that are not supported by the supplied text. If the material does not",
  "support a clinically safe question, do not write one. Questions must be unambiguous, clinically",
  "meaningful, and have a single defensible correct answer (for MCQs). Prefer breadth and depth of",
  "genuine understanding over superficial variations. Write in clear British/International medical",
  "English.",
].join(" ");

// ---------------------------------------------------------------------------
// Stage B — coverage map
// ---------------------------------------------------------------------------
export const coverageObjectiveSchema = z.object({
  subtopic: z.string().nullable(),
  objective: z.string(),
  bloom: z.string().nullable(),
  target_questions: z.number().int(),
  source_ref: z.string().nullable(),
});
export const coverageMapSchema = z.object({
  topics: z.array(
    z.object({
      topic: z.string(),
      objectives: z.array(coverageObjectiveSchema),
    }),
  ),
});
export type CoverageMapOutput = z.infer<typeof coverageMapSchema>;

export interface SourceUnitForPrompt {
  document: string;
  unitKind: "page" | "slide";
  unit: number;
  text: string;
}

export function buildCoverageMapPrompt(
  units: SourceUnitForPrompt[],
  focusAreas?: string | null,
): string {
  const body = units
    .map((u) => `[${u.document} · ${u.unitKind} ${u.unit}]\n${u.text}`)
    .join("\n\n");
  const focus = focusAreas?.trim();
  const focusBlock = focus
    ? [
        "",
        "STUDENT FOCUS — the student has asked for an exam concentrated on these areas:",
        focus,
        "Prioritise material relevant to these areas: identify every testable objective they",
        "contain, break them into fine-grained objectives, and set generous `target_questions`",
        "(e.g. 3–5) so the exam drills them deeply. Give little or no weight to clearly unrelated",
        "material. Never invent content to satisfy a focus area — ground every objective in the",
        "supplied text. If NONE of the requested areas appear in the material at all, ignore this",
        "focus and map the material comprehensively so the student still receives a usable exam.",
        "",
      ].join("\n")
    : "";
  return [
    focus
      ? "Analyse the following lecture material and build a coverage map of the testable learning"
      : "Analyse the following lecture material and build a COMPREHENSIVE coverage map of every",
    focus
      ? "objectives it contains that are relevant to the student's focus (see below). Break major"
      : "distinct, testable learning objective it contains. Break major topics into granular",
    "objectives (definitions, classifications, mechanisms, pathophysiology, clinical features,",
    "investigations, management, complications, contraindications, differentials, etc.) — but only",
    "where the material actually supports them.",
    focusBlock,
    "For each objective set `target_questions` to how many questions are needed to assess it well",
    "(usually 1–3; use more only for genuinely broad objectives). Set `source_ref` to a short",
    'citation like "<document> · <page/slide> N" when identifiable, else null. Do NOT skip material',
    focus
      ? "within the focus just to keep the list short — depth on the focus areas is the priority."
      : "just to keep the list short — coverage is the priority.",
    "",
    "SOURCE MATERIAL:",
    body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Stage C — question generation (a batch covering several objectives)
// ---------------------------------------------------------------------------
export const generatedQuestionSchema = z.object({
  objective_index: z.number().int(),
  type: z.enum(["mcq", "short", "long"]),
  question_text: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).nullable(),
  correct_option: z.string().nullable(),
  option_explanations: z.array(z.object({ id: z.string(), explanation: z.string() })).nullable(),
  model_answer: z.string().nullable(),
  explanation: z.string(),
  rubric: z.array(z.object({ point: z.string(), marks: z.number().int() })).nullable(),
  difficulty: z.number().int(),
  bloom: z.string().nullable(),
});
export const questionBatchSchema = z.object({ questions: z.array(generatedQuestionSchema) });
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export interface ObjectiveForPrompt {
  index: number;
  topic: string;
  subtopic: string | null;
  objective: string;
  bloom: string | null;
  target: number;
}

export function buildQuestionBatchPrompt(input: {
  objectives: ObjectiveForPrompt[];
  sourceExcerpt: string;
}): string {
  const objectives = input.objectives
    .map(
      (o) =>
        `#${o.index} — Topic: ${o.topic}${o.subtopic ? ` / ${o.subtopic}` : ""} — Objective: ${o.objective} — write ${o.target} question(s)${o.bloom ? ` — Bloom: ${o.bloom}` : ""}`,
    )
    .join("\n");
  return [
    "Write exam questions for the objectives below, grounded ONLY in the source excerpt. Reference",
    "each question's objective with `objective_index`.",
    "",
    "Use the most appropriate type per objective and mix types across the batch:",
    "- mcq: single best answer, 4–5 options with ids A,B,C,D(,E); set `correct_option` to the correct",
    "  id and give `option_explanations` for every option (why right/wrong). Clinical vignettes where",
    "  the material supports them. Leave model_answer and rubric null.",
    "- short: active-recall prompts (define/list/identify/state/differentiate/outline). Set",
    "  `model_answer`; leave options/correct_option/rubric null.",
    "- long: structured questions (explain/describe/compare/discuss). Set a thorough `model_answer`",
    "  and a `rubric` of marking points with marks; leave options/correct_option null.",
    "",
    "Always set a concise `explanation`. Set `difficulty` 1–5. Do not produce near-duplicate questions.",
    "If the excerpt cannot support a safe question for an objective, omit it rather than invent one.",
    "",
    `OBJECTIVES:\n${objectives}`,
    "",
    `SOURCE EXCERPT:\n${input.sourceExcerpt}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// On-demand written-answer grading. `sufficient_understanding` is the model's
// judgement of whether the student actually grasps the concept; it is what
// decides if the question counts as mastered, so it feeds topic performance and
// the weak areas offered for a focused retake.
// ---------------------------------------------------------------------------
export const writtenGradeSchema = z.object({
  verdict: z.enum(["correct", "partially_correct", "incorrect"]),
  sufficient_understanding: z.boolean(),
  feedback: z.string(),
});
export type WrittenGrade = z.infer<typeof writtenGradeSchema>;

export function buildGradingPrompt(input: {
  question: string;
  modelAnswer: string;
  rubric: { point: string; marks: number }[] | null;
  studentAnswer: string;
}): string {
  const rubric = input.rubric?.length
    ? `\nMARKING RUBRIC:\n${input.rubric.map((r) => `- (${r.marks}) ${r.point}`).join("\n")}`
    : "";
  return [
    "Evaluate the student's written answer against the expected answer and rubric only. Accept",
    "accurate paraphrases and tolerate typos; do not require exact wording. 'correct' = the essential",
    "points are present; 'partially_correct' = some key points missing; 'incorrect' = central meaning",
    "wrong or absent. Give concise, specific, encouraging feedback naming what was missed.",
    "",
    "Then judge `sufficient_understanding`: true if the answer shows the student genuinely grasps the",
    "concept being assessed — even where the wording is loose, the detail thin, or a minor point",
    "missing — and false if there is a real gap, a misconception, or the core idea is absent. Judge",
    "command of the concept, not completeness of phrasing. This flag alone decides whether the topic",
    "counts as mastered or is surfaced back to the student as a weak area to revise, so be accurate",
    "rather than generous: a 'partially_correct' answer can still show sufficient understanding, and",
    "a fluent answer that misses the point does not.",
    "",
    `QUESTION:\n${input.question}`,
    `\nEXPECTED ANSWER:\n${input.modelAnswer}${rubric}`,
    `\nSTUDENT ANSWER:\n${input.studentAnswer}`,
  ].join("\n");
}

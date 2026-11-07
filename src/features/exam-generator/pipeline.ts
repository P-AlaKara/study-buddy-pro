// Pure, deterministic orchestration logic for the Exam Generator. No I/O, no
// AI, no server imports — everything here is unit-tested in scripts/test-exams.ts.
import type {
  CoverageSummary,
  CoverageTopic,
  ExamOption,
  ObjectiveStatus,
  QuestionType,
  ResultsSummary,
  RubricPoint,
  TopicPerformance,
} from "./types";
import type { CoverageMapOutput, GeneratedQuestion } from "./prompts";

// ---------------------------------------------------------------------------
// Records produced by the pipeline before persistence.
// ---------------------------------------------------------------------------
export interface ObjectiveRecord {
  topic: string;
  subtopic: string | null;
  objective: string;
  bloom: string | null;
  targetQuestions: number;
  sourceRef: string | null;
  position: number;
}

export interface QuestionRecord {
  objectiveIndex: number | null;
  type: QuestionType;
  questionText: string;
  options: ExamOption[] | null;
  correctOption: string | null;
  optionExplanations: Record<string, string> | null;
  modelAnswer: string | null;
  explanation: string;
  rubric: RubricPoint[] | null;
  topic: string;
  subtopic: string | null;
  difficulty: number;
  bloom: string | null;
  sourceDocument: string | null;
  sourceRef: string | null;
  dedupHash: string;
}

// ---------------------------------------------------------------------------
// Text normalisation + dedup.
// ---------------------------------------------------------------------------
export function normalizeStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Small, stable, dependency-free hash (djb2) of the normalised stem. */
export function dedupHash(text: string): string {
  const s = normalizeStem(text);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeStem(text).split(" ").filter(Boolean));
}

export function jaccard(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isNearDuplicate(a: string, b: string, threshold = 0.82): boolean {
  if (normalizeStem(a) === normalizeStem(b)) return true;
  return jaccard(a, b) >= threshold;
}

/**
 * Filter `incoming` against questions already kept. Mutates the provided
 * accumulators so it can be called batch-by-batch across a long generation run.
 */
export function dedupeQuestions(
  incoming: QuestionRecord[],
  seenHashes: Set<string>,
  seenStems: string[],
  threshold = 0.82,
): { kept: QuestionRecord[]; duplicates: number } {
  const kept: QuestionRecord[] = [];
  let duplicates = 0;
  for (const q of incoming) {
    if (seenHashes.has(q.dedupHash)) {
      duplicates += 1;
      continue;
    }
    if (seenStems.some((stem) => isNearDuplicate(stem, q.questionText, threshold))) {
      duplicates += 1;
      continue;
    }
    kept.push(q);
    seenHashes.add(q.dedupHash);
    seenStems.push(q.questionText);
  }
  return { kept, duplicates };
}

// ---------------------------------------------------------------------------
// Coverage map handling.
// ---------------------------------------------------------------------------
function clampTarget(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.round(n)));
}

/** Merge partial coverage maps (from chunked analysis) into one, de-duplicating
 *  objectives within each topic by normalised objective text. */
export function mergeCoverageMaps(maps: CoverageMapOutput[]): CoverageMapOutput {
  const byTopic = new Map<
    string,
    {
      topic: string;
      seen: Set<string>;
      objectives: CoverageMapOutput["topics"][number]["objectives"];
    }
  >();
  for (const map of maps) {
    for (const topic of map.topics ?? []) {
      const key = normalizeStem(topic.topic);
      if (!key) continue;
      let entry = byTopic.get(key);
      if (!entry) {
        entry = { topic: topic.topic, seen: new Set(), objectives: [] };
        byTopic.set(key, entry);
      }
      for (const obj of topic.objectives ?? []) {
        const objKey = normalizeStem(obj.objective);
        if (!objKey || entry.seen.has(objKey)) continue;
        entry.seen.add(objKey);
        entry.objectives.push(obj);
      }
    }
  }
  return {
    topics: [...byTopic.values()].map((e) => ({ topic: e.topic, objectives: e.objectives })),
  };
}

/** Flatten a coverage map into ordered objective records. */
export function buildObjectiveRecords(map: CoverageMapOutput): ObjectiveRecord[] {
  const records: ObjectiveRecord[] = [];
  let position = 0;
  for (const topic of map.topics ?? []) {
    for (const obj of topic.objectives ?? []) {
      const objective = obj.objective?.trim();
      if (!objective) continue;
      records.push({
        topic: topic.topic.trim() || "General",
        subtopic: obj.subtopic?.trim() || null,
        objective,
        bloom: obj.bloom?.trim() || null,
        targetQuestions: clampTarget(obj.target_questions),
        sourceRef: obj.source_ref?.trim() || null,
        position: position++,
      });
    }
  }
  return records;
}

/** Group objective indices into batches bounded by objective count and the sum
 *  of their question targets, so no single generation call is asked for too much. */
export function planGenerationBatches(
  objectives: ObjectiveRecord[],
  opts: { maxObjectives?: number; maxTargets?: number } = {},
): number[][] {
  const maxObjectives = opts.maxObjectives ?? 6;
  const maxTargets = opts.maxTargets ?? 12;
  const batches: number[][] = [];
  let current: number[] = [];
  let targetSum = 0;
  objectives.forEach((obj, index) => {
    const next = obj.targetQuestions;
    if (current.length > 0 && (current.length >= maxObjectives || targetSum + next > maxTargets)) {
      batches.push(current);
      current = [];
      targetSum = 0;
    }
    current.push(index);
    targetSum += next;
  });
  if (current.length) batches.push(current);
  return batches;
}

// ---------------------------------------------------------------------------
// Normalising AI-generated questions into QuestionRecords (with validation).
// ---------------------------------------------------------------------------
function clampDifficulty(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function normalizeGeneratedQuestion(
  gen: GeneratedQuestion,
  objective: ObjectiveRecord | null,
): QuestionRecord | null {
  const questionText = gen.question_text?.trim();
  if (!questionText) return null;

  const base = {
    objectiveIndex: Number.isInteger(gen.objective_index) ? gen.objective_index : null,
    questionText,
    explanation: gen.explanation?.trim() ?? "",
    topic: objective?.topic ?? "General",
    subtopic: objective?.subtopic ?? null,
    difficulty: clampDifficulty(gen.difficulty),
    bloom: gen.bloom?.trim() || objective?.bloom || null,
    sourceDocument: null as string | null,
    sourceRef: objective?.sourceRef ?? null,
    dedupHash: dedupHash(questionText),
  };

  if (gen.type === "mcq") {
    const options = (gen.options ?? [])
      .map((o) => ({ id: (o.id ?? "").trim().toUpperCase(), text: (o.text ?? "").trim() }))
      .filter((o) => o.id && o.text);
    const uniqueIds = new Set(options.map((o) => o.id));
    if (options.length < 2 || uniqueIds.size !== options.length) return null;
    const correct = (gen.correct_option ?? "").trim().toUpperCase();
    if (!correct || !uniqueIds.has(correct)) return null;
    const explanations: Record<string, string> = {};
    for (const entry of gen.option_explanations ?? []) {
      const id = (entry.id ?? "").trim().toUpperCase();
      if (uniqueIds.has(id) && entry.explanation?.trim())
        explanations[id] = entry.explanation.trim();
    }
    return {
      ...base,
      type: "mcq",
      options,
      correctOption: correct,
      optionExplanations: Object.keys(explanations).length ? explanations : null,
      modelAnswer: null,
      rubric: null,
    };
  }

  // short / long
  const modelAnswer = gen.model_answer?.trim();
  if (!modelAnswer) return null;
  const rubric =
    gen.type === "long" && gen.rubric?.length
      ? gen.rubric
          .map((r) => ({
            point: r.point?.trim() ?? "",
            marks: Number.isFinite(r.marks) ? Math.round(r.marks) : 1,
          }))
          .filter((r) => r.point)
      : null;
  return {
    ...base,
    type: gen.type,
    options: null,
    correctOption: null,
    optionExplanations: null,
    modelAnswer,
    rubric: rubric && rubric.length ? rubric : null,
  };
}

// ---------------------------------------------------------------------------
// Coverage accounting + gap detection (deterministic "audit").
// ---------------------------------------------------------------------------
export function accountCoverage(
  objectives: ObjectiveRecord[],
  questionObjectiveIndexes: (number | null)[],
): { counts: number[]; statuses: ObjectiveStatus[]; gaps: number[]; uncovered: number[] } {
  const counts = objectives.map(() => 0);
  for (const idx of questionObjectiveIndexes) {
    if (idx != null && idx >= 0 && idx < counts.length) counts[idx]! += 1;
  }
  const statuses = objectives.map((obj, i): ObjectiveStatus => {
    const c = counts[i]!;
    if (c === 0) return "pending";
    if (c >= obj.targetQuestions) return "covered";
    return "partial";
  });
  const gaps: number[] = [];
  const uncovered: number[] = [];
  objectives.forEach((obj, i) => {
    if (counts[i]! === 0) uncovered.push(i);
    if (counts[i]! < obj.targetQuestions) gaps.push(i);
  });
  return { counts, statuses, gaps, uncovered };
}

/** After gap-fill, objectives still at 0 become 'unassessable'. */
export function finalizeStatuses(
  objectives: ObjectiveRecord[],
  questionObjectiveIndexes: (number | null)[],
): ObjectiveStatus[] {
  const { counts } = accountCoverage(objectives, questionObjectiveIndexes);
  return objectives.map((obj, i): ObjectiveStatus => {
    const c = counts[i]!;
    if (c === 0) return "unassessable";
    if (c >= obj.targetQuestions) return "covered";
    return "partial";
  });
}

// ---------------------------------------------------------------------------
// MCQ grading.
// ---------------------------------------------------------------------------
export function gradeMcq(correctOption: string | null, selected: string | null): boolean {
  if (!correctOption || !selected) return false;
  return correctOption.trim().toUpperCase() === selected.trim().toUpperCase();
}

/** Map a written-answer verdict to a scoreable boolean (partial → null). */
export function verdictToCorrect(verdict: string): boolean | null {
  if (verdict === "correct") return true;
  if (verdict === "incorrect") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Coverage summary for the exam overview.
// ---------------------------------------------------------------------------
export function buildCoverageSummary(
  objectives: { topic: string; status: ObjectiveStatus }[],
  questions: { type: QuestionType }[],
  warnings: string[],
): CoverageSummary {
  const topicMap = new Map<string, { total: number; covered: number; partial: number }>();
  let covered = 0;
  let partial = 0;
  let unassessable = 0;
  for (const obj of objectives) {
    const entry = topicMap.get(obj.topic) ?? { total: 0, covered: 0, partial: 0 };
    entry.total += 1;
    if (obj.status === "covered") {
      entry.covered += 1;
      covered += 1;
    } else if (obj.status === "partial") {
      entry.partial += 1;
      partial += 1;
    } else if (obj.status === "unassessable") {
      unassessable += 1;
    }
    topicMap.set(obj.topic, entry);
  }
  const topics: CoverageTopic[] = [...topicMap.entries()]
    .map(([topic, e]) => ({
      topic,
      total: e.total,
      covered: e.covered,
      percent: e.total ? Math.round(((e.covered + 0.5 * e.partial) / e.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
  const typeDistribution = { mcq: 0, short: 0, long: 0 };
  for (const q of questions) typeDistribution[q.type] += 1;
  return {
    topics,
    typeDistribution,
    objectives: { total: objectives.length, covered, partial, unassessable },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Flashcard adaptation.
// ---------------------------------------------------------------------------
export const FLASHCARD_FRONT_MAX = 600;
export const FLASHCARD_BACK_MAX = 1200;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

export interface FlashcardContent {
  front: string;
  back: string;
}

/**
 * Adapt an exam question into a single, readable flashcard. Long essays are
 * condensed (model answer trimmed, rubric points summarised) rather than dumped.
 */
export function toFlashcard(q: {
  type: QuestionType;
  questionText: string;
  options: ExamOption[] | null;
  correctOption: string | null;
  modelAnswer: string | null;
  explanation: string;
  rubric: RubricPoint[] | null;
}): FlashcardContent {
  if (q.type === "mcq" && q.options) {
    const optionsText = q.options.map((o) => `${o.id}. ${o.text}`).join("\n");
    const front = truncate(`${q.questionText}\n\n${optionsText}`, FLASHCARD_FRONT_MAX);
    const correct = q.options.find((o) => o.id === q.correctOption);
    const answerLine = correct ? `${correct.id}. ${correct.text}` : (q.correctOption ?? "");
    const back = truncate(
      `Answer: ${answerLine}${q.explanation ? `\n\n${q.explanation}` : ""}`,
      FLASHCARD_BACK_MAX,
    );
    return { front, back };
  }

  const front = truncate(q.questionText, FLASHCARD_FRONT_MAX);
  let answer = q.modelAnswer ?? "";
  if (q.rubric?.length) {
    const points = q.rubric.map((r) => `• ${r.point}`).join("\n");
    answer = answer ? `${answer}\n\nKey points:\n${points}` : `Key points:\n${points}`;
  }
  if (q.explanation && answer.length < FLASHCARD_BACK_MAX * 0.7) {
    answer = `${answer}\n\n${q.explanation}`;
  }
  return { front, back: truncate(answer || q.explanation || "See notes.", FLASHCARD_BACK_MAX) };
}

// ---------------------------------------------------------------------------
// Deterministic results summary (NO AI).
// ---------------------------------------------------------------------------
export function computeResultsSummary(
  questions: { id: string; type: QuestionType; topic: string }[],
  answers: {
    questionId: string;
    selectedOption: string | null;
    responseText: string | null;
    isCorrect: boolean | null;
  }[],
  savedFlashcards = 0,
): ResultsSummary {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  let answered = 0;
  let correct = 0;
  let incorrect = 0;
  let written = 0;
  const topicAgg = new Map<string, { total: number; correct: number }>();

  for (const q of questions) {
    if (q.type !== "mcq") written += 1;
    const agg = topicAgg.get(q.topic) ?? { total: 0, correct: 0 };
    agg.total += 1;
    const a = byId.get(q.id);
    const hasResponse = Boolean(
      a && (a.selectedOption || (a.responseText && a.responseText.trim())),
    );
    if (hasResponse) answered += 1;
    if (a?.isCorrect === true) {
      correct += 1;
      agg.correct += 1;
    } else if (a?.isCorrect === false) {
      incorrect += 1;
    }
    topicAgg.set(q.topic, agg);
  }

  const total = questions.length;
  const graded = correct + incorrect;
  const score = graded ? Math.round((correct / graded) * 100) : 0;
  const topicPerformance: TopicPerformance[] = [...topicAgg.entries()]
    .map(([topic, e]) => ({
      topic,
      correct: e.correct,
      total: e.total,
      percent: e.total ? Math.round((e.correct / e.total) * 100) : 0,
    }))
    .sort((a, b) => a.percent - b.percent);

  const message =
    graded === 0
      ? "Your exam is complete. Grade the written answers or review the explanations to see how you did."
      : score >= 80
        ? "Excellent work — strong command of this material. Review the few misses and keep them sharp."
        : score >= 60
          ? "Solid effort. Focus your revision on the lower-scoring topics below."
          : "A good start. The topics below need the most attention — the saved flashcards will help.";

  return {
    total,
    answered,
    correct,
    incorrect,
    unanswered: total - answered,
    written,
    score,
    savedFlashcards,
    topicPerformance,
    message,
  };
}

// ---------------------------------------------------------------------------
// Source-unit selection (grounding) — keeps generation calls from re-sending
// the whole corpus while still giving each batch the most relevant excerpts.
// ---------------------------------------------------------------------------
export interface SourceUnit {
  document: string;
  unitKind: "page" | "slide";
  unit: number;
  text: string;
}

/** Split units into char-bounded chunks for the (possibly multi-call) mapping stage. */
export function chunkUnitsByChars(units: SourceUnit[], budget = 22000): SourceUnit[][] {
  const chunks: SourceUnit[][] = [];
  let current: SourceUnit[] = [];
  let size = 0;
  for (const unit of units) {
    if (current.length && size + unit.text.length > budget) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(unit);
    size += unit.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[]];
}

function unitRefLabel(unit: SourceUnit): string {
  return normalizeStem(`${unit.document} ${unit.unitKind} ${unit.unit}`);
}

/**
 * Pick the units most relevant to a set of objectives, up to a char budget, by
 * token overlap (with a boost when an objective's source_ref names the unit).
 * Deterministic and self-contained so generation stays grounded without
 * resending the entire document on every batch.
 */
export function selectRelevantUnits(
  objectives: {
    objective: string;
    topic: string;
    subtopic: string | null;
    sourceRef: string | null;
  }[],
  units: SourceUnit[],
  budget = 15000,
): SourceUnit[] {
  if (units.length === 0) return [];
  const query = tokenSet(
    objectives.map((o) => `${o.topic} ${o.subtopic ?? ""} ${o.objective}`).join(" "),
  );
  const refs = objectives
    .map((o) => (o.sourceRef ? normalizeStem(o.sourceRef) : ""))
    .filter(Boolean);

  const scored = units.map((unit, index) => {
    const tokens = tokenSet(unit.text);
    let overlap = 0;
    for (const t of query) if (tokens.has(t)) overlap += 1;
    const label = unitRefLabel(unit);
    const refBoost = refs.some((r) => r.includes(label) || label.includes(r)) ? 8 : 0;
    return { unit, index, score: overlap + refBoost };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const chosen: SourceUnit[] = [];
  let size = 0;
  for (const entry of scored) {
    if (chosen.length && size + entry.unit.text.length > budget) continue;
    chosen.push(entry.unit);
    size += entry.unit.text.length;
    if (size >= budget) break;
  }
  // Restore reading order for coherent context.
  return chosen.sort((a, b) =>
    a.document === b.document ? a.unit - b.unit : a.document.localeCompare(b.document),
  );
}

// ---------------------------------------------------------------------------
// Progress estimation for the generation UI.
// ---------------------------------------------------------------------------
export function estimateProgressPercent(
  stage: string,
  data: { objectivesTotal: number; objectivesCovered: number; questionsGenerated: number },
): number {
  switch (stage) {
    case "extracting":
      return 8;
    case "mapping":
      return 25;
    case "generating": {
      if (data.objectivesTotal === 0) return 45;
      const ratio = Math.min(1, data.objectivesCovered / data.objectivesTotal);
      return 40 + Math.round(ratio * 45); // 40 → 85
    }
    case "auditing":
      return 92;
    case "done":
      return 100;
    default:
      return 0;
  }
}

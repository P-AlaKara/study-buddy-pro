// Server-only resumable generation worker for the Exam Generator.
//
// advanceGeneration() performs ONE bounded step of the pipeline per call
// (map a chunk → generate a batch → gap-fill → finalise), persisting progress
// after each step so the job survives timeouts and resumes on reopen. All
// progress is in the DB (job.progress + exam rows); the only transient data is
// the extracted source text in job.extracted_content, which is nulled the
// moment the job reaches a terminal stage.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateOpenAIJson, OpenAIGenerationError } from "@/lib/openai.server";
import {
  EXAM_SYSTEM_PROMPT,
  buildCoverageMapPrompt,
  buildQuestionBatchPrompt,
  coverageMapSchema,
  questionBatchSchema,
} from "./prompts";
import {
  accountCoverage,
  buildCoverageSummary,
  buildObjectiveRecords,
  chunkUnitsByChars,
  dedupeQuestions,
  estimateProgressPercent,
  finalizeStatuses,
  mergeCoverageMaps,
  normalizeGeneratedQuestion,
  planGenerationBatches,
  selectRelevantUnits,
  type ObjectiveRecord,
  type QuestionRecord,
  type SourceUnit,
} from "./pipeline";
import type { GenerationProgress, JobStage } from "./types";

const STALE_LOCK_MS = 120_000;
const MAX_ATTEMPTS = 6;
const MAX_AUDIT_BATCHES = 3;

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Read every row of a query in 1000-row pages so large exams are never capped. */
async function selectAll(builder: () => any): Promise<any[]> {
  const out: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function toProgress(stage: JobStage, p: any): GenerationProgress {
  const objectivesTotal = p.objectivesTotal ?? 0;
  const objectivesCovered = p.objectivesCovered ?? 0;
  const questionsGenerated = p.questionsGenerated ?? 0;
  return {
    stage,
    percent:
      typeof p.percent === "number"
        ? p.percent
        : estimateProgressPercent(stage, {
            objectivesTotal,
            objectivesCovered,
            questionsGenerated,
          }),
    message: p.message ?? "",
    filesProcessed: p.filesProcessed ?? 0,
    totalFiles: p.totalFiles ?? 0,
    unitCount: p.unitCount ?? 0,
    objectivesTotal,
    objectivesCovered,
    questionsGenerated,
    topicChips: p.topicChips ?? [],
    warnings: p.warnings ?? [],
  };
}

/** Read the current progress snapshot without advancing the job. */
export async function readGenerationProgress(
  examId: string,
  studentId: string,
): Promise<GenerationProgress> {
  const db = await adminDb();
  const { data: job, error } = await db
    .from("exam_generation_jobs")
    .select("stage,progress")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("This exam’s generation job was not found.");
  return toProgress(job.stage as JobStage, job.progress ?? {});
}

/**
 * Advance the generation job for `examId` by one step. Ownership is enforced by
 * `studentId`. Returns the current progress; never throws for a terminal job.
 */
export async function advanceGeneration(
  examId: string,
  studentId: string,
): Promise<GenerationProgress> {
  const db = await adminDb();

  // Load the job (scoped to the owner) with its transient extracted content.
  const { data: job, error } = await db
    .from("exam_generation_jobs")
    .select("*")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("This exam’s generation job was not found.");

  const stage = job.stage as JobStage;
  const progress = (job.progress ?? {}) as any;

  if (stage === "done" || stage === "failed" || stage === "cancelled") {
    return toProgress(stage, progress);
  }

  // Acquire a lock so a second poll doesn't run the same step concurrently.
  const staleIso = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data: locked } = await db
    .from("exam_generation_jobs")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", job.id)
    .or(`locked_at.is.null,locked_at.lt.${staleIso}`)
    .select("id")
    .maybeSingle();
  if (!locked) return toProgress(stage, progress); // another worker holds the lock

  const units = (job.extracted_content ?? []) as SourceUnit[];

  try {
    const result = await runStep(db, job, stage, progress, units);
    await db
      .from("exam_generation_jobs")
      .update({ stage: result.stage, progress: result.progress, locked_at: null, last_error: null })
      .eq("id", job.id);
    if (result.extractedContentCleared) {
      await db.from("exam_generation_jobs").update({ extracted_content: null }).eq("id", job.id);
    }
    return toProgress(result.stage, result.progress);
  } catch (err) {
    const attempts = (job.attempts ?? 0) + 1;
    const reason = err instanceof Error ? err.message : String(err);
    const retriable = err instanceof OpenAIGenerationError && err.code !== "unconfigured";

    if (attempts >= MAX_ATTEMPTS || !retriable) {
      // Give up: preserve whatever questions already exist (partial) or fail.
      return await finalizeFailure(db, examId, reason, progress);
    }
    await db
      .from("exam_generation_jobs")
      .update({ attempts, last_error: reason, locked_at: null })
      .eq("id", job.id);
    throw err instanceof OpenAIGenerationError
      ? err
      : new Error("Generation step failed. It will retry.");
  }
}

interface StepResult {
  stage: JobStage;
  progress: any;
  extractedContentCleared?: boolean;
}

async function runStep(
  db: any,
  job: any,
  stage: JobStage,
  progress: any,
  units: SourceUnit[],
): Promise<StepResult> {
  if (stage === "extracting" || stage === "mapping") {
    return mapStep(db, job, progress, units);
  }
  if (stage === "generating") {
    return generateStep(db, job, progress, units);
  }
  if (stage === "auditing") {
    return auditStep(db, job, progress, units);
  }
  return { stage, progress };
}

// --- Stage: coverage mapping (one source chunk per step) -------------------
async function mapStep(db: any, job: any, progress: any, units: SourceUnit[]): Promise<StepResult> {
  const chunks = chunkUnitsByChars(units);
  if (!progress.mapChunks) {
    progress.mapChunks = { total: chunks.length, done: 0 };
    progress.partialMaps = [];
    progress.filesProcessed = progress.totalFiles ?? 0;
    progress.message = "Mapping your material…";
  }
  const index = progress.mapChunks.done as number;
  const chunk = chunks[index] ?? [];

  const map = await generateOpenAIJson({
    system: EXAM_SYSTEM_PROMPT,
    prompt: buildCoverageMapPrompt(chunk, (progress.focusAreas as string | null) ?? null),
    schema: coverageMapSchema,
    schemaName: "coverage_map",
    role: "generation",
    maxTokens: 8000,
  });
  progress.partialMaps.push(map);
  progress.mapChunks.done = index + 1;
  progress.percent = estimateProgressPercent("mapping", progress);

  if (progress.mapChunks.done < progress.mapChunks.total) {
    return { stage: "mapping", progress };
  }

  // All chunks mapped → materialise objectives + plan generation.
  const merged = mergeCoverageMaps(progress.partialMaps);
  const objectives = buildObjectiveRecords(merged);
  if (objectives.length === 0) {
    throw new OpenAIGenerationError(
      "No testable learning objectives could be identified in the uploaded material.",
      "invalid_output",
    );
  }
  const rows = objectives.map((o) => ({
    exam_id: job.exam_id,
    topic: o.topic,
    subtopic: o.subtopic,
    objective: o.objective,
    bloom: o.bloom,
    status: "pending",
    target_questions: o.targetQuestions,
    source_ref: o.sourceRef,
    position: o.position,
  }));
  const { error } = await db.from("exam_objectives").insert(rows);
  if (error) throw new Error(error.message);

  const topicChips = [...new Set(objectives.map((o) => o.topic))].slice(0, 12);
  progress.objectivesTotal = objectives.length;
  progress.batchPlan = planGenerationBatches(objectives);
  progress.batchCursor = 0;
  progress.questionsGenerated = 0;
  progress.objectivesCovered = 0;
  progress.topicChips = topicChips;
  progress.message = "Generating questions…";
  delete progress.partialMaps;
  progress.percent = estimateProgressPercent("generating", progress);
  return { stage: "generating", progress };
}

async function loadObjectives(
  db: any,
  examId: string,
): Promise<(ObjectiveRecord & { id: string })[]> {
  const rows = await selectAll(() =>
    db
      .from("exam_objectives")
      .select("id,topic,subtopic,objective,bloom,target_questions,source_ref,position")
      .eq("exam_id", examId)
      .order("position"),
  );
  return rows.map((r: any) => ({
    id: r.id,
    topic: r.topic,
    subtopic: r.subtopic,
    objective: r.objective,
    bloom: r.bloom,
    targetQuestions: r.target_questions,
    sourceRef: r.source_ref,
    position: r.position,
  }));
}

async function loadExistingQuestions(
  db: any,
  examId: string,
): Promise<{
  hashes: Set<string>;
  stems: string[];
  count: number;
  objectiveIndexById: Map<string, number>;
}> {
  const rows = await selectAll(() =>
    db
      .from("exam_questions")
      .select("question_text,dedup_hash,objective_id")
      .eq("exam_id", examId)
      .order("position"),
  );
  const hashes = new Set<string>();
  const stems: string[] = [];
  for (const r of rows) {
    if (r.dedup_hash) hashes.add(r.dedup_hash);
    if (r.question_text) stems.push(r.question_text);
  }
  return { hashes, stems, count: rows.length, objectiveIndexById: new Map() };
}

async function generateBatchForObjectives(
  db: any,
  job: any,
  objectives: (ObjectiveRecord & { id: string })[],
  objectiveIdxs: number[],
  units: SourceUnit[],
  startPosition: number,
): Promise<number> {
  const batchObjectives = objectiveIdxs.map((i) => objectives[i]!);
  const promptObjectives = objectiveIdxs.map((i) => ({
    index: i,
    topic: objectives[i]!.topic,
    subtopic: objectives[i]!.subtopic,
    objective: objectives[i]!.objective,
    bloom: objectives[i]!.bloom,
    target: objectives[i]!.targetQuestions,
  }));
  const excerptUnits = selectRelevantUnits(batchObjectives, units);
  const sourceExcerpt = excerptUnits
    .map((u) => `[${u.document} · ${u.unitKind} ${u.unit}]\n${u.text}`)
    .join("\n\n");

  const out = await generateOpenAIJson({
    system: EXAM_SYSTEM_PROMPT,
    prompt: buildQuestionBatchPrompt({ objectives: promptObjectives, sourceExcerpt }),
    schema: questionBatchSchema,
    schemaName: "question_batch",
    role: "generation",
    maxTokens: 12000,
  });

  const records: QuestionRecord[] = [];
  for (const gen of out.questions) {
    const objective = objectives[gen.objective_index] ?? null;
    const record = normalizeGeneratedQuestion(gen, objective);
    if (record) records.push(record);
  }
  if (records.length === 0) return 0;

  // Dedupe against everything already stored for this exam.
  const existing = await loadExistingQuestions(db, job.exam_id);
  const { kept } = dedupeQuestions(records, existing.hashes, existing.stems);
  if (kept.length === 0) return 0;

  const rows = kept.map((r, i) => {
    const objective = r.objectiveIndex != null ? objectives[r.objectiveIndex] : null;
    return {
      exam_id: job.exam_id,
      objective_id: objective?.id ?? null,
      type: r.type,
      question_text: r.questionText,
      options: r.options,
      correct_option: r.correctOption,
      option_explanations: r.optionExplanations,
      model_answer: r.modelAnswer,
      explanation: r.explanation,
      rubric: r.rubric,
      topic: r.topic,
      subtopic: r.subtopic,
      difficulty: r.difficulty,
      bloom: r.bloom,
      source_document: objective?.sourceRef
        ? (objective.sourceRef.split("·")[0]?.trim() ?? null)
        : null,
      source_ref: r.sourceRef,
      position: startPosition + i,
      dedup_hash: r.dedupHash,
    };
  });
  const { error } = await db.from("exam_questions").insert(rows);
  if (error) throw new Error(error.message);
  return kept.length;
}

// --- Stage: generation (one batch per step) --------------------------------
async function generateStep(
  db: any,
  job: any,
  progress: any,
  units: SourceUnit[],
): Promise<StepResult> {
  const batchPlan: number[][] = progress.batchPlan ?? [];
  const cursor: number = progress.batchCursor ?? 0;
  if (cursor >= batchPlan.length) {
    progress.message = "Checking coverage…";
    progress.percent = estimateProgressPercent("auditing", progress);
    return { stage: "auditing", progress };
  }

  const objectives = await loadObjectives(db, job.exam_id);
  const existing = await loadExistingQuestions(db, job.exam_id);
  const added = await generateBatchForObjectives(
    db,
    job,
    objectives,
    batchPlan[cursor]!,
    units,
    existing.count,
  );

  progress.questionsGenerated = (progress.questionsGenerated ?? 0) + added;
  progress.batchCursor = cursor + 1;
  progress.objectivesCovered = Math.min(progress.objectivesTotal ?? 0, (cursor + 1) * 5);
  progress.message = `Generating questions… (${progress.questionsGenerated} so far)`;
  progress.percent = estimateProgressPercent("generating", progress);

  if (progress.batchCursor >= batchPlan.length) {
    progress.message = "Checking coverage…";
    return { stage: "auditing", progress };
  }
  return { stage: "generating", progress };
}

// --- Stage: audit + gap-fill + finalise ------------------------------------
async function auditStep(
  db: any,
  job: any,
  progress: any,
  units: SourceUnit[],
): Promise<StepResult> {
  const objectives = await loadObjectives(db, job.exam_id);
  const questionRows = await selectAll(() =>
    db.from("exam_questions").select("objective_id").eq("exam_id", job.exam_id).order("position"),
  );
  const idToIndex = new Map(objectives.map((o, i) => [o.id, i]));
  const indexes = questionRows.map((q: any) =>
    q.objective_id ? (idToIndex.get(q.objective_id) ?? null) : null,
  );

  const { uncovered } = accountCoverage(objectives, indexes);
  const auditBatches: number = progress.auditBatches ?? 0;

  if (uncovered.length > 0 && auditBatches < MAX_AUDIT_BATCHES) {
    const batch = uncovered.slice(0, 6);
    const added = await generateBatchForObjectives(
      db,
      job,
      objectives,
      batch,
      units,
      questionRows.length,
    );
    progress.questionsGenerated = (progress.questionsGenerated ?? questionRows.length) + added;
    progress.auditBatches = auditBatches + 1;
    progress.message = "Filling coverage gaps…";
    progress.percent = estimateProgressPercent("auditing", progress);
    // Stay in auditing: re-check on the next step.
    return { stage: "auditing", progress };
  }

  // Finalise.
  return finalize(db, job, objectives, progress);
}

async function finalize(
  db: any,
  job: any,
  objectives: (ObjectiveRecord & { id: string })[],
  progress: any,
): Promise<StepResult> {
  const questionRows = await selectAll(() =>
    db
      .from("exam_questions")
      .select("id,type,objective_id,topic")
      .eq("exam_id", job.exam_id)
      .order("position"),
  );
  const idToIndex = new Map(objectives.map((o, i) => [o.id, i]));
  const indexes = questionRows.map((q: any) =>
    q.objective_id ? (idToIndex.get(q.objective_id) ?? null) : null,
  );
  const statuses = finalizeStatuses(objectives, indexes);

  // Persist objective statuses grouped by value (few updates).
  const byStatus = new Map<string, string[]>();
  objectives.forEach((o, i) => {
    const s = statuses[i]!;
    const list = byStatus.get(s) ?? [];
    list.push(o.id);
    byStatus.set(s, list);
  });
  for (const [status, ids] of byStatus) {
    if (ids.length) await db.from("exam_objectives").update({ status }).in("id", ids);
  }

  const warnings: string[] = [...(progress.warnings ?? [])];
  const unassessable = statuses.filter((s) => s === "unassessable").length;
  if (unassessable > 0) {
    warnings.push(
      `${unassessable} learning objective${unassessable === 1 ? "" : "s"} could not be assessed from the material and ${unassessable === 1 ? "is" : "are"} flagged for manual review.`,
    );
  }
  const coverage = buildCoverageSummary(
    objectives.map((o, i) => ({ topic: o.topic, status: statuses[i]! })),
    questionRows.map((q: any) => ({ type: q.type })),
    warnings,
  );
  const questionCount = questionRows.length;
  const examStatus = questionCount === 0 ? "failed" : unassessable > 0 ? "partial" : "ready";

  await db
    .from("exams")
    .update({
      status: examStatus,
      question_count: questionCount,
      coverage_summary: coverage,
      generation_error:
        questionCount === 0 ? "No questions could be generated from the material." : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.exam_id);

  progress.percent = 100;
  progress.message = questionCount === 0 ? "Generation failed." : "Exam ready!";
  progress.objectivesCovered = coverage.objectives.covered + coverage.objectives.partial;
  progress.warnings = warnings;
  return {
    stage: questionCount === 0 ? "failed" : "done",
    progress,
    extractedContentCleared: true,
  };
}

async function finalizeFailure(
  db: any,
  examId: string,
  reason: string,
  progress: any,
): Promise<GenerationProgress> {
  const countRes = await db
    .from("exam_questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  const count = countRes.count ?? 0;
  const examStatus = count > 0 ? "partial" : "failed";

  await db
    .from("exams")
    .update({
      status: examStatus,
      question_count: count,
      generation_error:
        count > 0
          ? "Generation stopped early, but your questions were saved. You can retry to add more."
          : reason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", examId);
  await db
    .from("exam_generation_jobs")
    .update({
      stage: count > 0 ? "done" : "failed",
      extracted_content: null,
      locked_at: null,
      last_error: reason,
    })
    .eq("exam_id", examId);

  progress.percent = count > 0 ? 100 : 0;
  progress.message = count > 0 ? "Finished with some gaps." : "Generation failed.";
  return toProgress(count > 0 ? "done" : "failed", progress);
}

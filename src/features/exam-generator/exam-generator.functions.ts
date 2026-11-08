/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";
import { requireExamGeneratorEnabled } from "./feature-flag";
import { computeResultsSummary, gradeMcq, toFlashcard, verdictToCorrect } from "./pipeline";
import type {
  AttemptPayload,
  ExamAnswer,
  ExamListItem,
  ExamOption,
  ExamOverview,
  ExamQuestion,
  GenerationProgress,
  ResultsSummary,
  SourceDocumentMeta,
  TakingQuestion,
} from "./types";

const MAX_FILES = 15;

async function adminDb() {
  requireExamGeneratorEnabled();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Exams belong to students; a student's profileId is a students.id. */
function studentId(context: { profileId: string | null; role: string | null }): string {
  if (context.role !== "student" || !context.profileId) {
    throw new Error("The Exam Generator is available to student accounts.");
  }
  return context.profileId;
}

async function ownedExam(db: any, examId: string, student: string, columns = "*") {
  const { data, error } = await db
    .from("exams")
    .select(columns)
    .eq("id", examId)
    .eq("student_id", student)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Exam not found.");
  return data;
}

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

function toTakingQuestion(row: any): TakingQuestion {
  return {
    id: row.id,
    type: row.type,
    questionText: row.question_text,
    options: (row.options as ExamOption[] | null) ?? null,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    sourceDocument: row.source_document,
    sourceRef: row.source_ref,
    position: row.position,
  };
}

function toFullQuestion(row: any): ExamQuestion {
  return {
    id: row.id,
    type: row.type,
    questionText: row.question_text,
    options: (row.options as ExamOption[] | null) ?? null,
    correctOption: row.correct_option ?? null,
    optionExplanations: (row.option_explanations as Record<string, string> | null) ?? null,
    modelAnswer: row.model_answer ?? null,
    explanation: row.explanation ?? "",
    rubric: row.rubric ?? null,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    bloom: row.bloom ?? null,
    sourceDocument: row.source_document ?? null,
    sourceRef: row.source_ref ?? null,
    position: row.position,
  };
}

// ---------------------------------------------------------------------------
// Library / overview
// ---------------------------------------------------------------------------
export const listExams = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ExamListItem[]> => {
    const db = await adminDb();
    const student = studentId(context);
    const exams = await selectAll(() =>
      db
        .from("exams")
        .select(
          "id,title,status,question_count,source_documents,focus_areas,created_at,completed_at",
        )
        .eq("student_id", student)
        .order("created_at", { ascending: false }),
    );
    if (exams.length === 0) return [];
    const examIds = exams.map((e: any) => e.id);
    const attempts = await selectAll(() =>
      db
        .from("exam_attempts")
        .select("id,exam_id,status,score")
        .eq("student_id", student)
        .in("exam_id", examIds),
    );
    const attemptByExam = new Map(attempts.map((a: any) => [a.exam_id, a]));
    const answeredCounts = await Promise.all(
      attempts.map(async (a: any) => {
        const { count } = await db
          .from("exam_answers")
          .select("id", { count: "exact", head: true })
          .eq("attempt_id", a.id)
          .or("selected_option.not.is.null,response_text.not.is.null");
        return [a.exam_id, count ?? 0] as const;
      }),
    );
    const answeredByExam = new Map(answeredCounts);

    return exams.map((e: any): ExamListItem => {
      const attempt = attemptByExam.get(e.id);
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        questionCount: e.question_count,
        createdAt: e.created_at,
        completedAt: e.completed_at,
        sourceDocuments: (e.source_documents as SourceDocumentMeta[]) ?? [],
        focusAreas: e.focus_areas ?? null,
        attempt: attempt
          ? {
              status: attempt.status,
              answered: answeredByExam.get(e.id) ?? 0,
              total: e.question_count,
              score: attempt.score,
            }
          : null,
      };
    });
  });

export const getExamOverview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ExamOverview> => {
    const db = await adminDb();
    const student = studentId(context);
    const exam = await ownedExam(
      db,
      data.examId,
      student,
      "id,title,status,question_count,source_documents,coverage_summary,focus_areas,generation_error,created_at,completed_at",
    );
    return {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      questionCount: exam.question_count,
      sourceDocuments: (exam.source_documents as SourceDocumentMeta[]) ?? [],
      focusAreas: exam.focus_areas ?? null,
      coverage: exam.coverage_summary ?? {
        topics: [],
        typeDistribution: { mcq: 0, short: 0, long: 0 },
        objectives: { total: 0, covered: 0, partial: 0, unassessable: 0 },
        warnings: [],
      },
      generationError: exam.generation_error,
      createdAt: exam.created_at,
      completedAt: exam.completed_at,
    };
  });

// ---------------------------------------------------------------------------
// Create + generate
// ---------------------------------------------------------------------------
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim() || "Untitled notes";
}

export const createExamFromUploads = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: FormData) => input)
  .handler(async ({ data, context }): Promise<{ examId: string }> => {
    const db = await adminDb();
    const student = studentId(context);
    const { extractDocument, ExtractionError } = await import("./extract.server");

    // Optional student-directed focus. "specific" mode concentrates the exam on
    // the areas the student names (also used to pre-fill a weak-areas retake);
    // anything else is a general, comprehensive exam. null ⇒ general.
    const focusMode = (data.get("focusMode") as string | null) ?? "general";
    const focusAreasRaw = (data.get("focusAreas") as string | null) ?? "";
    const focusAreas =
      focusMode === "specific" && focusAreasRaw.trim() ? focusAreasRaw.trim().slice(0, 600) : null;

    const idempotencyKey = (data.get("idempotencyKey") as string | null)?.slice(0, 100) || null;
    if (idempotencyKey) {
      const { data: existing } = await db
        .from("exam_generation_jobs")
        .select("exam_id")
        .eq("student_id", student)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) return { examId: existing.exam_id };
    }

    const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new Error("Add at least one PDF or PowerPoint file.");
    if (files.length > MAX_FILES) throw new Error(`Upload at most ${MAX_FILES} files at once.`);

    const units: { document: string; unitKind: "page" | "slide"; unit: number; text: string }[] =
      [];
    const sourceDocuments: SourceDocumentMeta[] = [];
    const warnings: string[] = [];
    let firstError: string | null = null;

    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const extraction = await extractDocument(file.name, bytes);
        units.push(...extraction.units);
        sourceDocuments.push({
          name: file.name,
          kind: extraction.kind,
          unitCount: extraction.unitCount,
        });
        if (extraction.warning) warnings.push(extraction.warning);
      } catch (error) {
        const message =
          error instanceof ExtractionError
            ? `“${file.name}”: ${error.message}`
            : `“${file.name}” could not be processed.`;
        warnings.push(message);
        if (!firstError) firstError = message;
        console.error("[ExamGen] upload extraction failed", file.name, error);
      }
    }

    if (units.length === 0) {
      throw new Error(firstError ?? "None of the uploaded files contained readable text.");
    }

    const title =
      sourceDocuments.length > 1
        ? `${baseName(sourceDocuments[0]!.name)} + ${sourceDocuments.length - 1} more`
        : baseName((sourceDocuments[0] ?? { name: files[0]!.name }).name);

    const { data: exam, error: examError } = await db
      .from("exams")
      .insert({
        student_id: student,
        title: title.slice(0, 200),
        status: "generating",
        source_documents: sourceDocuments,
        focus_areas: focusAreas,
      })
      .select("id")
      .single();
    if (examError || !exam) throw new Error(examError?.message ?? "The exam could not be created.");

    const { error: jobError } = await db.from("exam_generation_jobs").insert({
      exam_id: exam.id,
      student_id: student,
      stage: "mapping",
      idempotency_key: idempotencyKey,
      extracted_content: units,
      progress: {
        percent: 8,
        message: "Analysing your material…",
        totalFiles: sourceDocuments.length,
        filesProcessed: sourceDocuments.length,
        unitCount: units.length,
        warnings,
        // Read back by the generation worker to steer the coverage map.
        focusAreas,
      },
    });
    if (jobError) {
      await db.from("exams").delete().eq("id", exam.id);
      throw new Error(jobError.message);
    }
    return { examId: exam.id };
  });

export const advanceExamGeneration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<GenerationProgress> => {
    requireExamGeneratorEnabled();
    const student = studentId(context);
    const { advanceGeneration } = await import("./generation.server");
    return advanceGeneration(data.examId, student);
  });

export const getGenerationProgress = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<GenerationProgress> => {
    requireExamGeneratorEnabled();
    const student = studentId(context);
    const { readGenerationProgress } = await import("./generation.server");
    return readGenerationProgress(data.examId, student);
  });

export const retryExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<GenerationProgress> => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const { data: job } = await db
      .from("exam_generation_jobs")
      .select("stage,extracted_content,progress")
      .eq("exam_id", data.examId)
      .eq("student_id", student)
      .maybeSingle();
    if (!job) throw new Error("This exam can’t be retried — please upload your notes again.");
    if (!job.extracted_content) {
      throw new Error(
        "The source text was already cleared. Please upload your notes again to regenerate.",
      );
    }
    const { count } = await db
      .from("exam_objectives")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", data.examId);
    await db
      .from("exam_generation_jobs")
      .update({
        stage: (count ?? 0) > 0 ? "generating" : "mapping",
        attempts: 0,
        locked_at: null,
        last_error: null,
      })
      .eq("exam_id", data.examId);
    await db
      .from("exams")
      .update({ status: "generating", generation_error: null })
      .eq("id", data.examId);
    const { advanceGeneration } = await import("./generation.server");
    return advanceGeneration(data.examId, student);
  });

export const cancelExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    // Cancelling discards the half-built exam and its temporary source text.
    await db.from("exams").delete().eq("id", data.examId).eq("student_id", student);
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    await db.from("exams").delete().eq("id", data.examId).eq("student_id", student);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Taking
// ---------------------------------------------------------------------------
async function getOrCreateAttempt(db: any, examId: string, student: string) {
  const { data: existing } = await db
    .from("exam_attempts")
    .select("id,status,current_index")
    .eq("exam_id", examId)
    .eq("student_id", student)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await db
    .from("exam_attempts")
    .insert({ exam_id: examId, student_id: student })
    .select("id,status,current_index")
    .single();
  if (error || !created) throw new Error(error?.message ?? "The attempt could not be started.");
  return created;
}

export const startOrResumeAttempt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AttemptPayload> => {
    const db = await adminDb();
    const student = studentId(context);
    const exam = await ownedExam(db, data.examId, student, "id,title,status,question_count");
    if (exam.status === "generating") throw new Error("This exam is still being generated.");
    if (exam.status === "failed") throw new Error("This exam failed to generate.");

    const attempt = await getOrCreateAttempt(db, data.examId, student);
    const questionRows = await selectAll(() =>
      db
        .from("exam_questions")
        .select(
          "id,type,question_text,options,topic,subtopic,difficulty,source_document,source_ref,position",
        )
        .eq("exam_id", data.examId)
        .order("position"),
    );
    const answerRows = await selectAll(() =>
      db
        .from("exam_answers")
        .select("question_id,selected_option,response_text,flagged")
        .eq("attempt_id", attempt.id),
    );
    // Exam mode: correctness is withheld until submission.
    const answers: ExamAnswer[] = answerRows.map((a: any) => ({
      questionId: a.question_id,
      selectedOption: a.selected_option,
      responseText: a.response_text,
      isCorrect: null,
      aiVerdict: null,
      aiFeedback: null,
      flagged: a.flagged,
    }));
    const saved = await selectAll(() =>
      db
        .from("exam_flashcards")
        .select("question_id")
        .eq("student_id", student)
        .in(
          "question_id",
          questionRows.map((q: any) => q.id),
        ),
    );
    return {
      examId: exam.id,
      examTitle: exam.title,
      attemptId: attempt.id,
      status: attempt.status,
      currentIndex: attempt.current_index,
      questions: questionRows.map(toTakingQuestion),
      answers,
      savedQuestionIds: [...new Set(saved.map((s: any) => s.question_id as string))],
    };
  });

async function loadAttempt(db: any, examId: string, student: string) {
  const { data, error } = await db
    .from("exam_attempts")
    .select("id,status,current_index")
    .eq("exam_id", examId)
    .eq("student_id", student)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No attempt in progress for this exam.");
  return data;
}

async function upsertAnswer(
  db: any,
  attemptId: string,
  questionId: string,
  patch: Partial<{
    selected_option: string | null;
    response_text: string | null;
    is_correct: boolean | null;
    ai_verdict: string | null;
    ai_feedback: string | null;
    flagged: boolean;
  }>,
) {
  const { data: existing } = await db
    .from("exam_answers")
    .select("selected_option,response_text,is_correct,ai_verdict,ai_feedback,flagged")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle();
  const row = {
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: existing?.selected_option ?? null,
    response_text: existing?.response_text ?? null,
    is_correct: existing?.is_correct ?? null,
    ai_verdict: existing?.ai_verdict ?? null,
    ai_feedback: existing?.ai_feedback ?? null,
    flagged: existing?.flagged ?? false,
    ...patch,
  };
  const { error } = await db
    .from("exam_answers")
    .upsert(row, { onConflict: "attempt_id,question_id" });
  if (error) throw new Error(error.message);
}

export const saveAnswer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        questionId: z.string().uuid(),
        selectedOption: z.string().max(8).nullable().optional(),
        responseText: z.string().max(20000).nullable().optional(),
        index: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const attempt = await loadAttempt(db, data.examId, student);
    if (attempt.status === "submitted") throw new Error("This exam has already been submitted.");

    const { data: question } = await db
      .from("exam_questions")
      .select("id,type,correct_option")
      .eq("id", data.questionId)
      .eq("exam_id", data.examId)
      .maybeSingle();
    if (!question) throw new Error("Question not found.");

    const patch: any = {};
    if (data.selectedOption !== undefined) {
      patch.selected_option = data.selectedOption;
      // MCQ correctness is graded deterministically on save (never returned).
      if (question.type === "mcq")
        patch.is_correct = gradeMcq(question.correct_option, data.selectedOption);
    }
    if (data.responseText !== undefined) {
      patch.response_text = data.responseText;
      // A changed written response invalidates any prior grade/feedback.
      patch.is_correct = null;
      patch.ai_verdict = null;
      patch.ai_feedback = null;
    }
    await upsertAnswer(db, attempt.id, data.questionId, patch);
    if (data.index !== undefined) {
      await db.from("exam_attempts").update({ current_index: data.index }).eq("id", attempt.id);
    }
    return { saved: true };
  });

export const toggleFlag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ examId: z.string().uuid(), questionId: z.string().uuid(), flagged: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const attempt = await loadAttempt(db, data.examId, student);
    await upsertAnswer(db, attempt.id, data.questionId, { flagged: data.flagged });
    return { flagged: data.flagged };
  });

export const setAttemptPosition = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ examId: z.string().uuid(), index: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const attempt = await loadAttempt(db, data.examId, student);
    await db.from("exam_attempts").update({ current_index: data.index }).eq("id", attempt.id);
    return { ok: true };
  });

async function countSavedFlashcards(
  db: any,
  student: string,
  questionIds: string[],
): Promise<number> {
  if (questionIds.length === 0) return 0;
  const rows = await selectAll(() =>
    db
      .from("exam_flashcards")
      .select("question_id")
      .eq("student_id", student)
      .in("question_id", questionIds),
  );
  return new Set(rows.map((r: any) => r.question_id)).size;
}

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ResultsSummary> => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const attempt = await loadAttempt(db, data.examId, student);

    const questions = await selectAll(() =>
      db
        .from("exam_questions")
        .select("id,type,topic,correct_option")
        .eq("exam_id", data.examId)
        .order("position"),
    );
    const answerRows = await selectAll(() =>
      db
        .from("exam_answers")
        .select("question_id,selected_option,response_text,is_correct")
        .eq("attempt_id", attempt.id),
    );
    const byId = new Map(answerRows.map((a: any) => [a.question_id, a]));

    // Authoritatively (re)grade MCQs; persist any corrections for the review.
    const corrected: Promise<any>[] = [];
    const answers = questions.map((q: any) => {
      const a = byId.get(q.id);
      let isCorrect = a?.is_correct ?? null;
      if (q.type === "mcq") {
        const graded = gradeMcq(q.correct_option, a?.selected_option ?? null);
        isCorrect = a?.selected_option ? graded : null;
        if (a && a.is_correct !== isCorrect) {
          corrected.push(
            db
              .from("exam_answers")
              .update({ is_correct: isCorrect })
              .eq("attempt_id", attempt.id)
              .eq("question_id", q.id),
          );
        }
      }
      return {
        questionId: q.id,
        selectedOption: a?.selected_option ?? null,
        responseText: a?.response_text ?? null,
        isCorrect,
      };
    });
    await Promise.all(corrected);

    const savedFlashcards = await countSavedFlashcards(
      db,
      student,
      questions.map((q: any) => q.id),
    );
    const summary = computeResultsSummary(
      questions.map((q: any) => ({ id: q.id, type: q.type, topic: q.topic })),
      answers,
      savedFlashcards,
    );
    await db
      .from("exam_attempts")
      .update({
        status: "submitted",
        score: summary.score,
        stats: summary,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    return summary;
  });

export const resetAttempt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const student = studentId(context);
    await ownedExam(db, data.examId, student, "id");
    const attempt = await loadAttempt(db, data.examId, student);
    await db.from("exam_answers").delete().eq("attempt_id", attempt.id);
    await db
      .from("exam_attempts")
      .update({
        status: "in_progress",
        current_index: 0,
        score: null,
        stats: null,
        submitted_at: null,
      })
      .eq("id", attempt.id);
    return { ok: true };
  });

export interface ExamReview {
  overview: ExamOverview;
  questions: ExamQuestion[];
  answers: ExamAnswer[];
  summary: ResultsSummary | null;
  savedQuestionIds: string[];
}

export const getExamReview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ExamReview> => {
    const db = await adminDb();
    const student = studentId(context);
    const exam = await ownedExam(
      db,
      data.examId,
      student,
      "id,title,status,question_count,source_documents,coverage_summary,focus_areas,generation_error,created_at,completed_at",
    );
    const attempt = await loadAttempt(db, data.examId, student);
    if (attempt.status !== "submitted") throw new Error("Submit the exam to see your review.");

    const questionRows = await selectAll(() =>
      db.from("exam_questions").select("*").eq("exam_id", data.examId).order("position"),
    );
    const answerRows = await selectAll(() =>
      db
        .from("exam_answers")
        .select(
          "question_id,selected_option,response_text,is_correct,ai_verdict,ai_feedback,flagged",
        )
        .eq("attempt_id", attempt.id),
    );
    const saved = await selectAll(() =>
      db
        .from("exam_flashcards")
        .select("question_id")
        .eq("student_id", student)
        .in(
          "question_id",
          questionRows.map((q: any) => q.id),
        ),
    );
    return {
      overview: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        questionCount: exam.question_count,
        sourceDocuments: (exam.source_documents as SourceDocumentMeta[]) ?? [],
        focusAreas: exam.focus_areas ?? null,
        coverage: exam.coverage_summary,
        generationError: exam.generation_error,
        createdAt: exam.created_at,
        completedAt: exam.completed_at,
      },
      questions: questionRows.map(toFullQuestion),
      answers: answerRows.map((a: any) => ({
        questionId: a.question_id,
        selectedOption: a.selected_option,
        responseText: a.response_text,
        isCorrect: a.is_correct,
        aiVerdict: a.ai_verdict,
        aiFeedback: a.ai_feedback,
        flagged: a.flagged,
      })),
      summary: (attempt as any).stats ?? null,
      savedQuestionIds: [...new Set(saved.map((s: any) => s.question_id as string))],
    };
  });

export const gradeWrittenAnswer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ examId: z.string().uuid(), questionId: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ verdict: string; feedback: string; isCorrect: boolean | null }> => {
      const db = await adminDb();
      const student = studentId(context);
      await ownedExam(db, data.examId, student, "id");
      const attempt = await loadAttempt(db, data.examId, student);
      if (attempt.status !== "submitted")
        throw new Error("Grading is available after you submit the exam.");

      const { data: question } = await db
        .from("exam_questions")
        .select("type,question_text,model_answer,rubric")
        .eq("id", data.questionId)
        .eq("exam_id", data.examId)
        .maybeSingle();
      if (!question || question.type === "mcq")
        throw new Error("This question can’t be AI-graded.");
      if (!question.model_answer) throw new Error("No model answer is available for grading.");

      const { data: answer } = await db
        .from("exam_answers")
        .select("response_text")
        .eq("attempt_id", attempt.id)
        .eq("question_id", data.questionId)
        .maybeSingle();
      if (!answer?.response_text?.trim()) throw new Error("There’s no written answer to grade.");

      const { generateOpenAIJson } = await import("@/lib/openai.server");
      const { buildGradingPrompt, writtenGradeSchema, EXAM_SYSTEM_PROMPT } =
        await import("./prompts");
      const grade = await generateOpenAIJson({
        system: EXAM_SYSTEM_PROMPT,
        prompt: buildGradingPrompt({
          question: question.question_text,
          modelAnswer: question.model_answer,
          rubric: (question.rubric as { point: string; marks: number }[] | null) ?? null,
          studentAnswer: answer.response_text,
        }),
        schema: writtenGradeSchema,
        schemaName: "written_grade",
        role: "grading",
        maxTokens: 1000,
      });
      const isCorrect = verdictToCorrect(grade.verdict);
      await db
        .from("exam_answers")
        .update({ ai_verdict: grade.verdict, ai_feedback: grade.feedback, is_correct: isCorrect })
        .eq("attempt_id", attempt.id)
        .eq("question_id", data.questionId);
      return { verdict: grade.verdict, feedback: grade.feedback, isCorrect };
    },
  );

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
export interface ExamDeck {
  id: string;
  title: string;
  cardCount: number;
}

export const listExamDecks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ExamDeck[]> => {
    const db = await adminDb();
    const student = studentId(context);
    const decks = await selectAll(() =>
      db
        .from("flashcard_decks")
        .select("id,title")
        .eq("owner_student_id", student)
        .eq("is_official", false)
        .order("created_at", { ascending: false }),
    );
    if (decks.length === 0) return [];
    const cards = await selectAll(() =>
      db
        .from("flashcards")
        .select("deck_id")
        .in(
          "deck_id",
          decks.map((d: any) => d.id),
        ),
    );
    const counts: Record<string, number> = {};
    for (const c of cards) counts[c.deck_id] = (counts[c.deck_id] ?? 0) + 1;
    return decks.map((d: any) => ({ id: d.id, title: d.title, cardCount: counts[d.id] ?? 0 }));
  });

export const addExamQuestionToDeck = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        questionId: z.string().uuid(),
        deckId: z.string().uuid().optional(),
        newDeckName: z.string().trim().min(2).max(80).optional(),
      })
      .refine((v) => Boolean(v.deckId) !== Boolean(v.newDeckName), {
        message: "Choose an existing deck or name a new one.",
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      deckId: string;
      deckTitle: string;
      alreadySaved: boolean;
      flashcardId: string | null;
    }> => {
      const db = await adminDb();
      const student = studentId(context);
      await ownedExam(db, data.examId, student, "id");

      const { data: question } = await db
        .from("exam_questions")
        .select(
          "id,type,question_text,options,correct_option,model_answer,explanation,rubric,topic",
        )
        .eq("id", data.questionId)
        .eq("exam_id", data.examId)
        .maybeSingle();
      if (!question) throw new Error("Question not found.");

      // Resolve (or create) a student-owned deck.
      let deckId: string;
      let deckTitle: string;
      if (data.deckId) {
        const { data: deck } = await db
          .from("flashcard_decks")
          .select("id,title,owner_student_id,is_official")
          .eq("id", data.deckId)
          .maybeSingle();
        if (!deck || deck.is_official || deck.owner_student_id !== student) {
          throw new Error("You can only add cards to your own decks.");
        }
        deckId = deck.id;
        deckTitle = deck.title;
      } else {
        const { data: deck, error } = await db
          .from("flashcard_decks")
          .insert({
            title: data.newDeckName,
            description: "Saved from an exam in the Exam Generator.",
            subject: question.topic || "Exam",
            owner_student_id: student,
            is_official: false,
            tags: ["exam"],
          })
          .select("id,title")
          .single();
        if (error || !deck) throw new Error(error?.message ?? "The deck could not be created.");
        deckId = deck.id;
        deckTitle = deck.title;
      }

      // Already linked? Report it so the UI shows the saved state.
      const { data: existingLink } = await db
        .from("exam_flashcards")
        .select("flashcard_id")
        .eq("student_id", student)
        .eq("question_id", data.questionId)
        .eq("deck_id", deckId)
        .maybeSingle();
      if (existingLink) {
        return { deckId, deckTitle, alreadySaved: true, flashcardId: existingLink.flashcard_id };
      }

      const { front, back } = toFlashcard({
        type: question.type,
        questionText: question.question_text,
        options: (question.options as ExamOption[] | null) ?? null,
        correctOption: question.correct_option,
        modelAnswer: question.model_answer,
        explanation: question.explanation ?? "",
        rubric: (question.rubric as { point: string; marks: number }[] | null) ?? null,
      });

      // Reuse an identical card in the deck rather than duplicating it.
      const { data: duplicate } = await db
        .from("flashcards")
        .select("id")
        .eq("deck_id", deckId)
        .eq("front", front)
        .maybeSingle();
      let flashcardId = duplicate?.id ?? null;
      if (!flashcardId) {
        const { count } = await db
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("deck_id", deckId);
        const { data: card, error } = await db
          .from("flashcards")
          .insert({ deck_id: deckId, type: "basic", front, back, position: (count ?? 0) + 1 })
          .select("id")
          .single();
        if (error || !card) throw new Error(error?.message ?? "The flashcard could not be saved.");
        flashcardId = card.id;
      }

      const { error: linkError } = await db.from("exam_flashcards").insert({
        student_id: student,
        question_id: data.questionId,
        deck_id: deckId,
        flashcard_id: flashcardId,
      });
      if (linkError && !linkError.message.includes("duplicate")) throw new Error(linkError.message);

      return { deckId, deckTitle, alreadySaved: false, flashcardId };
    },
  );

import * as assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  accountCoverage,
  buildCoverageSummary,
  buildObjectiveRecords,
  chunkUnitsByChars,
  computeResultsSummary,
  dedupHash,
  dedupeQuestions,
  estimateProgressPercent,
  finalizeStatuses,
  gradeMcq,
  isNearDuplicate,
  mergeCoverageMaps,
  normalizeGeneratedQuestion,
  planGenerationBatches,
  selectRelevantUnits,
  toFlashcard,
  verdictToCorrect,
  type ObjectiveRecord,
  type QuestionRecord,
} from "../src/features/exam-generator/pipeline.js";
import {
  detectKind,
  extractPptx,
  finalizeExtraction,
  looksEmpty,
  slideTextFromXml,
  ExtractionError,
  type ExtractedUnit,
} from "../src/features/exam-generator/extract-text.js";
import {
  coverageMapSchema,
  questionBatchSchema,
  writtenGradeSchema,
  buildGradingPrompt,
  buildQuestionBatchPrompt,
} from "../src/features/exam-generator/prompts.js";
import type { GeneratedQuestion } from "../src/features/exam-generator/prompts.js";

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

const objective = (over: Partial<ObjectiveRecord> = {}): ObjectiveRecord => ({
  topic: "Heart failure",
  subtopic: null,
  objective: "Define heart failure",
  bloom: null,
  targetQuestions: 1,
  sourceRef: null,
  position: 0,
  ...over,
});

const mcqGen = (over: Partial<GeneratedQuestion> = {}): GeneratedQuestion => ({
  objective_index: 0,
  type: "mcq",
  question_text: "Which finding suggests acute pulmonary oedema?",
  options: [
    { id: "A", text: "Pink frothy sputum" },
    { id: "B", text: "Dry mucous membranes" },
  ],
  correct_option: "A",
  option_explanations: [
    { id: "A", explanation: "Classic sign." },
    { id: "B", explanation: "Suggests dehydration." },
  ],
  model_answer: null,
  explanation: "Pink frothy sputum is characteristic.",
  rubric: null,
  difficulty: 3,
  bloom: "application",
  ...over,
});

// --- Document detection + extraction ---------------------------------------
test("detectKind recognises pdf, pptx, and rejects unsupported", () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.equal(detectKind("notes.pdf", pdfBytes), "pdf");
  assert.equal(detectKind("deck.pptx", zipBytes), "pptx");
  assert.equal(detectKind("image.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
});

test("slideTextFromXml pulls runs and splits paragraphs, decoding entities", () => {
  const xml =
    "<a:p><a:r><a:t>Heart failure &amp; oedema</a:t></a:r></a:p><a:p><a:r><a:t>Reduced EF</a:t></a:r></a:p>";
  assert.equal(slideTextFromXml(xml), "Heart failure & oedema\nReduced EF");
});

test("extractPptx reads slides in order from a real zip", () => {
  const slide = (t: string) => strToU8(`<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`);
  const zip = zipSync({
    "ppt/slides/slide1.xml": slide("Cardiac anatomy"),
    "ppt/slides/slide2.xml": slide("Valvular disease"),
    "ppt/presentation.xml": strToU8("<x/>"),
  });
  const units = extractPptx("deck.pptx", zip);
  assert.equal(units.length, 2);
  assert.equal(units[0]!.unit, 1);
  assert.equal(units[0]!.text, "Cardiac anatomy");
  assert.equal(units[1]!.text, "Valvular disease");
});

test("extractPptx throws for a zip with no slides", () => {
  const zip = zipSync({ "docProps/core.xml": strToU8("<x/>") });
  assert.throws(() => extractPptx("deck.pptx", zip), ExtractionError);
});

test("finalizeExtraction flags scanned/empty and records skipped-unit warnings", () => {
  const empty: ExtractedUnit[] = [{ document: "d", unitKind: "page", unit: 1, text: "" }];
  assert.ok(looksEmpty(empty));
  assert.throws(() => finalizeExtraction("d.pdf", "pdf", empty), ExtractionError);

  const partial: ExtractedUnit[] = [
    {
      document: "d",
      unitKind: "page",
      unit: 1,
      text: "A long readable paragraph about physiology.",
    },
    { document: "d", unitKind: "page", unit: 2, text: "" },
  ];
  const out = finalizeExtraction("d.pdf", "pdf", partial);
  assert.equal(out.units.length, 1);
  assert.match(out.warning ?? "", /couldn’t be read/);
});

// --- Coverage map ----------------------------------------------------------
test("mergeCoverageMaps dedupes objectives within a topic", () => {
  const merged = mergeCoverageMaps([
    {
      topics: [
        {
          topic: "Heart failure",
          objectives: [
            {
              subtopic: null,
              objective: "Define HF",
              bloom: null,
              target_questions: 2,
              source_ref: null,
            },
          ],
        },
      ],
    },
    {
      topics: [
        {
          topic: "Heart Failure",
          objectives: [
            {
              subtopic: null,
              objective: "define hf",
              bloom: null,
              target_questions: 1,
              source_ref: null,
            },
            {
              subtopic: null,
              objective: "Classify HF",
              bloom: null,
              target_questions: 1,
              source_ref: null,
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(merged.topics.length, 1);
  assert.equal(merged.topics[0]!.objectives.length, 2);
});

test("buildObjectiveRecords clamps targets and keeps every objective (no cap)", () => {
  const topics = Array.from({ length: 40 }, (_, t) => ({
    topic: `Topic ${t}`,
    objectives: Array.from({ length: 4 }, (_, o) => ({
      subtopic: null,
      objective: `Objective ${t}-${o}`,
      bloom: null,
      target_questions: 99, // should clamp to 6
      source_ref: null,
    })),
  }));
  const records = buildObjectiveRecords({ topics });
  assert.equal(records.length, 160);
  assert.ok(records.every((r) => r.targetQuestions === 6));
  assert.equal(records[0]!.position, 0);
  assert.equal(records[159]!.position, 159);
});

// --- Batch planning (comprehensiveness / no cap) ---------------------------
test("planGenerationBatches partitions ALL objectives with nothing dropped", () => {
  const objectives = Array.from({ length: 150 }, (_, i) =>
    objective({ position: i, targetQuestions: 3 }),
  );
  const batches = planGenerationBatches(objectives);
  const covered = batches.flat().sort((a, b) => a - b);
  assert.equal(covered.length, 150);
  assert.deepEqual(
    covered,
    Array.from({ length: 150 }, (_, i) => i),
  );
  assert.ok(batches.every((b) => b.length <= 6));
});

test("a 400-objective coverage map yields 400 objectives across batches (pagination-free)", () => {
  const topics = [
    {
      topic: "Big",
      objectives: Array.from({ length: 400 }, (_, i) => ({
        subtopic: null,
        objective: `Obj ${i}`,
        bloom: null,
        target_questions: 1,
        source_ref: null,
      })),
    },
  ];
  const records = buildObjectiveRecords({ topics });
  assert.equal(records.length, 400);
  assert.equal(planGenerationBatches(records).flat().length, 400);
});

// --- Question normalisation (all three types) ------------------------------
test("normalizeGeneratedQuestion accepts a valid MCQ and maps option explanations", () => {
  const rec = normalizeGeneratedQuestion(mcqGen(), objective());
  assert.ok(rec);
  assert.equal(rec!.type, "mcq");
  assert.equal(rec!.correctOption, "A");
  assert.equal(rec!.optionExplanations?.["A"], "Classic sign.");
  assert.equal(rec!.topic, "Heart failure");
});

test("normalizeGeneratedQuestion rejects an MCQ whose correct option is absent", () => {
  assert.equal(normalizeGeneratedQuestion(mcqGen({ correct_option: "Z" }), objective()), null);
});

test("normalizeGeneratedQuestion accepts short and long answers, requires a model answer", () => {
  const short = normalizeGeneratedQuestion(
    {
      objective_index: 0,
      type: "short",
      question_text: "Define preload.",
      options: null,
      correct_option: null,
      option_explanations: null,
      model_answer: "End-diastolic stretch.",
      explanation: "",
      rubric: null,
      difficulty: 1,
      bloom: null,
    },
    objective(),
  );
  assert.ok(short && short.type === "short" && short.modelAnswer);
  const long = normalizeGeneratedQuestion(
    {
      objective_index: 0,
      type: "long",
      question_text: "Describe HF management.",
      options: null,
      correct_option: null,
      option_explanations: null,
      model_answer: "Diuretics, ACE-i...",
      explanation: "",
      rubric: [{ point: "Diuretics", marks: 2 }],
      difficulty: 4,
      bloom: null,
    },
    objective(),
  );
  assert.ok(long && long.type === "long" && long.rubric?.length === 1);
  const bad = normalizeGeneratedQuestion(
    {
      objective_index: 0,
      type: "short",
      question_text: "Q",
      options: null,
      correct_option: null,
      option_explanations: null,
      model_answer: "",
      explanation: "",
      rubric: null,
      difficulty: 1,
      bloom: null,
    },
    objective(),
  );
  assert.equal(bad, null);
});

// --- Duplicate detection ---------------------------------------------------
test("dedupeQuestions removes exact and near-duplicates across batches", () => {
  const q = (text: string): QuestionRecord => ({
    objectiveIndex: 0,
    type: "short",
    questionText: text,
    options: null,
    correctOption: null,
    optionExplanations: null,
    modelAnswer: "x",
    explanation: "",
    rubric: null,
    topic: "t",
    subtopic: null,
    difficulty: 1,
    bloom: null,
    sourceDocument: null,
    sourceRef: null,
    dedupHash: dedupHash(text),
  });
  const seenHashes = new Set<string>();
  const seenStems: string[] = [];
  const batch1 = dedupeQuestions([q("Define cardiac output clearly")], seenHashes, seenStems);
  assert.equal(batch1.kept.length, 1);
  const batch2 = dedupeQuestions(
    [
      q("Define cardiac output clearly"),
      q("Clearly define cardiac output"),
      q("What are the causes of hepatic failure"),
    ],
    seenHashes,
    seenStems,
  );
  assert.equal(batch2.duplicates, 2); // exact hash + reordered near-dup
  assert.equal(batch2.kept.length, 1);
  assert.ok(isNearDuplicate("Define cardiac output clearly", "Clearly define cardiac output"));
});

// --- Coverage audit + gap-fill + partial recovery --------------------------
test("accountCoverage finds gaps; finalizeStatuses marks 0-count objectives unassessable", () => {
  const objs = [
    objective({ position: 0, targetQuestions: 2 }),
    objective({ position: 1, objective: "Classify HF" }),
    objective({ position: 2, objective: "List causes" }),
  ];
  const indexes = [0, 1]; // obj0 has 1/2, obj1 has 1/1, obj2 has 0
  const acc = accountCoverage(objs, indexes);
  assert.deepEqual(acc.counts, [1, 1, 0]);
  assert.deepEqual(acc.uncovered, [2]);
  assert.deepEqual(acc.statuses, ["partial", "covered", "pending"]);
  const final = finalizeStatuses(objs, indexes);
  assert.deepEqual(final, ["partial", "covered", "unassessable"]);
});

// --- MCQ + written grading -------------------------------------------------
test("gradeMcq is case-insensitive and safe on nulls; verdictToCorrect maps verdicts", () => {
  assert.equal(gradeMcq("A", "a"), true);
  assert.equal(gradeMcq("A", "B"), false);
  assert.equal(gradeMcq("A", null), false);
  assert.equal(gradeMcq(null, "A"), false);
  assert.equal(verdictToCorrect("correct"), true);
  assert.equal(verdictToCorrect("incorrect"), false);
  assert.equal(verdictToCorrect("partially_correct"), null);
});

test("written grading schema + prompt are well-formed", () => {
  assert.ok(
    writtenGradeSchema.safeParse({ verdict: "partially_correct", feedback: "Mention preload." })
      .success,
  );
  assert.equal(writtenGradeSchema.safeParse({ verdict: "maybe", feedback: "x" }).success, false);
  const prompt = buildGradingPrompt({
    question: "Define preload.",
    modelAnswer: "EDV stretch.",
    rubric: [{ point: "Stretch", marks: 1 }],
    studentAnswer: "the stretch",
  });
  assert.match(prompt, /MODEL ANSWER/);
  assert.match(prompt, /MARKING RUBRIC/);
  assert.match(prompt, /the stretch/);
});

// --- Flashcard adaptation --------------------------------------------------
test("toFlashcard builds answerable cards and condenses long answers within limits", () => {
  const mcqCard = toFlashcard({
    type: "mcq",
    questionText: "Which sign?",
    options: [
      { id: "A", text: "Pink sputum" },
      { id: "B", text: "Dry mouth" },
    ],
    correctOption: "A",
    modelAnswer: null,
    explanation: "Classic.",
    rubric: null,
  });
  assert.match(mcqCard.front, /A\. Pink sputum/);
  assert.match(mcqCard.back, /Answer: A\. Pink sputum/);

  const longAnswer = "x".repeat(5000);
  const longCard = toFlashcard({
    type: "long",
    questionText: "Describe management.",
    options: null,
    correctOption: null,
    modelAnswer: longAnswer,
    explanation: "note",
    rubric: [{ point: "Diuretics", marks: 2 }],
  });
  assert.ok(longCard.front.length <= 600);
  assert.ok(longCard.back.length <= 1200);
  assert.match(longCard.back, /…$/); // truncated
});

// --- Deterministic results summary (no AI) ---------------------------------
test("computeResultsSummary aggregates deterministically and ranks weak topics first", () => {
  const questions = [
    { id: "1", type: "mcq" as const, topic: "HF" },
    { id: "2", type: "mcq" as const, topic: "HF" },
    { id: "3", type: "mcq" as const, topic: "Arrhythmia" },
    { id: "4", type: "short" as const, topic: "Arrhythmia" },
  ];
  const answers = [
    { questionId: "1", selectedOption: "A", responseText: null, isCorrect: true },
    { questionId: "2", selectedOption: "A", responseText: null, isCorrect: true },
    { questionId: "3", selectedOption: "B", responseText: null, isCorrect: false },
    { questionId: "4", selectedOption: null, responseText: "my answer", isCorrect: null },
  ];
  const s = computeResultsSummary(questions, answers, 2);
  assert.equal(s.total, 4);
  assert.equal(s.answered, 4);
  assert.equal(s.correct, 2);
  assert.equal(s.incorrect, 1);
  assert.equal(s.written, 1);
  assert.equal(s.score, 67); // 2 of 3 graded correct
  assert.equal(s.savedFlashcards, 2);
  assert.equal(s.topicPerformance[0]!.topic, "Arrhythmia"); // 0% — weakest first
});

test("computeResultsSummary handles a fully unanswered exam without dividing by zero", () => {
  const s = computeResultsSummary([{ id: "1", type: "mcq", topic: "T" }], [], 0);
  assert.equal(s.score, 0);
  assert.equal(s.unanswered, 1);
});

// --- Coverage summary + grounding + progress -------------------------------
test("buildCoverageSummary reports type distribution, per-topic percent and warnings", () => {
  const cov = buildCoverageSummary(
    [
      { topic: "HF", status: "covered" },
      { topic: "HF", status: "partial" },
      { topic: "Arr", status: "unassessable" },
    ],
    [{ type: "mcq" }, { type: "mcq" }, { type: "short" }, { type: "long" }],
    ["1 slide skipped"],
  );
  assert.deepEqual(cov.typeDistribution, { mcq: 2, short: 1, long: 1 });
  assert.equal(cov.objectives.total, 3);
  assert.equal(cov.objectives.unassessable, 1);
  const hf = cov.topics.find((t) => t.topic === "HF")!;
  assert.equal(hf.percent, 75); // (1 + 0.5)/2
  assert.deepEqual(cov.warnings, ["1 slide skipped"]);
});

test("selectRelevantUnits prefers matching units and respects a budget", () => {
  const units = [
    {
      document: "d",
      unitKind: "slide" as const,
      unit: 1,
      text: "heart failure pathophysiology and ejection fraction",
    },
    {
      document: "d",
      unitKind: "slide" as const,
      unit: 2,
      text: "unrelated microbiology content about bacteria",
    },
  ];
  const chosen = selectRelevantUnits(
    [
      {
        objective: "ejection fraction in heart failure",
        topic: "HF",
        subtopic: null,
        sourceRef: null,
      },
    ],
    units,
    10000,
  );
  assert.equal(chosen[0]!.unit, 1);
  assert.ok(chunkUnitsByChars(units, 20).length >= 1);
});

test("estimateProgressPercent increases across stages", () => {
  const data = { objectivesTotal: 10, objectivesCovered: 5, questionsGenerated: 20 };
  assert.ok(estimateProgressPercent("extracting", data) < estimateProgressPercent("mapping", data));
  assert.ok(estimateProgressPercent("mapping", data) < estimateProgressPercent("generating", data));
  assert.ok(
    estimateProgressPercent("generating", data) < estimateProgressPercent("auditing", data),
  );
  assert.equal(estimateProgressPercent("done", data), 100);
});

// --- Structured-output schemas round-trip ----------------------------------
test("coverageMapSchema and questionBatchSchema parse valid model output", () => {
  assert.ok(
    coverageMapSchema.safeParse({
      topics: [
        {
          topic: "HF",
          objectives: [
            {
              subtopic: null,
              objective: "Define HF",
              bloom: null,
              target_questions: 2,
              source_ref: "deck · slide 1",
            },
          ],
        },
      ],
    }).success,
  );
  assert.ok(questionBatchSchema.safeParse({ questions: [mcqGen()] }).success);
  const prompt = buildQuestionBatchPrompt({
    objectives: [
      { index: 0, topic: "HF", subtopic: null, objective: "Define HF", bloom: null, target: 2 },
    ],
    sourceExcerpt: "Heart failure is...",
  });
  assert.match(prompt, /OBJECTIVES/);
  assert.match(prompt, /SOURCE EXCERPT/);
});

let failed = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log(`✓ ${entry.name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${entry.name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
else console.log(`\n${tests.length} Exam Generator tests passed.`);

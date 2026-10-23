import * as assert from "node:assert/strict";
import {
  assistantReducer,
  initialAssistantView,
} from "../src/features/study-with-annie/assistant-state.js";
import {
  sentenceCandidates,
  validateQuizCandidates,
} from "../src/features/study-with-annie/candidate-validation.js";
import {
  chunkPageText,
  contextAroundSelection,
  findNormalizedTextMatch,
  normalizePdfText,
} from "../src/features/study-with-annie/text-mapping.js";

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

test("normalizes PDF whitespace and case for reliable text-layer matching", () => {
  assert.equal(normalizePdfText("  Cardiac\n output   IS five  "), "cardiac output is five");
  assert.deepEqual(findNormalizedTextMatch("Cardiac\noutput is five.", "cardiac output"), {
    start: 0,
    end: 14,
  });
});

test("returns no match rather than an approximate masking rectangle", () => {
  assert.equal(
    findNormalizedTextMatch("The sinoatrial node fires.", "atrioventricular node"),
    null,
  );
});

test("derives bounded selection context from stored page text", () => {
  const source = `${"Before ".repeat(250)}Microscopic anatomy requires magnification.${" After".repeat(250)}`;
  const context = contextAroundSelection(source, "Microscopic anatomy requires magnification", 80);
  assert.ok(context);
  assert.ok(context.includes("Microscopic anatomy requires magnification"));
  assert.ok(context.length < source.length);
});

test("refuses selection context that is not grounded in the page", () => {
  assert.equal(contextAroundSelection("Known page text", "Invented selection"), null);
});

test("chunks unusually long pages without losing content order", () => {
  const source = Array.from({ length: 1000 }, (_, index) => `Sentence ${index}.`).join(" ");
  const chunks = chunkPageText(source, 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1002));
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), source.replace(/\s+/g, " "));
});

test("assistant state replaces overview with recall and allows one challenge", () => {
  const overview = assistantReducer(initialAssistantView, {
    type: "show",
    message: {
      kind: "overview",
      overview: {
        page: 1,
        summary: "Summary",
        learningObjectives: ["Learn"],
        keyConcepts: ["Remember"],
      },
    },
  });
  const recall = assistantReducer(overview, {
    type: "start_recall",
    challenge: { id: "one", page: 1, prompt: "Explain this", targetText: "Target" },
  });
  assert.equal(recall.message?.kind, "recall");
  assert.equal(recall.challenge?.id, "one");
  assert.equal(recall.status, "awaiting_answer");
});

test("dismiss clears temporary recall state and masks", () => {
  const recall = assistantReducer(initialAssistantView, {
    type: "start_recall",
    challenge: { id: "one", page: 1, prompt: "Explain this", targetText: "Target" },
  });
  assert.deepEqual(assistantReducer(recall, { type: "dismiss" }), initialAssistantView);
});

test("discards recall targets that are not exact page substrings", () => {
  const pages = new Map([[1, "The sinoatrial node initiates the normal cardiac impulse."]]);
  const valid = validateQuizCandidates(pages, [
    { page: 1, text: "sinoatrial node", question_prompt: "Which node?", difficulty: 1 },
    { page: 1, text: "atrioventricular node", question_prompt: "Which node?", difficulty: 1 },
  ]);
  assert.equal(valid.length, 1);
});

test("retains the grounded fallback candidate pipeline", () => {
  const pageText =
    "Cardiac output is the product of heart rate and stroke volume. It is measured in litres per minute.";
  const generated = sentenceCandidates(1, pageText);
  const stored = validateQuizCandidates(new Map([[1, pageText]]), generated);
  assert.ok(stored.length > 0);
  assert.ok(stored.every((candidate) => pageText.includes(candidate.text)));
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
else console.log(`\n${tests.length} Annie tests passed.`);

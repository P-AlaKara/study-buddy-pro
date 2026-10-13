import * as assert from "node:assert/strict";
import {
  BehaviorScheduler,
  type SchedulerConfig,
  type SchedulerSnapshot,
} from "../src/features/study-with-annie/behavior-scheduler.js";
import {
  sentenceCandidates,
  validateQuizCandidates,
} from "../src/features/study-with-annie/candidate-validation.js";

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

const config: SchedulerConfig = {
  cooldownMs: { quiet: 80, normal: 40, chatty: 20 },
  jitterRatio: 0,
  activeScrollWindowMs: 5,
  meaningfulPageTimeMs: 10,
  ignoredBeforeSlowdown: 3,
  adaptiveCooldownMultiplier: 2,
};

const snapshot = (overrides: Partial<SchedulerSnapshot> = {}): SchedulerSnapshot => ({
  currentPage: 2,
  pageEnteredAt: 0,
  lastScrollAt: -100,
  typingNote: false,
  interactionOpen: false,
  silencedUntil: null,
  chattiness: "normal",
  quizzesEnabled: true,
  commentaryEnabled: true,
  availableQuizPages: [1, 2],
  availableCommentaryPages: [1, 2],
  ...overrides,
});

test("respects the configured cooldown", () => {
  const scheduler = new BehaviorScheduler(0, config, () => 0);
  assert.equal(scheduler.next(snapshot(), 0), null);
  assert.equal(scheduler.next(snapshot(), 39), null);
  assert.equal(scheduler.next(snapshot(), 40), "quiz");
});

test("never interrupts while scrolling, typing, or another interaction is open", () => {
  const cases: Array<{ value: SchedulerSnapshot; now: number }> = [
    { value: snapshot({ lastScrollAt: 39 }), now: 40 },
    { value: snapshot({ typingNote: true }), now: 100 },
    { value: snapshot({ interactionOpen: true }), now: 100 },
  ];
  for (const item of cases) {
    const scheduler = new BehaviorScheduler(0, config, () => 0);
    scheduler.next(item.value, 0);
    assert.equal(scheduler.next(item.value, item.now), null);
  }
});

test("respects temporary and session silence", () => {
  for (const silencedUntil of [200, "session", "forever"] as const) {
    const scheduler = new BehaviorScheduler(0, config, () => 0);
    scheduler.next(snapshot({ silencedUntil }), 0);
    assert.equal(scheduler.next(snapshot({ silencedUntil }), 100), null);
  }
});

test("does not repeat one behavior more than twice", () => {
  const scheduler = new BehaviorScheduler(0, config, () => 0);
  scheduler.next(snapshot({ chattiness: "chatty" }), 0);
  assert.equal(scheduler.next(snapshot({ chattiness: "chatty" }), 20), "quiz");
  assert.equal(scheduler.next(snapshot({ chattiness: "chatty" }), 40), "quiz");
  assert.equal(scheduler.next(snapshot({ chattiness: "chatty" }), 60), "commentary");
});

test("slows down after three ignored interruptions and recovers after engagement", () => {
  const scheduler = new BehaviorScheduler(0, config, () => 0);
  scheduler.next(snapshot(), 0);
  scheduler.recordOutcome("ignored");
  scheduler.recordOutcome("dismissed");
  scheduler.recordOutcome("ignored");
  assert.equal(scheduler.next(snapshot(), 40), "quiz");
  assert.equal(scheduler.next(snapshot(), 100), null);
  assert.equal(scheduler.next(snapshot(), 120), "quiz");
  scheduler.recordOutcome("engaged");
  assert.equal(scheduler.next(snapshot(), 159), null);
  assert.equal(scheduler.next(snapshot(), 160), "commentary");
});

test("never selects candidates from an unreached page", () => {
  const scheduler = new BehaviorScheduler(0, config, () => 0);
  const futureOnly = snapshot({
    currentPage: 2,
    availableQuizPages: [3],
    availableCommentaryPages: [4],
  });
  scheduler.next(futureOnly, 0);
  assert.equal(scheduler.next(futureOnly, 100), null);
});

test("discards generated blot-outs that are not exact page substrings", () => {
  const pages = new Map([[1, "The sinoatrial node initiates the normal cardiac impulse."]]);
  const valid = validateQuizCandidates(pages, [
    { page: 1, text: "sinoatrial node", question_prompt: "Which node?", difficulty: 1 },
    { page: 1, text: "atrioventricular node", question_prompt: "Which node?", difficulty: 1 },
    { page: 2, text: "future page", question_prompt: "What?", difficulty: 1 },
  ]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.text, "sinoatrial node");
});

test("runs the fallback upload-processing-ready candidate flow", () => {
  const pageText =
    "Cardiac output is the product of heart rate and stroke volume. It is measured in litres per minute.";
  const extracted = new Map([[1, pageText]]);
  const generated = sentenceCandidates(1, pageText);
  const stored = validateQuizCandidates(extracted, generated);
  const status = stored.length > 0 ? "ready" : "failed";
  assert.equal(status, "ready");
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

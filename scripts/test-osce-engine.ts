import * as assert from "node:assert/strict";
import { createOsceDebrief } from "../src/features/osce/debrief.js";
import {
  advanceIdleTime,
  advanceReadingCountdown,
  answerExaminerQuestion,
  calculateOsceResult,
  createInitialOsceState,
  endConsultation,
  enterRoom,
  formatOsceClock,
  getAvailableCards,
  getRapportBand,
  markStudentActive,
  requestNudge,
  selectOsceCard,
  skipReading,
  type OsceState,
} from "../src/features/osce/engine.js";
import { resolveExaminerReaction } from "../src/features/osce/reaction-config.js";
import {
  loadOsceProgress,
  OSCE_PROGRESS_STORAGE_KEY,
  recommendedOsceMode,
  saveOsceResult,
} from "../src/features/osce/progress.js";
import { CHEST_TIGHTNESS_STATION as station } from "../src/features/osce/stations/chest-tightness-on-the-stairs.js";
import type { OsceMode } from "../src/features/osce/schema.js";

type Test = { name: string; run: () => void };
const tests: Test[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function room(mode: OsceMode = "practice", seed = 1234): OsceState {
  return enterRoom(createInitialOsceState(station, mode, seed), station);
}

function available(state: OsceState, cardId: string): boolean {
  return getAvailableCards(state, station).some((card) => card.id === cardId);
}

function answerAllCorrect(state: OsceState): OsceState {
  let next = state;
  for (const question of station.examinerQuestions) {
    next = answerExaminerQuestion(
      next,
      station,
      question.id,
      question.options.filter((option) => option.correct).map((option) => option.id),
    );
  }
  return next;
}

function runEfficientSession(): OsceState {
  let state = room("exam", 90210);
  for (const step of station.modelRun) {
    if (state.curveball.status === "pending" && step.cardId !== "curve_honest_empathic") {
      state = selectOsceCard(state, station, "curve_honest_empathic");
    }
    if (state.completedActions.some((action) => action.cardId === step.cardId)) continue;
    assert.equal(available(state, step.cardId), true, `${step.cardId} should be available`);
    state = selectOsceCard(state, station, step.cardId);
  }
  if (state.curveball.status === "pending") {
    state = selectOsceCard(state, station, "curve_honest_empathic");
  }
  state = endConsultation(state, station);
  return answerAllCorrect(state);
}

test("initialises a deterministic door state with mode-specific card order", () => {
  const learn = createInitialOsceState(station, "learn", 7);
  const practiceA = createInitialOsceState(station, "practice", 7);
  const practiceB = createInitialOsceState(station, "practice", 7);
  assert.equal(learn.phase, "door");
  assert.equal(learn.readingSecondsRemaining, 60);
  assert.equal(learn.remainingSeconds, 480);
  assert.equal(learn.rapport, 50);
  assert.deepEqual(learn.examinerReactions, []);
  assert.deepEqual(practiceA.cardOrder, practiceB.cardOrder);
  assert.deepEqual(
    learn.cardOrder.opening,
    station.cards.filter((card) => card.category === "opening").map((card) => card.id),
  );
  assert.throws(() => createInitialOsceState(station, "exam", 1.5), /whole-number session seed/);
});

test("runs the reading countdown, supports skipping, and starts the room on the bell", () => {
  const initial = createInitialOsceState(station, "practice", 1);
  const counted = advanceReadingCountdown(initial, station, 12);
  assert.equal(initial.readingSecondsRemaining, 60, "engine transitions must not mutate input");
  assert.equal(counted.readingSecondsRemaining, 48);
  const skipped = skipReading(counted, station);
  assert.equal(skipped.readingSecondsRemaining, 0);
  const entered = enterRoom(skipped, station);
  assert.equal(entered.phase, "room");
  assert.equal(entered.latestPatientLine, station.patient.openingLine);
});

test("locks follow-ups until prerequisites are completed and removes one-use cards", () => {
  let state = room();
  assert.equal(available(state, "symptom_open_detail"), false);
  assert.equal(available(state, "pc_open_story"), true);
  state = selectOsceCard(state, station, "pc_open_story");
  assert.equal(available(state, "symptom_open_detail"), true);
  assert.equal(available(state, "pc_open_story"), false);
  state = selectOsceCard(state, station, "pc_facilitate");
  assert.equal(
    available(state, "pc_facilitate"),
    true,
    "repeatable facilitation remains available",
  );
});

test("keeps a cue card available for three actions and logs a missed cue with rapport loss", () => {
  let state = selectOsceCard(room(), station, "pc_open_story");
  assert.equal(state.cueStates[0]?.status, "active");
  assert.equal(state.cueStates[0]?.actionsRemaining, 3);
  assert.equal(available(state, "cue_wife_pickup"), true);

  state = selectOsceCard(state, station, "opening_hand_hygiene");
  assert.equal(state.cueStates[0]?.actionsRemaining, 2);
  state = selectOsceCard(state, station, "opening_introduce");
  assert.equal(state.cueStates[0]?.actionsRemaining, 1);
  const beforeFinalMiss = state.rapport;
  state = selectOsceCard(state, station, "opening_confirm_identity");
  assert.equal(state.cueStates[0]?.status, "missed");
  assert.equal(available(state, "cue_wife_pickup"), false);
  assert.equal(state.rapport, beforeFinalMiss + 2 - 5);
  assert.ok(state.timeline.some((event) => event.type === "cue_missed"));
});

test("picking up a cue resolves its window, raises rapport, and ticks its checklist item", () => {
  let state = selectOsceCard(room(), station, "pc_open_story");
  const before = state.rapport;
  state = selectOsceCard(state, station, "cue_wife_pickup");
  assert.equal(state.cueStates[0]?.status, "picked");
  assert.equal(state.rapport, before + 7);
  assert.equal(state.checklistAchievements.comm_cue_wife?.cardId, "cue_wife_pickup");
  assert.ok(state.timeline.some((event) => event.type === "cue_picked"));
});

test("requires authored cue prerequisites and minimum rapport", () => {
  let state = room();
  state.rapport = 70;
  state = selectOsceCard(state, station, "social_family_history");
  assert.equal(
    state.cueStates.some((cue) => cue.cueId === "cue_father_age"),
    false,
    "father cue needs the pain-description prerequisite",
  );

  let prepared = selectOsceCard(room(), station, "pc_open_story");
  prepared = selectOsceCard(prepared, station, "symptom_open_detail");
  prepared = selectOsceCard(prepared, station, "social_family_history");
  assert.equal(prepared.cueStates.find((cue) => cue.cueId === "cue_father_age")?.status, "active");
});

test("uses exact low, mid, and high rapport boundaries and reply variants", () => {
  assert.equal(getRapportBand(34), "low");
  assert.equal(getRapportBand(35), "mid");
  assert.equal(getRapportBand(65), "mid");
  assert.equal(getRapportBand(66), "high");

  const replies = ([30, 50, 70] as const).map((rapport) => {
    const state = room();
    state.rapport = rapport;
    return selectOsceCard(state, station, "pc_site_closed").completedActions[0]?.reply;
  });
  assert.deepEqual(replies, [
    station.cards.find((card) => card.id === "pc_site_closed")?.replies.low,
    station.cards.find((card) => card.id === "pc_site_closed")?.replies.mid,
    station.cards.find((card) => card.id === "pc_site_closed")?.replies.high,
  ]);
});

test("penalises sensitive questions asked before rapport is established", () => {
  const early = selectOsceCard(room(), station, "social_family_history");
  assert.equal(early.rapport, 44, "50 + 1 authored gain - 7 early sensitivity penalty");

  const established = room();
  established.rapport = 60;
  const later = selectOsceCard(established, station, "social_family_history");
  assert.equal(later.rapport, 61);
});

test("protects the hidden agenda until an ICE card is used at mid rapport", () => {
  const guarded = room();
  guarded.rapport = 30;
  const withheld = selectOsceCard(guarded, station, "comm_concerns");
  assert.equal(withheld.revealedFactIds.includes("ice_concerns"), false);
  assert.equal(withheld.completedActions[0]?.replyBand, "low");

  const open = room();
  open.rapport = 50;
  const revealed = selectOsceCard(open, station, "comm_concerns");
  assert.equal(revealed.revealedFactIds.includes("ice_concerns"), true);
});

test("applies action time costs and emits both clock warnings", () => {
  let state = room();
  state.curveball.status = "responded";
  state.remainingSeconds = 125;
  state = selectOsceCard(state, station, "pc_site_closed");
  assert.equal(state.remainingSeconds, 113);
  assert.ok(state.warningsShown.includes("two_minutes"));
  state.remainingSeconds = 35;
  state = selectOsceCard(state, station, "pc_onset_closed");
  assert.equal(state.remainingSeconds, 23);
  assert.ok(state.warningsShown.includes("thirty_seconds"));
});

test("implements relaxed Learn idle, delayed Practice drift, and strict Exam idle", () => {
  const learn = advanceIdleTime(room("learn"), station, 60);
  assert.equal(learn.remainingSeconds, 480);

  let practice = advanceIdleTime(room("practice"), station, 20);
  assert.equal(practice.remainingSeconds, 480);
  practice = advanceIdleTime(practice, station, 2);
  assert.equal(practice.remainingSeconds, 479);
  assert.equal(markStudentActive(practice, station).idleRealSeconds, 0);

  const exam = advanceIdleTime(room("exam"), station, 5);
  assert.equal(exam.remainingSeconds, 475);

  let fractionalExam = advanceIdleTime(room("exam"), station, 0.5);
  assert.equal(fractionalExam.remainingSeconds, 480);
  fractionalExam = advanceIdleTime(fractionalExam, station, 0.5);
  assert.equal(
    fractionalExam.remainingSeconds,
    479,
    "fractional ticks accumulate deterministically",
  );
});

test("triggers the curveball from the clock and temporarily restricts the menu to four responses", () => {
  const state = room("exam");
  state.remainingSeconds = 193;
  const triggered = advanceIdleTime(state, station, 2);
  assert.equal(triggered.curveball.status, "pending");
  assert.equal(triggered.curveball.triggeredBy, "clock");
  assert.deepEqual(
    getAvailableCards(triggered, station).map((card) => card.id),
    station.curveball.responseCardIds,
  );
});

test("records false reassurance as an immediate critical fail", () => {
  let state = room("exam");
  state.remainingSeconds = 193;
  state = advanceIdleTime(state, station, 2);
  state = selectOsceCard(state, station, "curve_false_reassurance");
  assert.equal(state.curveball.status, "responded");
  assert.ok(state.criticalFailIds.includes("critical_false_reassurance"));
  assert.equal(state.patientExpression, "irritated");
  assert.equal(state.examinerReactions.at(-1)?.expression, "serious_pause");
  assert.equal(state.examinerReactions.at(-1)?.cause, "safety");
});

test("logs one deterministic, delayed examiner reaction for every action", () => {
  const first = selectOsceCard(room("practice", 7788), station, "opening_introduce");
  const replay = selectOsceCard(room("practice", 7788), station, "opening_introduce");
  const reaction = first.examinerReactions[0];
  assert.equal(first.examinerReactions.length, first.completedActions.length);
  assert.deepEqual(first.examinerReactions, replay.examinerReactions);
  assert.equal(reaction?.actionId, "opening_introduce:1");
  assert.equal(reaction?.cardId, "opening_introduce");
  assert.ok((reaction?.delayMs ?? 0) >= 500);
  assert.ok((reaction?.delayMs ?? 0) <= 1500);
});

test("makes Learn reactions clear and spoken while keeping them deterministic", () => {
  const state = selectOsceCard(room("learn", 42), station, "opening_introduce");
  const reaction = state.examinerReactions[0];
  assert.equal(reaction?.expression, "nod");
  assert.equal(reaction?.cause, "strong_technique");
  assert.equal(reaction?.isNoise, false);
  assert.match(reaction?.coachLine ?? "", /Good choice/);
  assert.match(reaction?.coachLine ?? "", /name and role/);
});

test("uses watch checks under time pressure and poor-technique signals for missed cues", () => {
  const watch = resolveExaminerReaction({
    sessionSeed: 9,
    actionNumber: 4,
    mode: "exam",
    cardStyle: "closed",
    authoredSignal: "none",
    satisfiedCount: 0,
    penalisedCount: 0,
    remainingPercent: 19,
    recentProgress: false,
    missedCue: false,
    triggeredCriticalFail: false,
    coachingLine: null,
  });
  assert.equal(watch.expression, "checks_watch");
  assert.equal(watch.cause, "time_pressure");

  const missedCueSignals = Array.from({ length: 200 }, (_, sessionSeed) =>
    resolveExaminerReaction({
      sessionSeed,
      actionNumber: 4,
      mode: "practice",
      cardStyle: "closed",
      authoredSignal: "none",
      satisfiedCount: 0,
      penalisedCount: 0,
      remainingPercent: 70,
      recentProgress: true,
      missedCue: true,
      triggeredCriticalFail: false,
      coachingLine: null,
    }),
  );
  assert.ok(missedCueSignals.some((reaction) => reaction.cause === "poor_technique"));
  assert.ok(missedCueSignals.every((reaction) => !reaction.isNoise));
});

test("keeps examiner true signals near 80% and neutral noise near 10%", () => {
  const sampleSize = 2_000;
  let trueSignals = 0;
  let neutralNoise = 0;
  for (let sessionSeed = 0; sessionSeed < sampleSize; sessionSeed += 1) {
    const genuine = resolveExaminerReaction({
      sessionSeed,
      actionNumber: 2,
      mode: "practice",
      cardStyle: "open",
      authoredSignal: "nod",
      satisfiedCount: 1,
      penalisedCount: 0,
      remainingPercent: 80,
      recentProgress: true,
      missedCue: false,
      triggeredCriticalFail: false,
      coachingLine: null,
    });
    if (genuine.cause === "strong_technique") trueSignals += 1;

    const neutral = resolveExaminerReaction({
      sessionSeed,
      actionNumber: 2,
      mode: "practice",
      cardStyle: "closed",
      authoredSignal: "none",
      satisfiedCount: 0,
      penalisedCount: 0,
      remainingPercent: 80,
      recentProgress: true,
      missedCue: false,
      triggeredCriticalFail: false,
      coachingLine: null,
    });
    if (neutral.cause === "noise") neutralNoise += 1;
  }
  assert.ok(trueSignals / sampleSize > 0.76 && trueSignals / sampleSize < 0.84);
  assert.ok(neutralNoise / sampleSize > 0.07 && neutralNoise / sampleSize < 0.13);
});

test("uses the tearful patient expression when an emotional family cue is picked up", () => {
  let state = selectOsceCard(room(), station, "pc_open_story");
  state = selectOsceCard(state, station, "symptom_open_detail");
  state = selectOsceCard(state, station, "social_family_history");
  assert.equal(available(state, "cue_father_pickup"), true);
  state = selectOsceCard(state, station, "cue_father_pickup");
  assert.equal(state.patientExpression, "tearful");
});

test("rings the final bell and moves automatically to examiner questions", () => {
  let state = room("exam");
  state.curveball.status = "responded";
  state.remainingSeconds = 5;
  state = selectOsceCard(state, station, "opening_hand_hygiene");
  assert.equal(state.remainingSeconds, 0);
  assert.equal(state.phase, "examiner_questions");
  assert.equal(state.endReason, "time");
  assert.ok(state.warningsShown.includes("final_bell"));
});

test("evaluates missing-action critical fails only when the consultation ends", () => {
  const ended = endConsultation(room(), station);
  assert.deepEqual(ended.criticalFailIds.sort(), [
    "critical_missed_rest_pain",
    "critical_opening_safety",
  ]);

  let safe = room();
  for (const cardId of [
    "opening_introduce",
    "opening_confirm_identity",
    "opening_purpose_consent",
    "pc_open_story",
    "symptom_pain_at_rest",
  ]) {
    safe = selectOsceCard(safe, station, cardId);
  }
  safe = endConsultation(safe, station);
  assert.deepEqual(safe.criticalFailIds, []);
});

test("makes Practice nudges progressively costly, Learn nudges free, and Exam nudges unavailable", () => {
  let practice = requestNudge(room("practice"), station);
  practice = requestNudge(practice, station);
  assert.deepEqual(
    practice.nudgesUsed.map((nudge) => nudge.pointCost),
    [2, 5],
  );
  assert.equal(requestNudge(room("learn"), station).nudgesUsed[0]?.pointCost, 0);
  assert.throws(() => requestNudge(room("exam"), station), /unavailable in Exam mode/);
});

test("scores examiner questions separately, including penalties for over-selection", () => {
  let state = endConsultation(room(), station);
  state = answerExaminerQuestion(state, station, "exam_differential", [
    "stable_angina",
    "unstable_angina",
    "gord",
  ]);
  assert.equal(state.examinerAnswers[0]?.scorePercent, 50);
  state = answerExaminerQuestion(state, station, "exam_investigations", [
    "ecg",
    "troponin",
    "observations",
  ]);
  state = answerExaminerQuestion(state, station, "exam_driving", ["stop_driving"]);
  assert.equal(state.phase, "debrief");
  assert.equal(state.status, "complete");
  assert.equal(state.finalResult?.score.examinerQuestions, 83);
});

test("removes penalised checklist weight and counts poor-technique time as wasted", () => {
  let clear = selectOsceCard(room(), station, "social_smoking_neutral");
  const before = calculateOsceResult(clear, station);
  clear = selectOsceCard(clear, station, "social_smoking_judgmental");
  const after = calculateOsceResult(clear, station);
  assert.ok(after.score.checklistEarnedWeight < before.score.checklistEarnedWeight);
  assert.equal(after.score.wastedSeconds, 18);
  assert.ok(after.score.timeManagement < before.score.timeManagement);
});

test("completes the authored efficient path within the clock with an Excellent result", () => {
  const state = runEfficientSession();
  assert.equal(state.status, "complete");
  assert.equal(state.remainingSeconds, 35);
  assert.deepEqual(state.criticalFailIds, []);
  assert.equal(state.finalResult?.score.examinerQuestions, 100);
  assert.equal(state.finalResult?.rating, "excellent");
  assert.ok((state.finalResult?.score.checklist ?? 0) >= 90);
});

test("builds a complete debrief with domain, cue, question, timeline and model-run reviews", () => {
  const state = runEfficientSession();
  const debrief = createOsceDebrief(state, station);
  assert.equal(debrief.checklistDomains.length, 6);
  assert.equal(
    debrief.checklistDomains.flatMap((domain) => domain.items).length,
    station.checklist.length,
  );
  assert.equal(debrief.cues.length, station.cues.length);
  assert.equal(debrief.examinerQuestions.length, station.examinerQuestions.length);
  assert.equal(debrief.modelRun.length, station.modelRun.length);
  assert.equal(debrief.coachingLines.length, 3);
  assert.ok(debrief.timeline.some((event) => event.type === "result"));
  assert.ok(debrief.rapportHistory.length > 1);

  let poor = selectOsceCard(room(), station, "social_smoking_judgmental");
  poor = answerAllCorrect(endConsultation(poor, station));
  const poorDebrief = createOsceDebrief(poor, station);
  assert.ok(poorDebrief.timeline.some((event) => event.wastedSeconds === 18));
  assert.equal(
    poorDebrief.checklistDomains
      .flatMap((domain) => domain.items)
      .find((entry) => entry.item.id === "comm_empathy")?.status,
    "penalised",
  );
});

test("persists the best OSCE rating per mode while counting every attempt", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const excellent = runEfficientSession().finalResult;
  assert.ok(excellent);
  let progress = saveOsceResult(station.id, "learn", excellent, storage, "2026-01-01T00:00:00Z");
  assert.equal(progress.stations[station.id]?.learn?.bestRating, "excellent");
  assert.equal(progress.stations[station.id]?.learn?.attempts, 1);

  const worse = structuredClone(excellent);
  worse.rating = "clear_fail";
  worse.score.composite = 100;
  progress = saveOsceResult(station.id, "learn", worse, storage, "2026-01-02T00:00:00Z");
  assert.equal(progress.stations[station.id]?.learn?.bestRating, "excellent");
  assert.equal(progress.stations[station.id]?.learn?.attempts, 2);
  assert.equal(progress.stations[station.id]?.learn?.completedAt, "2026-01-01T00:00:00Z");
  assert.deepEqual(loadOsceProgress(storage), progress);
  assert.equal(recommendedOsceMode(progress.stations[station.id]), "practice");

  storage.setItem(OSCE_PROGRESS_STORAGE_KEY, "not-json");
  assert.deepEqual(loadOsceProgress(storage), { version: 1, stations: {} });
});

test("caps strong checklist performance at Borderline when rapport is poor", () => {
  const strong = runEfficientSession();
  strong.rapport = 10;
  const result = calculateOsceResult(strong, station);
  assert.ok(["good", "excellent"].includes(result.uncappedRating));
  assert.equal(result.rating, "borderline");
  assert.match(result.ratingReason, /rapport or communication/);
});

test("caps any score at Clear Fail when a critical fail exists", () => {
  const strong = runEfficientSession();
  strong.criticalFailIds.push("critical_false_reassurance");
  const result = calculateOsceResult(strong, station);
  assert.equal(result.rating, "clear_fail");
  assert.match(result.ratingReason, /critical fail/i);
});

test("formats the station clock without negative time", () => {
  assert.equal(formatOsceClock(480), "8:00");
  assert.equal(formatOsceClock(29.2), "0:30");
  assert.equal(formatOsceClock(-4), "0:00");
});

let passed = 0;
for (const entry of tests) {
  try {
    entry.run();
    passed += 1;
    console.log(`✓ ${entry.name}`);
  } catch (error) {
    console.error(`✗ ${entry.name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} OSCE engine tests passed.`);

import * as assert from "node:assert/strict";
import {
  addToDifferential,
  applyAction,
  beginCase,
  cancelCommit,
  commitCase,
  createDebrief,
  createInitialState,
  elapseTime,
  formatBloodPressure,
  formatCaseClock,
  getCommitReadiness,
  openCommit,
  rankDifferential,
  removeFromDifferential,
  requestNextHint,
  setDifferentialConfidence,
  tagEvidence,
} from "../src/features/case-challenge/engine.js";
import { theLongFlight, theTearingPain } from "../src/features/case-challenge/cases/index.js";
import type { MedicalCase } from "../src/features/case-challenge/schema.js";
import { validateCase } from "../src/features/case-challenge/validator.js";

type Test = { name: string; run: () => void };
const tests: Test[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function started(caseDefinition: MedicalCase) {
  return beginCase(createInitialState(caseDefinition), caseDefinition);
}

test("initialises from case vitals and starts at the hook", () => {
  const state = createInitialState(theLongFlight);
  assert.equal(state.phase, "hook");
  assert.equal(state.vitals.hr, 118);
  assert.equal(state.vitals.spo2, 91);
  assert.equal(formatBloodPressure(state.vitals), "108/68");
  assert.equal(formatCaseClock(state.timeMinute), "00:00");
});

test("applies an action, advances time, and records a key clue", () => {
  const state = applyAction(started(theLongFlight), theLongFlight, "ask_travel");
  assert.equal(state.timeMinute, 1);
  assert.equal(state.latestActionId, "ask_travel");
  assert.equal(state.completedActions.length, 1);
  assert.equal(state.discoveredEvidence[0]?.isKeyClue, true);
  assert.deepEqual(state.triggeredEventIds, ["travel_risk_revealed"]);
  assert.equal(state.score.earlyKeyClue, 10);
  assert.throws(() => applyAction(state, theLongFlight, "ask_travel"), /cannot be completed twice/);
});

test("triggers every due deterioration rule exactly once", () => {
  let state = elapseTime(started(theLongFlight), theLongFlight, 8, "No decision made");
  assert.deepEqual(state.appliedDeteriorationRuleIds.sort(), ["pe_no_monitoring", "pe_no_oxygen"]);
  assert.equal(state.vitals.spo2, 86);
  assert.equal(state.vitals.hr, 134);
  assert.equal(state.vitals.rr, 30);
  assert.equal(state.status, "active");
  assert.ok(state.triggeredEventIds.includes("hypoxemia_worsens"));
  state = elapseTime(state, theLongFlight, 1);
  assert.equal(state.appliedDeteriorationRuleIds.length, 2);
});

test("loses the case when a critical deadline passes untreated", () => {
  const state = elapseTime(started(theLongFlight), theLongFlight, 18);
  assert.equal(state.status, "complete");
  assert.equal(state.phase, "debrief");
  assert.equal(state.outcome, "patient_lost");
  assert.equal(state.timeMinute, 18);
});

test("interrupts a long test if the patient crashes before it finishes", () => {
  const state = applyAction(started(theLongFlight), theLongFlight, "order_ctpa");
  assert.equal(state.outcome, "patient_lost");
  assert.equal(
    state.completedActions.some((action) => action.actionId === "order_ctpa"),
    false,
  );
  assert.match(state.timeline.at(-1)?.title ?? "", /interrupted/);
});

test("scores premature anticoagulation as unsafe and harmful", () => {
  const state = applyAction(started(theLongFlight), theLongFlight, "start_anticoagulation");
  assert.equal(state.completedActions[0]?.safetyGateMet, false);
  assert.deepEqual(state.harmfulActionIds, ["start_anticoagulation"]);
  assert.equal(state.score.harmfulActions, -15);
});

test("allows anticoagulation after a high-probability evidence path", () => {
  let state = started(theLongFlight);
  for (const actionId of ["ask_travel", "ask_medications", "examine_legs"]) {
    state = applyAction(state, theLongFlight, actionId);
  }
  state = applyAction(state, theLongFlight, "start_anticoagulation");
  assert.equal(state.completedActions.at(-1)?.safetyGateMet, true);
  assert.deepEqual(state.harmfulActionIds, []);
});

test("records every differential change and evidence tag with case time", () => {
  let state = applyAction(started(theLongFlight), theLongFlight, "ask_travel");
  state = addToDifferential(state, theLongFlight, "panic_attack", 60);
  state = addToDifferential(state, theLongFlight, "pulmonary_embolism", 40);
  state = rankDifferential(state, theLongFlight, ["pulmonary_embolism", "panic_attack"]);
  state = setDifferentialConfidence(state, theLongFlight, "pulmonary_embolism", 75);
  state = tagEvidence(state, theLongFlight, "pulmonary_embolism", "ask_travel", "supports");
  assert.equal(state.differentialHistory.length, 5);
  assert.equal(state.differential[0]?.diagnosisId, "pulmonary_embolism");
  assert.equal(state.differential[0]?.evidenceTags[0]?.relationship, "supports");
  assert.ok(state.differentialHistory.every((change) => change.timeMinute === 1));
});

test("charges only the authored hint costs", () => {
  let state = started(theLongFlight);
  state = requestNextHint(state, theLongFlight);
  assert.equal(state.score.hints, 0);
  state = requestNextHint(state, theLongFlight);
  assert.equal(state.score.hints, -5);
  state = requestNextHint(state, theLongFlight);
  assert.equal(state.score.hints, -15);
  assert.throws(() => requestNextHint(state, theLongFlight), /already been used/);
});

test("penalises low-value tests without retriggering prevented deterioration", () => {
  let state = started(theLongFlight);
  state = applyAction(state, theLongFlight, "give_oxygen");
  state = applyAction(state, theLongFlight, "start_monitoring");
  state = applyAction(state, theLongFlight, "order_abdominal_ultrasound");
  assert.deepEqual(state.appliedDeteriorationRuleIds, []);
  assert.deepEqual(state.unnecessaryActionIds, ["order_abdominal_ultrasound"]);
  assert.equal(state.score.unnecessaryTests, -3);
});

test("reports commit readiness after a test and differential entry", () => {
  let state = started(theLongFlight);
  state = addToDifferential(state, theLongFlight, "pulmonary_embolism");
  assert.deepEqual(getCommitReadiness(state, theLongFlight), {
    ready: false,
    hasInvestigation: false,
    hasDifferential: true,
  });
  state = applyAction(state, theLongFlight, "give_oxygen");
  state = applyAction(state, theLongFlight, "start_monitoring");
  state = applyAction(state, theLongFlight, "order_ecg");
  assert.equal(getCommitReadiness(state, theLongFlight).ready, true);
});

test("uses an explicit, cancellable commitment state", () => {
  const investigating = started(theLongFlight);
  assert.throws(
    () =>
      commitCase(investigating, theLongFlight, {
        diagnosisId: "pulmonary_embolism",
        treatmentIds: [],
      }),
    /Open the commitment step/,
  );
  const committing = openCommit(investigating, theLongFlight);
  assert.equal(committing.phase, "commit");
  assert.throws(
    () => applyAction(committing, theLongFlight, "ask_travel"),
    /only available during the investigation/,
  );
  assert.equal(cancelCommit(committing, theLongFlight).phase, "investigate");
});

test("removes a hypothesis and closes the ranking gap", () => {
  let state = started(theLongFlight);
  state = addToDifferential(state, theLongFlight, "panic_attack");
  state = addToDifferential(state, theLongFlight, "pneumonia");
  state = removeFromDifferential(state, theLongFlight, "panic_attack");
  assert.equal(state.differential.length, 1);
  assert.equal(state.differential[0]?.diagnosisId, "pneumonia");
  assert.equal(state.differential[0]?.rank, 1);
  assert.equal(state.differentialHistory.at(-1)?.type, "remove");
});

test("completes an efficient pulmonary embolism win end to end", () => {
  let state = started(theLongFlight);
  for (const actionId of [
    "give_oxygen",
    "start_monitoring",
    "gain_iv_access",
    "ask_travel",
    "ask_medications",
    "examine_legs",
    "order_doppler",
    "start_anticoagulation",
  ]) {
    state = applyAction(state, theLongFlight, actionId);
  }
  state = addToDifferential(state, theLongFlight, "pulmonary_embolism", 90);
  state = commitCase(openCommit(state, theLongFlight), theLongFlight, {
    diagnosisId: "pulmonary_embolism",
    treatmentIds: ["give_oxygen", "start_monitoring", "gain_iv_access", "start_anticoagulation"],
  });
  assert.equal(state.outcome, "diagnosed");
  assert.equal(state.score.diagnosis, 0);
  assert.equal(state.score.treatment, 0);
  const debrief = createDebrief(state, theLongFlight);
  assert.equal(debrief.outcome, "diagnosed");
  assert.ok(debrief.foundKeyClues.length >= 3);
  assert.equal(debrief.teachingPoints.length, 3);
  assert.equal(debrief.differentialHistory.length, 1);
  assert.equal(debrief.differentialHistory[0]?.snapshot[0]?.diagnosisId, "pulmonary_embolism");
});

test("solves pulmonary embolism with efficiency and treatment penalties", () => {
  let state = started(theLongFlight);
  state = applyAction(state, theLongFlight, "give_oxygen");
  state = applyAction(state, theLongFlight, "start_monitoring");
  state = applyAction(state, theLongFlight, "order_abdominal_ultrasound");
  state = requestNextHint(state, theLongFlight);
  state = requestNextHint(state, theLongFlight);
  state = addToDifferential(state, theLongFlight, "pulmonary_embolism", 70);
  state = commitCase(openCommit(state, theLongFlight), theLongFlight, {
    diagnosisId: "pulmonary_embolism",
    treatmentIds: ["give_oxygen", "start_monitoring"],
  });
  assert.equal(state.outcome, "diagnosed");
  assert.equal(state.score.unnecessaryTests, -3);
  assert.equal(state.score.hints, -5);
  assert.equal(state.score.treatment, -10);
  assert.ok(state.score.total < state.score.base);
});

test("wins the aortic dissection case with impulse control and surgery", () => {
  let state = started(theTearingPain);
  for (const actionId of [
    "start_monitoring",
    "gain_iv_access",
    "give_beta_blocker",
    "call_cardiothoracic_surgery",
    "give_opioid_analgesia",
    "check_both_arm_bp",
    "order_cxr",
    "order_ct_aorta",
  ]) {
    state = applyAction(state, theTearingPain, actionId);
  }
  state = addToDifferential(state, theTearingPain, "aortic_dissection", 95);
  state = commitCase(openCommit(state, theTearingPain), theTearingPain, {
    diagnosisId: "aortic_dissection",
    treatmentIds: [
      "start_monitoring",
      "give_opioid_analgesia",
      "give_beta_blocker",
      "call_cardiothoracic_surgery",
    ],
  });
  assert.equal(state.outcome, "diagnosed");
  assert.equal(state.score.diagnosis, 0);
  assert.equal(state.score.treatment, 0);
});

test("solves aortic dissection with an incomplete-plan penalty", () => {
  let state = started(theTearingPain);
  state = applyAction(state, theTearingPain, "give_beta_blocker");
  state = applyAction(state, theTearingPain, "call_cardiothoracic_surgery");
  state = addToDifferential(state, theTearingPain, "aortic_dissection", 80);
  state = commitCase(openCommit(state, theTearingPain), theTearingPain, {
    diagnosisId: "aortic_dissection",
    treatmentIds: ["give_beta_blocker", "call_cardiothoracic_surgery"],
  });
  assert.equal(state.outcome, "diagnosed");
  assert.equal(state.score.treatment, -10);
});

test("makes thrombolysis for presumed MI a catastrophic aortic-dissection ending", () => {
  let state = started(theTearingPain);
  state = addToDifferential(state, theTearingPain, "acute_coronary_syndrome", 80);
  state = commitCase(openCommit(state, theTearingPain), theTearingPain, {
    diagnosisId: "acute_coronary_syndrome",
    treatmentIds: ["give_thrombolysis"],
  });
  assert.equal(state.outcome, "patient_lost");
  assert.deepEqual(state.harmfulActionIds, ["give_thrombolysis"]);
  assert.equal(state.score.diagnosis, -40);
  assert.equal(
    createDebrief(state, theTearingPain).harmfulActions[0]?.actionId,
    "give_thrombolysis",
  );
});

test("validator rejects an unsolvable differential definition", () => {
  const invalid = structuredClone(theLongFlight) as MedicalCase;
  invalid.differential = invalid.differential.map((diagnosis) => ({
    ...diagnosis,
    isCorrect: false,
  }));
  invalid.actions = invalid.actions.map((action) => ({ ...action, isKeyClue: false }));
  const issues = validateCase(invalid);
  assert.ok(issues.some((issue) => issue.message.includes("Exactly one diagnosis")));
  assert.ok(issues.some((issue) => issue.message.includes("key clue")));
});

let passed = 0;
for (const current of tests) {
  try {
    current.run();
    passed += 1;
    console.log(`✓ ${current.name}`);
  } catch (error) {
    console.error(`✗ ${current.name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} case-engine tests passed.`);

import {
  applyAction,
  applyVitalsDelta,
  beginCase,
  createInitialState,
  elapseTime,
  type GameState,
  type RuntimeVitals,
  type TimelineEvent,
} from "@/features/case-challenge/engine";
import type {
  ActionSafetyGate,
  CaseAction,
  DeteriorationRule,
  MedicalCase,
  ResultCondition,
  VitalSign,
  VitalsDelta,
} from "@/features/case-challenge/schema";
import {
  ALERT_SOURCE_META,
  CATEGORY_STEP,
  CLUE_META,
  VITAL_META,
  VITAL_ORDER,
  type BuildStep,
} from "./vocabulary";

/*
 * Read-only analysis of a case for the studio.
 *
 * Everything here is derived from the case data or from running the real
 * engine (`case-challenge/engine.ts`); nothing invents clinical behaviour.
 * Functions must not throw on half-written drafts.
 */

export function actionLabel(definition: MedicalCase, id: string): string {
  return definition.actions.find((action) => action.id === id)?.label || "a removed action";
}

export function diagnosisLabel(definition: MedicalCase, id: string): string {
  return definition.differential.find((item) => item.id === id)?.label || "a removed diagnosis";
}

export function ruleTitle(definition: MedicalCase, rule: DeteriorationRule): string {
  return rule.action
    ? `“${actionLabel(definition, rule.action)}” not done by minute ${rule.ifNotDoneBy}`
    : `Untitled event at minute ${rule.ifNotDoneBy}`;
}

export function listText(items: readonly string[], joiner = "and"): string {
  const quoted = items.map((item) => `“${item}”`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} ${joiner} ${quoted.at(-1)}`;
}

/* ---- Vitals ---------------------------------------------------------------- */

export function parseBp(bp: string): { systolicBp: number; diastolicBp: number } | null {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(bp);
  if (!match?.[1] || !match[2]) return null;
  return { systolicBp: Number(match[1]), diastolicBp: Number(match[2]) };
}

export function initialVitals(definition: MedicalCase): RuntimeVitals | null {
  const first = definition.vitalsTimeline[0];
  if (!first) return null;
  const bp = parseBp(first.bp);
  if (!bp) return null;
  return { hr: first.hr, ...bp, rr: first.rr, spo2: first.spo2, temp: first.temp };
}

export function vitalValue(vitals: RuntimeVitals, sign: VitalSign): number {
  return vitals[sign];
}

export function formatVital(sign: VitalSign, value: number): string {
  return sign === "temp" ? value.toFixed(1) : String(Math.round(value));
}

export interface DeltaPart {
  sign: VitalSign;
  value: number;
  text: string;
}

export function deltaParts(delta: VitalsDelta | undefined): DeltaPart[] {
  if (!delta) return [];
  return VITAL_ORDER.filter((sign) => delta[sign] !== undefined && delta[sign] !== 0).map(
    (sign) => {
      const value = delta[sign] ?? 0;
      const magnitude = sign === "temp" ? Math.abs(value).toFixed(1) : String(Math.abs(value));
      return {
        sign,
        value,
        text: `${VITAL_META[sign].short} ${value > 0 ? "+" : "−"}${magnitude}`,
      };
    },
  );
}

export function applyDelta(vitals: RuntimeVitals, delta: VitalsDelta): RuntimeVitals {
  return applyVitalsDelta(vitals, delta);
}

/* ---- Conditions in plain language ---------------------------------------- */

function vitalRangeText(sign: VitalSign, range: { atLeast?: number; below?: number }): string {
  const meta = VITAL_META[sign];
  const unit = sign === "spo2" ? "%" : ` ${meta.unit}`;
  if (range.atLeast !== undefined && range.below !== undefined) {
    return `${meta.label.toLowerCase()} is between ${range.atLeast} and ${range.below}${unit} (not including ${range.below})`;
  }
  if (range.atLeast !== undefined)
    return `${meta.label.toLowerCase()} is ${range.atLeast}${unit} or more`;
  if (range.below !== undefined)
    return `${meta.label.toLowerCase()} is below ${range.below}${unit}`;
  return `${meta.label.toLowerCase()} is any value`;
}

/** Each part of a `when` as a sentence fragment ("the student has already …"). */
export function describeCondition(definition: MedicalCase, when: ResultCondition): string[] {
  const parts: string[] = [];
  if (when.afterActions?.length) {
    parts.push(
      `the student has already done ${listText(when.afterActions.map((id) => actionLabel(definition, id)))}`,
    );
  }
  if (when.notAfterActions?.length) {
    parts.push(
      `the student has not yet done ${listText(
        when.notAfterActions.map((id) => actionLabel(definition, id)),
        "or",
      )}`,
    );
  }
  if (when.afterDeterioration?.length) {
    for (const id of when.afterDeterioration) {
      const rule = definition.deteriorationRules.find((item) => item.id === id);
      parts.push(
        rule
          ? `the patient has deteriorated (${ruleTitle(definition, rule)})`
          : "a removed deterioration event has happened",
      );
    }
  }
  for (const sign of VITAL_ORDER) {
    const range = when.vitals?.[sign];
    if (range) parts.push(`the patient's ${vitalRangeText(sign, range)}`);
  }
  return parts.length ? parts : ["always (no condition set)"];
}

export interface GateDescription {
  all: string[];
  any: string[];
  threshold: { minimum: number; of: string[] } | null;
}

export function describeGate(definition: MedicalCase, gate: ActionSafetyGate): GateDescription {
  const names = (ids: readonly string[] | undefined) =>
    (ids ?? []).map((id) => actionLabel(definition, id));
  const threshold = gate.supportingActionThreshold;
  return {
    all: names(gate.allActionIds),
    any: names(gate.anyActionIds),
    threshold: threshold
      ? { minimum: threshold.minimumCompleted, of: names(threshold.actionIds) }
      : null,
  };
}

/** One sentence that matches the engine's rule: all AND (any OR threshold). */
export function gateSentence(definition: MedicalCase, gate: ActionSafetyGate): string {
  const { all, any, threshold } = describeGate(definition, gate);
  const alternatives: string[] = [];
  if (any.length) {
    alternatives.push(
      any.length === 1 ? `done ${listText(any)}` : `done at least one of ${listText(any, "or")}`,
    );
  }
  if (threshold) {
    alternatives.push(`done at least ${threshold.minimum} of ${listText(threshold.of)}`);
  }
  const parts: string[] = [];
  if (all.length) parts.push(`done ${listText(all)}`);
  if (alternatives.length) parts.push(alternatives.join(", or "));
  if (!parts.length) return "There are no prerequisites yet, so it always counts as safe.";
  return `Safe once the student has ${parts.join(", and has ")}.`;
}

/* ---- Assessment of an action ------------------------------------------- */

export type Verdict = "fatal" | "harmful" | "context" | "beneficial" | "unnecessary" | "neutral";

export const VERDICT_META: Record<Verdict, { label: string; description: string }> = {
  fatal: { label: "Ends the case", description: "Choosing this loses the patient." },
  harmful: { label: "Harmful", description: "Always penalised." },
  context: { label: "Depends on context", description: "Safe only once conditions are met." },
  beneficial: {
    label: "Beneficial",
    description: "Required, or prevents deterioration.",
  },
  unnecessary: { label: "Unnecessary", description: "Penalised as over-investigation." },
  neutral: { label: "No score effect", description: "Neither rewarded nor penalised." },
};

export interface AssessmentLine {
  tone: "good" | "bad" | "warn" | "info" | "neutral";
  text: string;
}

export interface ActionAssessment {
  verdict: Verdict;
  lines: AssessmentLine[];
  /** Debrief explanation students read (harmful or unsafe). */
  debrief: string | null;
  preventsRules: DeteriorationRule[];
  isRequired: boolean;
}

function points(value: number): string {
  const magnitude = Math.abs(value);
  return `${magnitude} point${magnitude === 1 ? "" : "s"}`;
}

export function assessAction(definition: MedicalCase, action: CaseAction): ActionAssessment {
  const { scoring, solution } = definition;
  const lines: AssessmentLine[] = [];
  const isRequired = solution.keyTreatment.includes(action.id);
  const preventsRules = definition.deteriorationRules.filter((rule) => rule.action === action.id);

  if (action.immediateFailure) {
    lines.push({
      tone: "bad",
      text: action.harmful
        ? `Ends the case at once: the patient is lost. Also counts as harmful (−${points(scoring.perHarmfulAction)}).`
        : "Ends the case at once: the patient is lost.",
    });
  } else if (action.harmful) {
    lines.push({
      tone: "bad",
      text: `Harmful: costs ${points(scoring.perHarmfulAction)} whenever it is chosen, during the case or in the final plan.`,
    });
  }
  if (action.safeWhen) {
    lines.push({
      tone: "warn",
      text: `${gateSentence(definition, action.safeWhen)} ${
        action.penalizeWhenUnsafe
          ? `If done earlier it counts as harmful (−${points(scoring.perHarmfulAction)}).`
          : "If done earlier the student sees a warning, but loses no points."
      }`,
    });
  } else if (action.penalizeWhenUnsafe) {
    lines.push({
      tone: "warn",
      text: "Set to be penalised when unsafe, but no safety condition is defined, so it is never penalised.",
    });
  }
  if (isRequired) {
    lines.push({
      tone: "good",
      text: `Required treatment: each one left out of the final plan costs ${points(scoring.perMissedKeyTreatment)}.`,
    });
  }
  for (const rule of preventsRules) {
    lines.push({
      tone: "good",
      text: `Prevents deterioration if done by minute ${rule.ifNotDoneBy}${
        rule.lossAtMinute !== undefined
          ? `; the patient is lost at minute ${rule.lossAtMinute} without it`
          : ""
      }.`,
    });
  }
  if (action.isUnnecessary) {
    lines.push({
      tone: "warn",
      text: `Unnecessary: costs ${points(scoring.perUnnecessaryTest)} each time it is used.`,
    });
  }
  if (action.isKeyClue) {
    lines.push({
      tone: "info",
      text: `Key clue: listed as found or missed in the debrief. Finding any key clue by minute ${scoring.earlyClueCutoffMinute} earns +${points(scoring.bonusKeyClueFoundEarly)} (once).`,
    });
  }

  let verdict: Verdict = "neutral";
  if (action.immediateFailure) verdict = "fatal";
  else if (action.harmful) verdict = "harmful";
  else if (action.safeWhen) verdict = "context";
  else if (isRequired || preventsRules.length) verdict = "beneficial";
  else if (action.isUnnecessary) verdict = "unnecessary";

  const debriefText = solution.harmfulActionDebrief[action.id]?.trim();
  const debrief =
    debriefText ||
    (action.penalizeWhenUnsafe && action.safeWhen?.explanation.trim()
      ? action.safeWhen.explanation
      : null);
  return { verdict, lines, debrief: debrief ?? null, preventsRules, isRequired };
}

/* ---- Running the engine --------------------------------------------------- */

export interface CoursePoint {
  minute: number;
  vitals: RuntimeVitals;
  firedRules: DeteriorationRule[];
}

export interface CourseProjection {
  points: CoursePoint[];
  lostAt: number | null;
  lostRule: DeteriorationRule | null;
}

function started(definition: MedicalCase): GameState | null {
  try {
    return beginCase(createInitialState(definition), definition);
  } catch {
    return null;
  }
}

/**
 * What happens if the student does nothing at all: the engine is advanced to
 * each authored deadline in turn and the vitals recorded until the case ends.
 */
export function untreatedCourse(definition: MedicalCase): CourseProjection | null {
  let state = started(definition);
  if (!state) return null;
  const points: CoursePoint[] = [
    { minute: state.timeMinute, vitals: state.vitals, firedRules: [] },
  ];
  const minutes = [
    ...new Set(
      definition.deteriorationRules.flatMap((rule) =>
        rule.lossAtMinute === undefined
          ? [rule.ifNotDoneBy]
          : [rule.ifNotDoneBy, rule.lossAtMinute],
      ),
    ),
  ]
    .filter((minute) => Number.isFinite(minute) && minute > 0)
    .sort((a, b) => a - b);
  try {
    for (const minute of minutes) {
      if (minute <= state.timeMinute) continue;
      const before = new Set(state.appliedDeteriorationRuleIds);
      state = elapseTime(state, definition, minute - state.timeMinute, "Waiting");
      const firedRules = definition.deteriorationRules.filter(
        (rule) => state!.appliedDeteriorationRuleIds.includes(rule.id) && !before.has(rule.id),
      );
      points.push({ minute: state.timeMinute, vitals: state.vitals, firedRules });
      if (state.outcome === "patient_lost") {
        const lostRule =
          definition.deteriorationRules
            .filter((rule) => rule.lossAtMinute === state!.timeMinute)
            .at(0) ?? null;
        return { points, lostAt: state.timeMinute, lostRule };
      }
    }
  } catch {
    return { points, lostAt: null, lostRule: null };
  }
  return { points, lostAt: null, lostRule: null };
}

/** Vitals in the untreated course at a given minute (they only change at events). */
export function courseVitalsAt(course: CourseProjection, minute: number): RuntimeVitals | null {
  if (course.lostAt !== null && minute >= course.lostAt) return null;
  let current: RuntimeVitals | null = null;
  for (const point of course.points) {
    if (point.minute <= minute) current = point.vitals;
  }
  return current;
}

export type SequenceStep = { kind: "action"; id: string } | { kind: "wait"; minutes: number };

export interface SequenceFrame {
  step: SequenceStep;
  title: string;
  minute: number;
  vitals: RuntimeVitals;
  events: TimelineEvent[];
  outcome: GameState["outcome"];
  score: number;
  error: string | null;
}

/** Play a list of actions/waits through the real engine and record each state. */
export function simulateSequence(
  definition: MedicalCase,
  steps: readonly SequenceStep[],
): { start: GameState | null; frames: SequenceFrame[] } {
  const start = started(definition);
  if (!start) return { start: null, frames: [] };
  let state = start;
  const frames: SequenceFrame[] = [];
  for (const step of steps) {
    const title =
      step.kind === "action"
        ? actionLabel(definition, step.id)
        : `Wait ${step.minutes} minute${step.minutes === 1 ? "" : "s"}`;
    const before = state.timeline.length;
    let error: string | null = null;
    if (state.status === "complete") {
      error = "The case has already ended.";
    } else {
      try {
        state =
          step.kind === "action"
            ? applyAction(state, definition, step.id)
            : elapseTime(state, definition, step.minutes, "Waiting");
      } catch (problem) {
        error = problem instanceof Error ? problem.message : "This step could not be applied.";
      }
    }
    frames.push({
      step,
      title,
      minute: state.timeMinute,
      vitals: state.vitals,
      events: error ? [] : state.timeline.slice(before),
      outcome: state.outcome,
      score: state.score.total,
      error,
    });
  }
  return { start, frames };
}

/* ---- Consistency checks ------------------------------------------------- */

export interface Finding {
  level: "warning" | "info";
  message: string;
  step: BuildStep;
  actionId?: string;
  anchor?: string;
}

/**
 * Contradictions that can be detected reliably from the data: settings that
 * cancel each other out, or that the engine would treat differently from how
 * they read. Passing these does not make a case clinically correct.
 */
export function consistencyFindings(definition: MedicalCase): Finding[] {
  const findings: Finding[] = [];
  const { solution } = definition;
  const correctId = solution.diagnosisId;
  const tempting = definition.differential.find((item) => item.isTempting);
  const forAction = (action: CaseAction, level: Finding["level"], message: string) =>
    findings.push({ level, message, step: CATEGORY_STEP[action.category], actionId: action.id });

  for (const action of definition.actions) {
    const name = `“${action.label || "Untitled action"}”`;
    const required = solution.keyTreatment.includes(action.id);
    if (required && action.harmful) {
      forAction(action, "warning", `${name} is a required treatment but is also marked harmful.`);
    }
    if (required && action.immediateFailure) {
      forAction(
        action,
        "warning",
        `${name} is a required treatment but ends the case when chosen.`,
      );
    }
    if (action.isKeyClue && action.isUnnecessary) {
      forAction(action, "warning", `${name} is a key clue but is also penalised as unnecessary.`);
    }
    if (action.isKeyClue && action.clueTier === "none") {
      forAction(
        action,
        "warning",
        `${name} is a key clue but its clue type is “${CLUE_META.none.label}”, so the simulator never records it as found and the debrief always lists it as missed.`,
      );
    }
    if (action.immediateFailure && !action.harmful) {
      forAction(
        action,
        "warning",
        `${name} ends the case but is not marked harmful, so it costs no points and has no debrief explanation.`,
      );
    }
    if (action.penalizeWhenUnsafe && !action.safeWhen) {
      forAction(
        action,
        "warning",
        `${name} should be penalised when unsafe, but has no safety condition, so it is never penalised.`,
      );
    }
    if (action.clueTier === "red_herring" && correctId && action.supports.includes(correctId)) {
      forAction(action, "warning", `${name} is a red herring but supports the correct diagnosis.`);
    }
    if (correctId && action.supports.includes(correctId) && action.against.includes(correctId)) {
      forAction(
        action,
        "warning",
        `${name} both supports and argues against the correct diagnosis.`,
      );
    }
  }

  for (const id of Object.keys(solution.harmfulActionDebrief)) {
    const action = definition.actions.find((item) => item.id === id);
    if (!action) {
      findings.push({
        level: "info",
        message:
          "A debrief explanation belongs to an action that no longer exists; it is never shown.",
        step: "scoring",
        anchor: "studio-harmful",
      });
    } else if (!action.harmful && !action.penalizeWhenUnsafe) {
      forAction(
        action,
        "info",
        `“${action.label}” has a harmful-action debrief explanation but is not harmful, so students never see it.`,
      );
    }
  }

  for (const rule of definition.deteriorationRules) {
    const action = definition.actions.find((item) => item.id === rule.action);
    if (rule.lossAtMinute !== undefined && rule.lossAtMinute < rule.ifNotDoneBy) {
      findings.push({
        level: "warning",
        message: `The patient is lost at minute ${rule.lossAtMinute}, before the warning at minute ${rule.ifNotDoneBy} is given.`,
        step: "progression",
        anchor: `studio-rule-${rule.id}`,
      });
    }
    if (action?.harmful) {
      findings.push({
        level: "warning",
        message: `Deterioration at minute ${rule.ifNotDoneBy} is prevented by “${action.label}”, which is marked harmful.`,
        step: "progression",
        anchor: `studio-rule-${rule.id}`,
      });
    }
    if (action && action.timeCostMin > rule.ifNotDoneBy) {
      findings.push({
        level: "warning",
        message: `“${action.label}” takes ${action.timeCostMin} minutes, longer than its ${rule.ifNotDoneBy}-minute deadline, so this deterioration can never be prevented.`,
        step: "progression",
        anchor: `studio-rule-${rule.id}`,
      });
    }
  }

  if (
    correctId &&
    !definition.actions.some((action) => action.isKeyClue && action.supports.includes(correctId))
  ) {
    findings.push({
      level: "warning",
      message: "No key clue supports the correct diagnosis.",
      step: "history",
    });
  }
  if (tempting && !definition.actions.some((action) => action.supports.includes(tempting.id))) {
    findings.push({
      level: "info",
      message: `Nothing supports the tempting diagnosis (“${tempting.label}”), so it may not tempt anyone.`,
      step: "basics",
      anchor: "studio-differential",
    });
  }
  const ungrouped = definition.actions.filter((action) => !action.group?.trim());
  if (ungrouped.length) {
    const first = ungrouped[0]!;
    findings.push({
      level: "info",
      message: `${ungrouped.length} action${ungrouped.length === 1 ? " is" : "s are"} not filed under a clinical heading yet.`,
      step: CATEGORY_STEP[first.category],
      actionId: first.id,
    });
  }
  return findings;
}

/* ---- Reference observations vs the simulation ------------------------------ */

export interface SnapshotComparison {
  minute: number;
  differences: { sign: VitalSign; authored: number; simulated: number }[];
  /** The simulated patient is already lost by this minute. */
  lostBefore: boolean;
}

/**
 * Compare later authored vitals snapshots (reference only; the engine reads
 * minute 0 alone) with the simulated untreated course at the same minute.
 */
export function compareSnapshots(
  definition: MedicalCase,
  course: CourseProjection | null,
): SnapshotComparison[] {
  if (!course) return [];
  return definition.vitalsTimeline.slice(1).map((snapshot) => {
    const simulated = courseVitalsAt(course, snapshot.tMinute);
    if (!simulated) return { minute: snapshot.tMinute, differences: [], lostBefore: true };
    const bp = parseBp(snapshot.bp);
    const authored: Partial<Record<VitalSign, number>> = {
      hr: snapshot.hr,
      rr: snapshot.rr,
      spo2: snapshot.spo2,
      temp: snapshot.temp,
      ...(bp ?? {}),
    };
    const differences = VITAL_ORDER.flatMap((sign) => {
      const value = authored[sign];
      if (value === undefined) return [];
      const sim = simulated[sign];
      return Math.abs(value - sim) > (sign === "temp" ? 0.05 : 0.5)
        ? [{ sign, authored: value, simulated: sim }]
        : [];
    });
    return { minute: snapshot.tMinute, differences, lostBefore: false };
  });
}

export function alertSourceLabel(rule: DeteriorationRule): string {
  return ALERT_SOURCE_META[rule.source].label;
}

/* ---- Counts ------------------------------------------------------------- */

export function countByCategory(definition: MedicalCase): Record<CaseAction["category"], number> {
  const counts = { ask: 0, examine: 0, test: 0, treat: 0 };
  for (const action of definition.actions) counts[action.category] += 1;
  return counts;
}

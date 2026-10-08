import type { ExaminerSignal, OsceCardStyle, OsceMode } from "./schema.js";

export type ExaminerReactionExpression =
  | "neutral"
  | "writing"
  | "nod"
  | "eyebrow_raised"
  | "slight_frown"
  | "checks_watch"
  | "impressed"
  | "serious_pause";

export type ExaminerReactionCause =
  | "strong_technique"
  | "poor_technique"
  | "routine_writing"
  | "time_pressure"
  | "safety"
  | "noise"
  | "neutral";

export interface ExaminerReactionContext {
  sessionSeed: number;
  actionNumber: number;
  mode: OsceMode;
  cardStyle: OsceCardStyle;
  authoredSignal: ExaminerSignal;
  satisfiedCount: number;
  penalisedCount: number;
  remainingPercent: number;
  recentProgress: boolean;
  missedCue: boolean;
  triggeredCriticalFail: boolean;
  coachingLine: string | null;
}

export interface ResolvedExaminerReaction {
  expression: ExaminerReactionExpression;
  cause: ExaminerReactionCause;
  causeLabel: string;
  isNoise: boolean;
  delayMs: number;
  coachLine: string | null;
}

export const EXAMINER_REACTION_CONFIG = {
  trueSignalReliability: 0.8,
  neutralNoiseProbability: 0.1,
  writingAfterGoodProbability: 0.62,
  writingAfterNeutralProbability: 0.34,
  delayMs: { minimum: 500, maximum: 1500 },
  timePressureRemainingPercent: 25,
  poorStyles: [
    "leading",
    "judgmental",
    "jargon",
    "multi_barrelled",
    "irrelevant",
    "dismissive",
  ] as const satisfies readonly OsceCardStyle[],
  noiseExpressions: ["nod", "eyebrow_raised", "slight_frown"] as const,
} as const;

function unitRandom(seed: number, actionNumber: number, salt: number): number {
  let value = (seed ^ Math.imul(actionNumber + 1, 0x9e3779b1) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function delayFor(context: ExaminerReactionContext): number {
  const { minimum, maximum } = EXAMINER_REACTION_CONFIG.delayMs;
  return Math.round(
    minimum + unitRandom(context.sessionSeed, context.actionNumber, 0x51f15e) * (maximum - minimum),
  );
}

function authoredExpression(signal: ExaminerSignal): ExaminerReactionExpression {
  return signal === "none" ? "neutral" : signal;
}

function isPoorTechnique(context: ExaminerReactionContext): boolean {
  return (
    context.penalisedCount > 0 ||
    context.missedCue ||
    EXAMINER_REACTION_CONFIG.poorStyles.some((style) => style === context.cardStyle)
  );
}

function learnReaction(context: ExaminerReactionContext): ResolvedExaminerReaction {
  const poor = isPoorTechnique(context);
  const expression: ExaminerReactionExpression = context.triggeredCriticalFail
    ? "serious_pause"
    : poor
      ? "slight_frown"
      : context.satisfiedCount > 1
        ? "impressed"
        : context.satisfiedCount > 0
          ? "nod"
          : "writing";
  const cause: ExaminerReactionCause = context.triggeredCriticalFail
    ? "safety"
    : poor
      ? "poor_technique"
      : context.satisfiedCount > 0
        ? "strong_technique"
        : "routine_writing";
  const prompt = context.coachingLine
    ? poor
      ? `Pause and reconsider the phrasing. ${context.coachingLine}`
      : `Good choice. What made that efficient? ${context.coachingLine}`
    : poor
      ? "Pause and consider how that wording may have landed with the patient."
      : "Notice what that question added to the consultation.";
  return {
    expression,
    cause,
    causeLabel: context.triggeredCriticalFail
      ? "Safety concern"
      : poor
        ? context.missedCue
          ? "Clear coaching response to a missed patient cue"
          : "Clear coaching response to poor technique"
        : context.satisfiedCount > 0
          ? "Clear coaching response to effective technique"
          : "Coach note-taking",
    isNoise: false,
    delayMs: delayFor(context),
    coachLine: prompt,
  };
}

export function resolveExaminerReaction(
  context: ExaminerReactionContext,
): ResolvedExaminerReaction {
  if (context.mode === "learn") return learnReaction(context);
  const delayMs = delayFor(context);

  if (context.triggeredCriticalFail) {
    return {
      expression: "serious_pause",
      cause: "safety",
      causeLabel: "Visible pause after a safety-critical response",
      isNoise: false,
      delayMs,
      coachLine: null,
    };
  }

  if (
    context.remainingPercent < EXAMINER_REACTION_CONFIG.timePressureRemainingPercent &&
    !context.recentProgress
  ) {
    return {
      expression: "checks_watch",
      cause: "time_pressure",
      causeLabel: "Time was running short without recent checklist progress",
      isNoise: false,
      delayMs,
      coachLine: null,
    };
  }

  const poor = isPoorTechnique(context);
  const hasTrueSignal = context.authoredSignal !== "none" || poor;
  const reliabilityRoll = unitRandom(context.sessionSeed, context.actionNumber, 0xa17c9e);
  if (hasTrueSignal && reliabilityRoll < EXAMINER_REACTION_CONFIG.trueSignalReliability) {
    return {
      expression:
        context.authoredSignal === "none"
          ? "slight_frown"
          : authoredExpression(context.authoredSignal),
      cause: poor ? "poor_technique" : "strong_technique",
      causeLabel: poor
        ? context.missedCue
          ? "Genuine reaction to a missed patient cue"
          : `Genuine reaction to ${context.cardStyle} wording`
        : `Genuine reaction to effective ${context.cardStyle} technique`,
      isNoise: false,
      delayMs,
      coachLine: null,
    };
  }

  const noiseRoll = unitRandom(context.sessionSeed, context.actionNumber, 0x2bd7a1);
  if (!hasTrueSignal && noiseRoll < EXAMINER_REACTION_CONFIG.neutralNoiseProbability) {
    const expressions = EXAMINER_REACTION_CONFIG.noiseExpressions;
    const index = Math.floor(
      unitRandom(context.sessionSeed, context.actionNumber, 0x71ce55) * expressions.length,
    );
    return {
      expression: expressions[index] ?? "neutral",
      cause: "noise",
      causeLabel: "Noise — not linked to the quality of this action",
      isNoise: true,
      delayMs,
      coachLine: null,
    };
  }

  const writingProbability =
    context.satisfiedCount > 0
      ? EXAMINER_REACTION_CONFIG.writingAfterGoodProbability
      : EXAMINER_REACTION_CONFIG.writingAfterNeutralProbability;
  const writingRoll = unitRandom(context.sessionSeed, context.actionNumber, 0xd14f31);
  if (writingRoll < writingProbability) {
    return {
      expression: "writing",
      cause: "routine_writing",
      causeLabel: hasTrueSignal
        ? "Routine note-taking; the authored signal was deliberately not shown"
        : "Routine note-taking after a neutral or useful action",
      isNoise: false,
      delayMs,
      coachLine: null,
    };
  }

  return {
    expression: "neutral",
    cause: "neutral",
    causeLabel: hasTrueSignal
      ? "No visible signal; examiner reactions are intentionally imperfect"
      : "No visible reaction",
    isNoise: false,
    delayMs,
    coachLine: null,
  };
}

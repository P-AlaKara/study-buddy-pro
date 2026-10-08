import {
  OSCE_CATEGORIES,
  POOR_TECHNIQUE_STYLES,
  type ExaminerQuestion,
  type OsceCard,
  type OsceCategory,
  type OsceChecklistItem,
  type OsceMode,
  type OsceStation,
  type PatientExpression,
  type RapportBand,
} from "./schema.js";
import {
  resolveExaminerReaction,
  type ExaminerReactionCause,
  type ExaminerReactionExpression,
} from "./reaction-config.js";

export type OscePhase = "door" | "room" | "examiner_questions" | "debrief";
export type OsceStatus = "active" | "complete";
export type EndReason = "student" | "time" | null;
export type GlobalRating = "clear_fail" | "borderline" | "pass" | "good" | "excellent";
export type ClockWarning = "two_minutes" | "thirty_seconds" | "final_bell";
export type CurveballStatus = "dormant" | "pending" | "responded";
export type CueStatus = "active" | "picked" | "missed";
export type ChecklistDomain = OsceChecklistItem["domain"];

export type OsceTimelineEventType =
  | "door"
  | "room_entered"
  | "action"
  | "cue"
  | "cue_picked"
  | "cue_missed"
  | "curveball"
  | "critical_fail"
  | "clock_warning"
  | "nudge"
  | "consultation_ended"
  | "examiner_answer"
  | "result";

export interface OsceTimelineEvent {
  id: string;
  elapsedSecond: number;
  type: OsceTimelineEventType;
  title: string;
  detail: string;
  cardId?: string;
  cueId?: string;
  checklistItemIds?: string[];
}

export interface CompletedOsceAction {
  actionNumber: number;
  cardId: string;
  category: OsceCategory;
  startedAtSecond: number;
  completedAtSecond: number;
  timeCostSec: number;
  replyBand: RapportBand;
  reply: string;
  revealedFactIds: string[];
  satisfiedChecklistItemIds: string[];
  penalisedChecklistItemIds: string[];
  rapportBefore: number;
  rapportAfter: number;
  examinerSignal: OsceCard["examinerReaction"];
  wasPoorTechnique: boolean;
}

export interface ExaminerReactionLog {
  id: string;
  actionId: string;
  actionNumber: number;
  cardId: string;
  expression: ExaminerReactionExpression;
  cause: ExaminerReactionCause;
  causeLabel: string;
  isNoise: boolean;
  delayMs: number;
  triggeredAtSecond: number;
  coachLine: string | null;
}

export interface CueRuntimeState {
  cueId: string;
  status: CueStatus;
  triggeredAtAction: number;
  triggeredAtSecond: number;
  actionsRemaining: number;
  resolvedAtAction: number | null;
  resolvedAtSecond: number | null;
}

export interface ChecklistAchievement {
  checklistItemId: string;
  cardId: string;
  actionNumber: number;
  elapsedSecond: number;
}

export interface ChecklistPenalty {
  checklistItemId: string;
  cardId: string;
  actionNumber: number;
  elapsedSecond: number;
}

export interface RapportPoint {
  elapsedSecond: number;
  actionNumber: number;
  value: number;
  delta: number;
  reason: string;
  cardId: string | null;
}

export interface NudgeUse {
  tier: 1 | 2 | 3;
  pointCost: number;
  text: string;
  elapsedSecond: number;
}

export interface ExaminerAnswer {
  questionId: string;
  selectedOptionIds: string[];
  scorePercent: number;
  answeredAtSecond: number;
}

export interface ScoreBreakdown {
  checklist: number;
  communication: number;
  rapport: number;
  timeManagement: number;
  examinerQuestions: number;
  nudgePenalty: number;
  composite: number;
  checklistEarnedWeight: number;
  checklistTotalWeight: number;
  wastedSeconds: number;
  domainScores: Record<ChecklistDomain, number>;
}

export interface OsceResult {
  rating: GlobalRating;
  uncappedRating: GlobalRating;
  ratingReason: string;
  criticalFailIds: string[];
  score: ScoreBreakdown;
}

export interface OsceState {
  version: 1;
  stationId: string;
  mode: OsceMode;
  sessionSeed: number;
  phase: OscePhase;
  status: OsceStatus;
  endReason: EndReason;
  readingSecondsRemaining: number;
  remainingSeconds: number;
  idleRealSeconds: number;
  rapport: number;
  patientExpression: PatientExpression;
  latestPatientLine: string;
  completedActions: CompletedOsceAction[];
  examinerReactions: ExaminerReactionLog[];
  revealedFactIds: string[];
  checklistAchievements: Record<string, ChecklistAchievement>;
  checklistPenalties: ChecklistPenalty[];
  cueStates: CueRuntimeState[];
  curveball: {
    status: CurveballStatus;
    triggeredAtSecond: number | null;
    triggeredBy: "card" | "clock" | null;
    responseCardId: string | null;
  };
  criticalFailIds: string[];
  warningsShown: ClockWarning[];
  nudgesUsed: NudgeUse[];
  examinerAnswers: ExaminerAnswer[];
  rapportHistory: RapportPoint[];
  cardOrder: Record<OsceCategory, string[]>;
  timeline: OsceTimelineEvent[];
  finalResult: OsceResult | null;
  sequence: number;
}

export class OsceEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OsceEngineError";
  }
}

const poorStyles = new Set<string>(POOR_TECHNIQUE_STYLES);
const SENSITIVE_RAPPORT_THRESHOLD = 55;
const DOMAINS: ChecklistDomain[] = [
  "opening_and_consent",
  "history_content",
  "risk_and_red_flags",
  "ice",
  "communication",
  "closing_and_safety",
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneState(state: OsceState): OsceState {
  return structuredClone(state);
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function createCardOrder(
  station: OsceStation,
  mode: OsceMode,
  sessionSeed: number,
): Record<OsceCategory, string[]> {
  return Object.fromEntries(
    OSCE_CATEGORIES.map((category) => {
      const ids = station.cards.filter((card) => card.category === category).map((card) => card.id);
      return [
        category,
        mode === "learn" ? ids : shuffle(ids, sessionSeed ^ hashText(`${station.id}:${category}`)),
      ];
    }),
  ) as Record<OsceCategory, string[]>;
}

function assertState(state: OsceState, station: OsceStation): void {
  if (state.stationId !== station.id) {
    throw new OsceEngineError("This session belongs to a different OSCE station.");
  }
}

function assertRoomActive(state: OsceState): void {
  if (state.status !== "active" || state.phase !== "room") {
    throw new OsceEngineError("This action is only available while the consultation is active.");
  }
}

function elapsedSecond(state: OsceState, station: OsceStation): number {
  return station.clockSeconds - state.remainingSeconds;
}

function appendTimeline(state: OsceState, event: Omit<OsceTimelineEvent, "id">): void {
  state.sequence += 1;
  state.timeline.push({ ...event, id: `osce_event_${state.sequence}` });
}

function completedCardIds(state: OsceState): Set<string> {
  return new Set(state.completedActions.map((action) => action.cardId));
}

function rapportBandRank(band: RapportBand): number {
  return band === "low" ? 0 : band === "mid" ? 1 : 2;
}

function meetsRapportBand(current: RapportBand, minimum: RapportBand): boolean {
  return rapportBandRank(current) >= rapportBandRank(minimum);
}

export function getRapportBand(rapport: number): RapportBand {
  if (rapport < 35) return "low";
  if (rapport <= 65) return "mid";
  return "high";
}

export function formatOsceClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function createInitialOsceState(
  station: OsceStation,
  mode: OsceMode,
  sessionSeed: number,
): OsceState {
  if (!Number.isInteger(sessionSeed)) {
    throw new OsceEngineError("A whole-number session seed is required.");
  }

  return {
    version: 1,
    stationId: station.id,
    mode,
    sessionSeed,
    phase: "door",
    status: "active",
    endReason: null,
    readingSecondsRemaining: station.readingSeconds,
    remainingSeconds: station.clockSeconds,
    idleRealSeconds: 0,
    rapport: 50,
    patientExpression: station.patient.initialExpression,
    latestPatientLine: "",
    completedActions: [],
    examinerReactions: [],
    revealedFactIds: [],
    checklistAchievements: {},
    checklistPenalties: [],
    cueStates: [],
    curveball: {
      status: "dormant",
      triggeredAtSecond: null,
      triggeredBy: null,
      responseCardId: null,
    },
    criticalFailIds: [],
    warningsShown: [],
    nudgesUsed: [],
    examinerAnswers: [],
    rapportHistory: [
      {
        elapsedSecond: 0,
        actionNumber: 0,
        value: 50,
        delta: 0,
        reason: "Starting rapport",
        cardId: null,
      },
    ],
    cardOrder: createCardOrder(station, mode, sessionSeed),
    timeline: [
      {
        id: "osce_event_1",
        elapsedSecond: 0,
        type: "door",
        title: "Candidate reading time",
        detail: station.candidateInstructions,
      },
    ],
    finalResult: null,
    sequence: 1,
  };
}

export function advanceReadingCountdown(
  state: OsceState,
  station: OsceStation,
  realSeconds: number,
): OsceState {
  assertState(state, station);
  if (state.phase !== "door") throw new OsceEngineError("Reading time has already ended.");
  if (realSeconds < 0) throw new OsceEngineError("Reading time cannot move backwards.");
  const next = cloneState(state);
  next.readingSecondsRemaining = Math.max(0, next.readingSecondsRemaining - realSeconds);
  return next;
}

export function skipReading(state: OsceState, station: OsceStation): OsceState {
  assertState(state, station);
  if (state.phase !== "door") throw new OsceEngineError("Reading time has already ended.");
  const next = cloneState(state);
  next.readingSecondsRemaining = 0;
  return next;
}

export function enterRoom(state: OsceState, station: OsceStation): OsceState {
  assertState(state, station);
  if (state.phase !== "door") throw new OsceEngineError("The consultation room is already open.");
  const next = cloneState(state);
  next.phase = "room";
  next.readingSecondsRemaining = 0;
  next.latestPatientLine = station.patient.openingLine;
  appendTimeline(next, {
    elapsedSecond: 0,
    type: "room_entered",
    title: "The bell rings",
    detail: station.patient.openingLine,
  });
  return next;
}

function cueUnlockSatisfied(state: OsceState, id: string): boolean {
  const cue = state.cueStates.find((entry) => entry.cueId === id);
  return cue?.status === "active" || cue?.status === "picked";
}

function isCardAvailable(state: OsceState, station: OsceStation, card: OsceCard): boolean {
  const completed = completedCardIds(state);
  if (!card.repeatable && completed.has(card.id)) return false;
  if (station.curveball.responseCardIds.includes(card.id)) return false;

  if (card.availableOnlyInWindowOfCue) {
    const cue = state.cueStates.find(
      (entry) =>
        entry.cueId === card.availableOnlyInWindowOfCue &&
        entry.status === "active" &&
        entry.actionsRemaining > 0,
    );
    if (!cue) return false;
  }

  return card.unlockedBy.every((id) => completed.has(id) || cueUnlockSatisfied(state, id));
}

export function getAvailableCards(
  state: OsceState,
  station: OsceStation,
  category?: OsceCategory,
): OsceCard[] {
  assertState(state, station);
  if (state.phase !== "room" || state.status !== "active") return [];

  if (state.curveball.status === "pending") {
    const responses = station.curveball.responseCardIds
      .map((id) => station.cards.find((card) => card.id === id))
      .filter((card): card is OsceCard => Boolean(card));
    return category ? responses.filter((card) => card.category === category) : responses;
  }

  const candidates = station.cards.filter(
    (card) => (!category || card.category === category) && isCardAvailable(state, station, card),
  );
  return candidates.sort((first, second) => {
    if (first.category !== second.category) {
      return OSCE_CATEGORIES.indexOf(first.category) - OSCE_CATEGORIES.indexOf(second.category);
    }
    const order = state.cardOrder[first.category];
    return order.indexOf(first.id) - order.indexOf(second.id);
  });
}

function addCriticalFail(state: OsceState, station: OsceStation, failureId: string): void {
  if (state.criticalFailIds.includes(failureId)) return;
  const failure = station.criticalFails.find((entry) => entry.id === failureId);
  if (!failure) return;
  state.criticalFailIds.push(failureId);
  appendTimeline(state, {
    elapsedSecond: elapsedSecond(state, station),
    type: "critical_fail",
    title: "Critical fail recorded",
    detail: failure.label,
  });
}

function activateCurveball(
  state: OsceState,
  station: OsceStation,
  triggeredBy: "card" | "clock",
): void {
  if (state.curveball.status !== "dormant") return;
  state.curveball = {
    status: "pending",
    triggeredAtSecond: elapsedSecond(state, station),
    triggeredBy,
    responseCardId: null,
  };
  state.latestPatientLine = station.curveball.patientLine;
  state.patientExpression = "worried";
  appendTimeline(state, {
    elapsedSecond: elapsedSecond(state, station),
    type: "curveball",
    title: "The patient asks a direct question",
    detail: station.curveball.patientLine,
  });
}

function evaluateMissingCriticalFails(state: OsceState, station: OsceStation): void {
  const achieved = new Set(Object.keys(state.checklistAchievements));
  for (const failure of station.criticalFails) {
    if (failure.trigger === "action") continue;
    const missing = failure.triggeredBy.filter((id) => !achieved.has(id));
    const triggered =
      failure.trigger === "missing_any_checklist"
        ? missing.length > 0
        : missing.length === failure.triggeredBy.length;
    if (triggered) addCriticalFail(state, station, failure.id);
  }
}

function endRoom(state: OsceState, station: OsceStation, reason: Exclude<EndReason, null>): void {
  if (state.phase !== "room") return;
  state.phase = "examiner_questions";
  state.endReason = reason;
  state.idleRealSeconds = 0;
  evaluateMissingCriticalFails(state, station);
  appendTimeline(state, {
    elapsedSecond: elapsedSecond(state, station),
    type: "consultation_ended",
    title: reason === "time" ? "Time called" : "Consultation ended",
    detail:
      reason === "time"
        ? "The final bell ended the consultation."
        : "The student chose to end the consultation.",
  });
}

function processClockTransitions(
  state: OsceState,
  station: OsceStation,
  previousRemaining: number,
): void {
  const thresholds: Array<{ seconds: number; warning: ClockWarning; detail: string }> = [
    { seconds: 120, warning: "two_minutes", detail: "Two minutes remaining." },
    { seconds: 30, warning: "thirty_seconds", detail: "Thirty seconds remaining." },
  ];
  for (const threshold of thresholds) {
    if (
      previousRemaining > threshold.seconds &&
      state.remainingSeconds <= threshold.seconds &&
      !state.warningsShown.includes(threshold.warning)
    ) {
      state.warningsShown.push(threshold.warning);
      appendTimeline(state, {
        elapsedSecond: elapsedSecond(state, station),
        type: "clock_warning",
        title: "Time warning",
        detail: threshold.detail,
      });
    }
  }

  const elapsedPercent = (elapsedSecond(state, station) / station.clockSeconds) * 100;
  if (
    state.remainingSeconds > 0 &&
    elapsedPercent >= station.curveball.triggerAtPercentClock &&
    state.curveball.status === "dormant"
  ) {
    activateCurveball(state, station, "clock");
  }

  if (state.remainingSeconds === 0 && !state.warningsShown.includes("final_bell")) {
    state.warningsShown.push("final_bell");
    appendTimeline(state, {
      elapsedSecond: station.clockSeconds,
      type: "clock_warning",
      title: "Final bell",
      detail: "The station clock reached zero.",
    });
    endRoom(state, station, "time");
  }
}

function addRapportPoint(
  state: OsceState,
  station: OsceStation,
  before: number,
  reason: string,
  cardId: string | null,
): void {
  if (state.rapport === before) return;
  state.rapportHistory.push({
    elapsedSecond: elapsedSecond(state, station),
    actionNumber: state.completedActions.length,
    value: state.rapport,
    delta: state.rapport - before,
    reason,
    cardId,
  });
}

function progressCueWindows(state: OsceState, station: OsceStation, card: OsceCard): void {
  const actionNumber = state.completedActions.length;
  for (const cueState of state.cueStates) {
    if (cueState.status !== "active") continue;
    const cue = station.cues.find((entry) => entry.id === cueState.cueId);
    if (!cue) continue;

    if (cue.pickupCardIds.includes(card.id)) {
      cueState.status = "picked";
      cueState.resolvedAtAction = actionNumber;
      cueState.resolvedAtSecond = elapsedSecond(state, station);
      appendTimeline(state, {
        elapsedSecond: elapsedSecond(state, station),
        type: "cue_picked",
        title: "Patient cue picked up",
        detail: cue.patientLine,
        cueId: cue.id,
        cardId: card.id,
      });
      continue;
    }

    cueState.actionsRemaining -= 1;
    if (cueState.actionsRemaining > 0) continue;
    cueState.status = "missed";
    cueState.resolvedAtAction = actionNumber;
    cueState.resolvedAtSecond = elapsedSecond(state, station);
    state.rapport = clamp(state.rapport - cue.missedRapportPenalty, 0, 100);
    appendTimeline(state, {
      elapsedSecond: elapsedSecond(state, station),
      type: "cue_missed",
      title: "Patient cue missed",
      detail: cue.patientLine,
      cueId: cue.id,
    });
  }
}

function triggerAuthoredCue(state: OsceState, station: OsceStation, card: OsceCard): string | null {
  if (!card.triggersCue) return null;
  if (state.cueStates.some((entry) => entry.cueId === card.triggersCue)) return null;
  const cue = station.cues.find((entry) => entry.id === card.triggersCue);
  if (!cue) return null;
  const completed = completedCardIds(state);
  const prerequisitesMet = cue.requiresCardIds.every((id) => completed.has(id));
  if (
    !prerequisitesMet ||
    !meetsRapportBand(getRapportBand(state.rapport), cue.minimumRapportBand)
  ) {
    return null;
  }

  state.cueStates.push({
    cueId: cue.id,
    status: "active",
    triggeredAtAction: state.completedActions.length,
    triggeredAtSecond: elapsedSecond(state, station),
    actionsRemaining: cue.windowActions,
    resolvedAtAction: null,
    resolvedAtSecond: null,
  });
  appendTimeline(state, {
    elapsedSecond: elapsedSecond(state, station),
    type: "cue",
    title: cue.type === "emotional" ? "Emotional cue" : "Informational cue",
    detail: cue.patientLine,
    cueId: cue.id,
    cardId: card.id,
  });
  return cue.patientLine;
}

function determineExpression(state: OsceState, card: OsceCard): PatientExpression {
  if (card.rapportDelta <= -9 || card.style === "judgmental") return "irritated";
  if (state.curveball.status === "pending") return "worried";
  if (card.id === "cue_father_pickup") return "tearful";
  if (state.rapport < 35) return "guarded";
  if (card.id === "symptom_pain_at_rest") return "anxious";
  if (card.style === "empathic" && state.rapport > 65) return "relieved";
  if (card.category === "history_of_symptom") return "in_pain";
  return state.rapport > 65 ? "relieved" : "neutral";
}

export function selectOsceCard(state: OsceState, station: OsceStation, cardId: string): OsceState {
  assertState(state, station);
  assertRoomActive(state);
  const card = station.cards.find((entry) => entry.id === cardId);
  if (!card) throw new OsceEngineError(`Unknown OSCE card: ${cardId}.`);
  if (!getAvailableCards(state, station).some((entry) => entry.id === cardId)) {
    throw new OsceEngineError(`Card ${cardId} is not currently available.`);
  }

  const next = cloneState(state);
  const actionNumber = next.completedActions.length + 1;
  const missedCueCountBefore = next.cueStates.filter((cue) => cue.status === "missed").length;
  const criticalFailCountBefore = next.criticalFailIds.length;
  const startedAtSecond = elapsedSecond(next, station);
  const previousRemaining = next.remainingSeconds;
  next.remainingSeconds = Math.max(0, next.remainingSeconds - card.timeCostSec);
  const completedAtSecond = elapsedSecond(next, station);
  const rapportBefore = next.rapport;
  const replyBand = getRapportBand(rapportBefore);
  const reply = card.replies[replyBand];
  const sensitivePenalty =
    card.sensitive && rapportBefore < SENSITIVE_RAPPORT_THRESHOLD ? card.earlyRapportPenalty : 0;
  next.rapport = clamp(next.rapport + card.rapportDelta - sensitivePenalty, 0, 100);

  const revealed = [...card.revealsFacts];
  if (
    card.conditionalFactReveal &&
    meetsRapportBand(replyBand, card.conditionalFactReveal.minimumRapportBand)
  ) {
    revealed.push(...card.conditionalFactReveal.factIds);
  }
  next.revealedFactIds = [...new Set([...next.revealedFactIds, ...revealed])];

  for (const checklistItemId of card.satisfies) {
    if (!next.checklistAchievements[checklistItemId]) {
      next.checklistAchievements[checklistItemId] = {
        checklistItemId,
        cardId: card.id,
        actionNumber,
        elapsedSecond: completedAtSecond,
      };
    }
  }
  for (const checklistItemId of card.penalises) {
    next.checklistPenalties.push({
      checklistItemId,
      cardId: card.id,
      actionNumber,
      elapsedSecond: completedAtSecond,
    });
  }

  const completedAction: CompletedOsceAction = {
    actionNumber,
    cardId: card.id,
    category: card.category,
    startedAtSecond,
    completedAtSecond,
    timeCostSec: card.timeCostSec,
    replyBand,
    reply,
    revealedFactIds: [...new Set(revealed)],
    satisfiedChecklistItemIds: [...card.satisfies],
    penalisedChecklistItemIds: [...card.penalises],
    rapportBefore,
    rapportAfter: next.rapport,
    examinerSignal: card.examinerReaction,
    wasPoorTechnique: poorStyles.has(card.style),
  };
  next.completedActions.push(completedAction);
  next.latestPatientLine = reply;
  next.idleRealSeconds = 0;

  appendTimeline(next, {
    elapsedSecond: completedAtSecond,
    type: "action",
    title: card.label,
    detail: reply,
    cardId: card.id,
    checklistItemIds: [...card.satisfies],
  });

  progressCueWindows(next, station, card);
  const cueLine = triggerAuthoredCue(next, station, card);
  if (cueLine) next.latestPatientLine = `${reply}\n\n${cueLine}`;

  if (state.curveball.status === "pending" && station.curveball.responseCardIds.includes(card.id)) {
    next.curveball.status = "responded";
    next.curveball.responseCardId = card.id;
  } else if (card.triggersCurveball) {
    activateCurveball(next, station, "card");
  }

  for (const failure of station.criticalFails) {
    if (failure.trigger === "action" && failure.triggeredBy.includes(card.id)) {
      addCriticalFail(next, station, failure.id);
    }
  }

  const missedCue =
    next.cueStates.filter((cue) => cue.status === "missed").length > missedCueCountBefore;
  const triggeredCriticalFail = next.criticalFailIds.length > criticalFailCountBefore;
  const recentActionFloor = Math.max(1, actionNumber - 2);
  const recentProgress = Object.values(next.checklistAchievements).some(
    (achievement) => achievement.actionNumber >= recentActionFloor,
  );
  const coachingChecklistId = card.penalises[0] ?? card.satisfies[0];
  const coachingLine = coachingChecklistId
    ? (station.checklist.find((item) => item.id === coachingChecklistId)?.coachingLine ?? null)
    : null;
  const reaction = resolveExaminerReaction({
    sessionSeed: next.sessionSeed,
    actionNumber,
    mode: next.mode,
    cardStyle: card.style,
    authoredSignal: card.examinerReaction,
    satisfiedCount: card.satisfies.length,
    penalisedCount: card.penalises.length,
    remainingPercent: (next.remainingSeconds / station.clockSeconds) * 100,
    recentProgress,
    missedCue,
    triggeredCriticalFail,
    coachingLine,
  });
  next.examinerReactions.push({
    id: `osce_reaction_${actionNumber}`,
    actionId: `${card.id}:${actionNumber}`,
    actionNumber,
    cardId: card.id,
    expression: reaction.expression,
    cause: reaction.cause,
    causeLabel: reaction.causeLabel,
    isNoise: reaction.isNoise,
    delayMs: reaction.delayMs,
    triggeredAtSecond: completedAtSecond,
    coachLine: reaction.coachLine,
  });

  completedAction.rapportAfter = next.rapport;
  addRapportPoint(
    next,
    station,
    rapportBefore,
    sensitivePenalty > 0
      ? `${card.label} (including an early sensitive-question penalty)`
      : card.label,
    card.id,
  );
  next.patientExpression = determineExpression(next, card);
  processClockTransitions(next, station, previousRemaining);
  return next;
}

export function markStudentActive(state: OsceState, station: OsceStation): OsceState {
  assertState(state, station);
  if (state.phase !== "room") return state;
  const next = cloneState(state);
  next.idleRealSeconds = 0;
  return next;
}

export function advanceIdleTime(
  state: OsceState,
  station: OsceStation,
  realSeconds: number,
): OsceState {
  assertState(state, station);
  assertRoomActive(state);
  if (realSeconds < 0) throw new OsceEngineError("Idle time cannot move backwards.");
  if (realSeconds === 0) return state;

  const next = cloneState(state);
  const previousIdle = next.idleRealSeconds;
  next.idleRealSeconds += realSeconds;
  let simulatedSeconds = 0;

  if (next.mode === "exam") {
    simulatedSeconds = Math.floor(next.idleRealSeconds) - Math.floor(previousIdle);
  } else if (next.mode === "practice") {
    const threshold = station.idleDrift.startsAfterRealSeconds;
    const ratio = station.idleDrift.realSecondsPerSimulatedSecond;
    const previousEligible = Math.max(0, previousIdle - threshold);
    const nextEligible = Math.max(0, next.idleRealSeconds - threshold);
    simulatedSeconds = Math.floor(nextEligible / ratio) - Math.floor(previousEligible / ratio);
  } else if (!station.idleDrift.pausedInLearn) {
    const ratio = station.idleDrift.realSecondsPerSimulatedSecond;
    simulatedSeconds = Math.floor(next.idleRealSeconds / ratio) - Math.floor(previousIdle / ratio);
  }

  if (simulatedSeconds <= 0) return next;
  const previousRemaining = next.remainingSeconds;
  next.remainingSeconds = Math.max(0, next.remainingSeconds - simulatedSeconds);
  processClockTransitions(next, station, previousRemaining);
  return next;
}

export function endConsultation(state: OsceState, station: OsceStation): OsceState {
  assertState(state, station);
  assertRoomActive(state);
  const next = cloneState(state);
  endRoom(next, station, "student");
  return next;
}

export function requestNudge(state: OsceState, station: OsceStation): OsceState {
  assertState(state, station);
  assertRoomActive(state);
  if (state.mode === "exam") throw new OsceEngineError("Nudges are unavailable in Exam mode.");
  const nudge = station.nudges[state.nudgesUsed.length];
  if (!nudge) throw new OsceEngineError("All available nudges have already been used.");
  const next = cloneState(state);
  const pointCost = state.mode === "learn" ? 0 : nudge.pointCost;
  next.nudgesUsed.push({
    tier: nudge.tier,
    pointCost,
    text: nudge.text,
    elapsedSecond: elapsedSecond(next, station),
  });
  appendTimeline(next, {
    elapsedSecond: elapsedSecond(next, station),
    type: "nudge",
    title: `Nudge ${nudge.tier}`,
    detail: nudge.text,
  });
  return next;
}

function scoreExaminerQuestion(
  question: ExaminerQuestion,
  selectedOptionIds: readonly string[],
): number {
  const selected = new Set(selectedOptionIds);
  const correct = question.options.filter((option) => option.correct);
  const correctSelected = correct.filter((option) => selected.has(option.id)).length;
  const incorrectSelected = question.options.filter(
    (option) => !option.correct && selected.has(option.id),
  ).length;
  return Math.round(clamp((correctSelected - incorrectSelected) / correct.length, 0, 1) * 100);
}

function isChecklistAwarded(state: OsceState, checklistItemId: string): boolean {
  return (
    Boolean(state.checklistAchievements[checklistItemId]) &&
    !state.checklistPenalties.some((penalty) => penalty.checklistItemId === checklistItemId)
  );
}

function checklistDomainScores(
  state: OsceState,
  station: OsceStation,
): Record<ChecklistDomain, number> {
  return Object.fromEntries(
    DOMAINS.map((domain) => {
      const items = station.checklist.filter((item) => item.domain === domain);
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      const earned = items.reduce(
        (sum, item) => sum + (isChecklistAwarded(state, item.id) ? item.weight : 0),
        0,
      );
      return [domain, total ? Math.round((earned / total) * 100) : 100];
    }),
  ) as Record<ChecklistDomain, number>;
}

function ratingFromScore(score: number, station: OsceStation): GlobalRating {
  const thresholds = station.ratingThresholds;
  if (score >= thresholds.excellent) return "excellent";
  if (score >= thresholds.good) return "good";
  if (score >= thresholds.pass) return "pass";
  if (score >= thresholds.borderline) return "borderline";
  return "clear_fail";
}

function capAtBorderline(rating: GlobalRating): GlobalRating {
  return rating === "excellent" || rating === "good" || rating === "pass" ? "borderline" : rating;
}

export function calculateOsceResult(state: OsceState, station: OsceStation): OsceResult {
  assertState(state, station);
  const checklistTotalWeight = station.checklist.reduce((sum, item) => sum + item.weight, 0);
  const checklistEarnedWeight = station.checklist.reduce(
    (sum, item) => sum + (isChecklistAwarded(state, item.id) ? item.weight : 0),
    0,
  );
  const checklist = Math.round((checklistEarnedWeight / checklistTotalWeight) * 100);
  const domainScores = checklistDomainScores(state, station);
  const rapport = state.rapport;
  const communication = Math.round(domainScores.communication * 0.65 + rapport * 0.35);

  const keyItems = station.checklist.filter(
    (item) => item.criticalFailIfMissing || item.weight >= 4,
  );
  const keyCompletion = keyItems.length
    ? (keyItems.filter((item) => isChecklistAwarded(state, item.id)).length / keyItems.length) * 100
    : 100;
  const wastedSeconds = state.completedActions
    .filter((action) => action.wasPoorTechnique)
    .reduce((sum, action) => sum + action.timeCostSec, 0);
  const efficiency = clamp(100 - (wastedSeconds / station.clockSeconds) * 200, 0, 100);
  const timeManagement = Math.round(keyCompletion * 0.7 + efficiency * 0.3);

  const examinerQuestions = station.examinerQuestions.length
    ? Math.round(
        station.examinerQuestions.reduce(
          (sum, question) =>
            sum +
            (state.examinerAnswers.find((answer) => answer.questionId === question.id)
              ?.scorePercent ?? 0),
          0,
        ) / station.examinerQuestions.length,
      )
    : 100;
  const nudgePenalty = state.nudgesUsed.reduce((sum, nudge) => sum + nudge.pointCost, 0);
  const weights = station.ratingThresholds.componentWeights;
  const composite = Math.round(
    clamp(
      checklist * weights.checklist +
        communication * weights.communication +
        timeManagement * weights.timeManagement +
        examinerQuestions * weights.examinerQuestions -
        nudgePenalty,
      0,
      100,
    ),
  );
  const uncappedRating = ratingFromScore(composite, station);

  let rating = uncappedRating;
  let ratingReason =
    "The rating reflects checklist coverage, communication, time use and examiner questions.";
  if (state.criticalFailIds.length) {
    rating = "clear_fail";
    ratingReason = "A critical fail caps the global rating at Clear Fail.";
  } else {
    const caps = station.ratingThresholds.communicationCaps;
    if (
      rapport < caps.borderlineIfRapportBelow ||
      communication < caps.borderlineIfCommunicationBelow
    ) {
      const capped = capAtBorderline(rating);
      if (capped !== rating) {
        rating = capped;
        ratingReason =
          "Poor rapport or communication capped an otherwise higher score at Borderline.";
      }
    }
  }

  return {
    rating,
    uncappedRating,
    ratingReason,
    criticalFailIds: [...state.criticalFailIds],
    score: {
      checklist,
      communication,
      rapport,
      timeManagement,
      examinerQuestions,
      nudgePenalty,
      composite,
      checklistEarnedWeight,
      checklistTotalWeight,
      wastedSeconds,
      domainScores,
    },
  };
}

export function answerExaminerQuestion(
  state: OsceState,
  station: OsceStation,
  questionId: string,
  selectedOptionIds: string[],
): OsceState {
  assertState(state, station);
  if (state.phase !== "examiner_questions" || state.status !== "active") {
    throw new OsceEngineError("Examiner questions are not currently active.");
  }
  if (state.examinerAnswers.some((answer) => answer.questionId === questionId)) {
    throw new OsceEngineError("This examiner question has already been answered.");
  }
  const question = station.examinerQuestions.find((entry) => entry.id === questionId);
  if (!question) throw new OsceEngineError(`Unknown examiner question: ${questionId}.`);
  const uniqueSelections = [...new Set(selectedOptionIds)];
  if (!uniqueSelections.length) throw new OsceEngineError("Select at least one answer option.");
  if (question.type === "single" && uniqueSelections.length !== 1) {
    throw new OsceEngineError("This examiner question accepts one answer.");
  }
  const optionIds = new Set(question.options.map((option) => option.id));
  if (uniqueSelections.some((id) => !optionIds.has(id))) {
    throw new OsceEngineError("The answer includes an unknown option.");
  }

  const next = cloneState(state);
  const scorePercent = scoreExaminerQuestion(question, uniqueSelections);
  next.examinerAnswers.push({
    questionId,
    selectedOptionIds: uniqueSelections,
    scorePercent,
    answeredAtSecond: elapsedSecond(next, station),
  });
  appendTimeline(next, {
    elapsedSecond: elapsedSecond(next, station),
    type: "examiner_answer",
    title: question.prompt,
    detail: `${scorePercent}% for this examiner question.`,
  });

  if (next.examinerAnswers.length === station.examinerQuestions.length) {
    next.phase = "debrief";
    next.status = "complete";
    next.finalResult = calculateOsceResult(next, station);
    appendTimeline(next, {
      elapsedSecond: elapsedSecond(next, station),
      type: "result",
      title: "Global rating",
      detail: next.finalResult.rating,
    });
  }
  return next;
}

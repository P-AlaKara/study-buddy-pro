import type {
  CaseAction,
  ClueTier,
  MedicalCase,
  PatientExpression,
  VitalsDelta,
} from "./schema.js";
import { DR_AMBROSE } from "./config.js";

export type GamePhase = "hook" | "investigate" | "commit" | "debrief";
export type GameStatus = "active" | "complete";
export type CaseOutcome = "diagnosed" | "missed" | "patient_lost";
export type EvidenceRelationship = "supports" | "against";

export interface RuntimeVitals {
  hr: number;
  systolicBp: number;
  diastolicBp: number;
  rr: number;
  spo2: number;
  temp: number;
}

export type TimelineEventType =
  | "hook"
  | "case_started"
  | "action"
  | "clue"
  | "deterioration"
  | "warning"
  | "hint"
  | "differential"
  | "commit"
  | "outcome";

export interface TimelineEvent {
  id: string;
  timeMinute: number;
  type: TimelineEventType;
  title: string;
  detail: string;
  actionId?: string;
  diagnosisId?: string;
  clueTier?: ClueTier;
  isKeyClue?: boolean;
  eventKey?: string;
}

export interface EvidenceRecord {
  actionId: string;
  label: string;
  result: string;
  discoveredAtMinute: number;
  clueTier: ClueTier;
  isKeyClue: boolean;
  supports: string[];
  against: string[];
}

export interface EvidenceTag {
  evidenceActionId: string;
  relationship: EvidenceRelationship;
  taggedAtMinute: number;
}

export interface DifferentialEntry {
  diagnosisId: string;
  rank: number;
  confidence: number;
  evidenceTags: EvidenceTag[];
}

export type DifferentialChangeType = "add" | "remove" | "rank" | "confidence" | "tag";

export interface DifferentialChange {
  id: string;
  timeMinute: number;
  type: DifferentialChangeType;
  diagnosisId?: string;
  detail: string;
  snapshot: Array<{ diagnosisId: string; rank: number; confidence: number }>;
}

export interface CompletedAction {
  actionId: string;
  startedAtMinute: number;
  completedAtMinute: number;
  safetyGateMet: boolean;
}

export interface HintUse {
  tier: 1 | 2 | 3;
  cost: number;
  text: string;
  usedAtMinute: number;
}

export interface ScoreBreakdown {
  base: number;
  time: number;
  unnecessaryTests: number;
  hints: number;
  harmfulActions: number;
  earlyKeyClue: number;
  diagnosis: number;
  treatment: number;
  total: number;
  maximum: number;
}

export interface GameState {
  version: 1;
  caseId: string;
  phase: GamePhase;
  status: GameStatus;
  outcome: CaseOutcome | null;
  outcomeReason: string;
  timeMinute: number;
  moneySpent: number;
  vitals: RuntimeVitals;
  patientExpression: PatientExpression;
  completedActions: CompletedAction[];
  appliedDeteriorationRuleIds: string[];
  triggeredEventIds: string[];
  discoveredEvidence: EvidenceRecord[];
  differential: DifferentialEntry[];
  differentialHistory: DifferentialChange[];
  hintsUsed: HintUse[];
  harmfulActionIds: string[];
  unnecessaryActionIds: string[];
  latestActionId: string | null;
  committedDiagnosisId: string | null;
  committedTreatmentIds: string[];
  timeline: TimelineEvent[];
  score: ScoreBreakdown;
  sequence: number;
}

export interface CommitSelection {
  diagnosisId: string;
  treatmentIds: string[];
}

export interface CommitReadiness {
  ready: boolean;
  hasInvestigation: boolean;
  hasDifferential: boolean;
}

export interface DebriefModel {
  outcome: CaseOutcome;
  outcomeReason: string;
  correctDiagnosis: string;
  committedDiagnosis: string | null;
  foundKeyClues: EvidenceRecord[];
  missedKeyClues: Array<{ actionId: string; label: string }>;
  harmfulActions: Array<{ actionId: string; label: string; explanation: string }>;
  whyNotTempting: string;
  teachingPoints: [string, string, string];
  score: ScoreBreakdown;
  timeline: TimelineEvent[];
  mockComparisonPercent: number;
}

export class CaseEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseEngineError";
  }
}

function parseBloodPressure(bp: string): { systolicBp: number; diastolicBp: number } {
  const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match?.[1] || !match[2]) {
    throw new CaseEngineError(`Invalid blood pressure value: ${bp}`);
  }
  return { systolicBp: Number(match[1]), diastolicBp: Number(match[2]) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function applyVitalsDelta(vitals: RuntimeVitals, delta: VitalsDelta): RuntimeVitals {
  return {
    hr: Math.round(clamp(vitals.hr + (delta.hr ?? 0), 0, 260)),
    systolicBp: Math.round(clamp(vitals.systolicBp + (delta.systolicBp ?? 0), 30, 280)),
    diastolicBp: Math.round(clamp(vitals.diastolicBp + (delta.diastolicBp ?? 0), 15, 180)),
    rr: Math.round(clamp(vitals.rr + (delta.rr ?? 0), 0, 70)),
    spo2: Math.round(clamp(vitals.spo2 + (delta.spo2 ?? 0), 0, 100)),
    temp: Math.round(clamp(vitals.temp + (delta.temp ?? 0), 25, 45) * 10) / 10,
  };
}

function assertCase(state: GameState, caseDefinition: MedicalCase): void {
  if (state.caseId !== caseDefinition.id) {
    throw new CaseEngineError("The game state belongs to a different case.");
  }
}

function assertActiveInvestigation(state: GameState): void {
  if (state.status !== "active" || state.phase !== "investigate") {
    throw new CaseEngineError("This action is only available during the investigation.");
  }
}

function eventWithId(sequence: number, event: Omit<TimelineEvent, "id">): TimelineEvent {
  return { ...event, id: `event_${sequence}` };
}

function determineExpression(
  caseDefinition: MedicalCase,
  state: Pick<GameState, "outcome" | "vitals">,
): PatientExpression {
  if (state.outcome === "patient_lost") return "drowsy";
  if (state.outcome === "diagnosed") return "relieved";
  if (state.vitals.spo2 <= 88 || state.vitals.rr >= 30) return "struggling_to_breathe";
  if (state.vitals.systolicBp <= 90) return "drowsy";
  if (state.vitals.hr >= 125) return "anxious";
  return caseDefinition.patient.initialExpression;
}

function completedIds(state: GameState): Set<string> {
  return new Set(state.completedActions.map((entry) => entry.actionId));
}

function safetyGateMet(action: CaseAction, completed: ReadonlySet<string>): boolean {
  const gate = action.safeWhen;
  if (!gate) return true;

  const allSatisfied = (gate.allActionIds ?? []).every((id) => completed.has(id));
  const hasAlternativeGate =
    Boolean(gate.anyActionIds?.length) || Boolean(gate.supportingActionThreshold);
  const anySatisfied = (gate.anyActionIds ?? []).some((id) => completed.has(id));
  const threshold = gate.supportingActionThreshold;
  const thresholdSatisfied = threshold
    ? threshold.actionIds.filter((id) => completed.has(id)).length >= threshold.minimumCompleted
    : false;

  return allSatisfied && (!hasAlternativeGate || anySatisfied || thresholdSatisfied);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function normaliseScore(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function calculateScore(state: GameState, caseDefinition: MedicalCase): ScoreBreakdown {
  assertCase(state, caseDefinition);
  const { scoring } = caseDefinition;
  const time = normaliseScore(
    Math.max(0, state.timeMinute - scoring.perMinutePenaltyAfter) * scoring.perMinutePenalty,
  );
  const unnecessaryTests = normaliseScore(
    state.unnecessaryActionIds.length * scoring.perUnnecessaryTest,
  );
  const hints = normaliseScore(-state.hintsUsed.reduce((sum, hint) => sum + hint.cost, 0));
  const harmfulActions = normaliseScore(state.harmfulActionIds.length * scoring.perHarmfulAction);
  const earlyKeyClue = state.discoveredEvidence.some(
    (evidence) =>
      evidence.isKeyClue && evidence.discoveredAtMinute <= scoring.earlyClueCutoffMinute,
  )
    ? scoring.bonusKeyClueFoundEarly
    : 0;
  const diagnosis =
    state.committedDiagnosisId && state.committedDiagnosisId !== caseDefinition.solution.diagnosisId
      ? scoring.incorrectDiagnosisPenalty
      : 0;
  const selectedTreatments = new Set([
    ...state.completedActions.map((entry) => entry.actionId),
    ...state.committedTreatmentIds,
  ]);
  const missedTreatmentCount = state.committedDiagnosisId
    ? caseDefinition.solution.keyTreatment.filter((id) => !selectedTreatments.has(id)).length
    : 0;
  const treatment = normaliseScore(missedTreatmentCount * scoring.perMissedKeyTreatment);
  const maximum = scoring.base + scoring.bonusKeyClueFoundEarly;
  const total = clamp(
    scoring.base +
      time +
      unnecessaryTests +
      hints +
      harmfulActions +
      earlyKeyClue +
      diagnosis +
      treatment,
    0,
    maximum,
  );

  return {
    base: scoring.base,
    time,
    unnecessaryTests,
    hints,
    harmfulActions,
    earlyKeyClue,
    diagnosis,
    treatment,
    total,
    maximum,
  };
}

function withDerivedState(state: GameState, caseDefinition: MedicalCase): GameState {
  const patientExpression = determineExpression(caseDefinition, state);
  const next = { ...state, patientExpression };
  return { ...next, score: calculateScore(next, caseDefinition) };
}

export function createInitialState(caseDefinition: MedicalCase): GameState {
  const firstVitals = caseDefinition.vitalsTimeline[0];
  if (!firstVitals) throw new CaseEngineError("A case needs initial vital signs.");
  const bp = parseBloodPressure(firstVitals.bp);
  const initial: GameState = {
    version: 1,
    caseId: caseDefinition.id,
    phase: "hook",
    status: "active",
    outcome: null,
    outcomeReason: "",
    timeMinute: firstVitals.tMinute,
    moneySpent: 0,
    vitals: {
      hr: firstVitals.hr,
      ...bp,
      rr: firstVitals.rr,
      spo2: firstVitals.spo2,
      temp: firstVitals.temp,
    },
    patientExpression: caseDefinition.patient.initialExpression,
    completedActions: [],
    appliedDeteriorationRuleIds: [],
    triggeredEventIds: [],
    discoveredEvidence: [],
    differential: [],
    differentialHistory: [],
    hintsUsed: [],
    harmfulActionIds: [],
    unnecessaryActionIds: [],
    latestActionId: null,
    committedDiagnosisId: null,
    committedTreatmentIds: [],
    timeline: [
      eventWithId(1, {
        timeMinute: firstVitals.tMinute,
        type: "hook",
        title: caseDefinition.setting,
        detail: caseDefinition.intro,
      }),
    ],
    score: {
      base: caseDefinition.scoring.base,
      time: 0,
      unnecessaryTests: 0,
      hints: 0,
      harmfulActions: 0,
      earlyKeyClue: 0,
      diagnosis: 0,
      treatment: 0,
      total: caseDefinition.scoring.base,
      maximum: caseDefinition.scoring.base + caseDefinition.scoring.bonusKeyClueFoundEarly,
    },
    sequence: 1,
  };
  return withDerivedState(initial, caseDefinition);
}

export function beginCase(state: GameState, caseDefinition: MedicalCase): GameState {
  assertCase(state, caseDefinition);
  if (state.phase !== "hook" || state.status !== "active") {
    throw new CaseEngineError("The case has already started.");
  }
  const sequence = state.sequence + 1;
  return withDerivedState(
    {
      ...state,
      phase: "investigate",
      sequence,
      timeline: [
        ...state.timeline,
        eventWithId(sequence, {
          timeMinute: state.timeMinute,
          type: "case_started",
          title: "What's your first move?",
          detail: "The case clock is running.",
        }),
      ],
    },
    caseDefinition,
  );
}

interface TimeAdvanceResult {
  state: GameState;
  interrupted: boolean;
}

function advanceTimeInternal(
  state: GameState,
  caseDefinition: MedicalCase,
  targetMinute: number,
  completingActionId?: string,
): TimeAdvanceResult {
  if (targetMinute < state.timeMinute) {
    throw new CaseEngineError("Case time cannot move backwards.");
  }

  const completed = completedIds(state);
  const alreadyApplied = new Set(state.appliedDeteriorationRuleIds);
  const dueRules = caseDefinition.deteriorationRules
    .filter((rule) => {
      if (alreadyApplied.has(rule.id) || completed.has(rule.action)) return false;
      if (rule.ifNotDoneBy > targetMinute) return false;
      return !(completingActionId === rule.action && targetMinute <= rule.ifNotDoneBy);
    })
    .sort((a, b) => a.ifNotDoneBy - b.ifNotDoneBy);

  const lossCandidates = caseDefinition.deteriorationRules
    .filter((rule) => {
      if (rule.lossAtMinute === undefined || rule.lossAtMinute > targetMinute) return false;
      if (completed.has(rule.action)) return false;
      return !(completingActionId === rule.action && targetMinute <= rule.lossAtMinute);
    })
    .sort((a, b) => (a.lossAtMinute ?? Infinity) - (b.lossAtMinute ?? Infinity));
  const firstLoss = lossCandidates[0];
  const lossMinute = firstLoss?.lossAtMinute;

  let vitals = state.vitals;
  let sequence = state.sequence;
  const timeline = [...state.timeline];
  const appliedDeteriorationRuleIds = [...state.appliedDeteriorationRuleIds];
  const triggeredEventIds = [...state.triggeredEventIds];

  for (const rule of dueRules) {
    if (lossMinute !== undefined && rule.ifNotDoneBy > lossMinute) continue;
    vitals = applyVitalsDelta(vitals, rule.effect);
    appliedDeteriorationRuleIds.push(rule.id);
    if (rule.triggersEvent) triggeredEventIds.push(rule.triggersEvent);
    sequence += 1;
    timeline.push(
      eventWithId(sequence, {
        timeMinute: rule.ifNotDoneBy,
        type: "deterioration",
        title: rule.source === "monitor" ? "Monitor alert" : `${rule.source} alert`,
        detail: rule.alertLine,
        actionId: rule.action,
        ...(rule.triggersEvent ? { eventKey: rule.triggersEvent } : {}),
      }),
    );
  }

  if (firstLoss && lossMinute !== undefined) {
    sequence += 1;
    const lostState: GameState = {
      ...state,
      phase: "debrief",
      status: "complete",
      outcome: "patient_lost",
      outcomeReason: `The critical action “${
        caseDefinition.actions.find((action) => action.id === firstLoss.action)?.label ??
        firstLoss.action
      }” was not completed in time.`,
      timeMinute: lossMinute,
      vitals,
      appliedDeteriorationRuleIds: unique(appliedDeteriorationRuleIds),
      triggeredEventIds: unique(triggeredEventIds),
      sequence,
      timeline: [
        ...timeline,
        eventWithId(sequence, {
          timeMinute: lossMinute,
          type: "outcome",
          title: "Patient lost",
          detail:
            "The patient deteriorated to cardiovascular collapse before treatment was completed.",
          actionId: firstLoss.action,
        }),
      ],
    };
    return { state: withDerivedState(lostState, caseDefinition), interrupted: true };
  }

  return {
    state: withDerivedState(
      {
        ...state,
        timeMinute: targetMinute,
        vitals,
        appliedDeteriorationRuleIds: unique(appliedDeteriorationRuleIds),
        triggeredEventIds: unique(triggeredEventIds),
        sequence,
        timeline,
      },
      caseDefinition,
    ),
    interrupted: false,
  };
}

export function elapseTime(
  state: GameState,
  caseDefinition: MedicalCase,
  minutes: number,
  reason = "Clinical delay",
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new CaseEngineError("Elapsed time must be a positive number of minutes.");
  }
  const advanced = advanceTimeInternal(state, caseDefinition, state.timeMinute + minutes);
  if (advanced.interrupted) return advanced.state;
  const sequence = advanced.state.sequence + 1;
  return withDerivedState(
    {
      ...advanced.state,
      sequence,
      timeline: [
        ...advanced.state.timeline,
        eventWithId(sequence, {
          timeMinute: advanced.state.timeMinute,
          type: "warning",
          title: reason,
          detail: `${minutes} case minute${minutes === 1 ? "" : "s"} elapsed without a clinical action.`,
        }),
      ],
    },
    caseDefinition,
  );
}

export function applyAction(
  state: GameState,
  caseDefinition: MedicalCase,
  actionId: string,
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  const action = caseDefinition.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new CaseEngineError(`Unknown action: ${actionId}`);
  if (state.completedActions.some((entry) => entry.actionId === actionId)) {
    throw new CaseEngineError("An action cannot be completed twice.");
  }

  const startedAtMinute = state.timeMinute;
  const completedAtMinute = startedAtMinute + action.timeCostMin;
  const completedBeforeAction = completedIds(state);
  const gateMet = safetyGateMet(action, completedBeforeAction);
  const advanced = advanceTimeInternal(state, caseDefinition, completedAtMinute, action.id);
  if (advanced.interrupted) {
    const sequence = advanced.state.sequence + 1;
    return withDerivedState(
      {
        ...advanced.state,
        moneySpent: advanced.state.moneySpent + action.moneyCost,
        sequence,
        timeline: [
          ...advanced.state.timeline,
          eventWithId(sequence, {
            timeMinute: advanced.state.timeMinute,
            type: "warning",
            title: `${action.label} was interrupted`,
            detail: "The patient crashed before this action could be completed.",
            actionId: action.id,
          }),
        ],
      },
      caseDefinition,
    );
  }

  let sequence = advanced.state.sequence + 1;
  const timeline = [
    ...advanced.state.timeline,
    eventWithId(sequence, {
      timeMinute: completedAtMinute,
      type: "action" as const,
      title: action.label,
      detail: action.result.content,
      actionId: action.id,
      clueTier: action.clueTier,
      isKeyClue: action.isKeyClue ?? false,
      ...(action.triggersEvent ? { eventKey: action.triggersEvent } : {}),
    }),
  ];

  if (action.safeWhen && !gateMet) {
    sequence += 1;
    timeline.push(
      eventWithId(sequence, {
        timeMinute: completedAtMinute,
        type: "warning",
        title: "Safety condition not met",
        detail: action.safeWhen.explanation,
        actionId: action.id,
      }),
    );
  }

  const isEvidence = action.clueTier !== "none";
  const discoveredEvidence = isEvidence
    ? [
        ...advanced.state.discoveredEvidence,
        {
          actionId: action.id,
          label: action.label,
          result: action.result.content,
          discoveredAtMinute: completedAtMinute,
          clueTier: action.clueTier,
          isKeyClue: action.isKeyClue ?? false,
          supports: [...action.supports],
          against: [...action.against],
        },
      ]
    : advanced.state.discoveredEvidence;

  if (isEvidence) {
    sequence += 1;
    timeline.push(
      eventWithId(sequence, {
        timeMinute: completedAtMinute,
        type: "clue",
        title: action.isKeyClue ? "Key clue discovered" : "Evidence discovered",
        detail: action.result.content,
        actionId: action.id,
        clueTier: action.clueTier,
        isKeyClue: action.isKeyClue ?? false,
      }),
    );
  }

  const countsAsHarmful = Boolean(action.harmful || (action.penalizeWhenUnsafe && !gateMet));
  const nextBase: GameState = {
    ...advanced.state,
    moneySpent: advanced.state.moneySpent + action.moneyCost,
    vitals: action.vitalsEffect
      ? applyVitalsDelta(advanced.state.vitals, action.vitalsEffect)
      : advanced.state.vitals,
    completedActions: [
      ...advanced.state.completedActions,
      { actionId, startedAtMinute, completedAtMinute, safetyGateMet: gateMet },
    ],
    discoveredEvidence,
    triggeredEventIds: action.triggersEvent
      ? unique([...advanced.state.triggeredEventIds, action.triggersEvent])
      : advanced.state.triggeredEventIds,
    harmfulActionIds: countsAsHarmful
      ? unique([...advanced.state.harmfulActionIds, action.id])
      : advanced.state.harmfulActionIds,
    unnecessaryActionIds: action.isUnnecessary
      ? unique([...advanced.state.unnecessaryActionIds, action.id])
      : advanced.state.unnecessaryActionIds,
    latestActionId: action.id,
    sequence,
    timeline,
  };

  if (action.immediateFailure) {
    const outcomeSequence = nextBase.sequence + 1;
    return withDerivedState(
      {
        ...nextBase,
        phase: "debrief",
        status: "complete",
        outcome: "patient_lost",
        outcomeReason: action.result.content,
        sequence: outcomeSequence,
        timeline: [
          ...nextBase.timeline,
          eventWithId(outcomeSequence, {
            timeMinute: completedAtMinute,
            type: "outcome",
            title: "Patient lost",
            detail: action.result.content,
            actionId: action.id,
          }),
        ],
      },
      caseDefinition,
    );
  }

  return withDerivedState(nextBase, caseDefinition);
}

function differentialSnapshot(
  differential: readonly DifferentialEntry[],
): Array<{ diagnosisId: string; rank: number; confidence: number }> {
  return differential
    .map(({ diagnosisId, rank, confidence }) => ({ diagnosisId, rank, confidence }))
    .sort((a, b) => a.rank - b.rank);
}

function finishDifferentialChange(
  state: GameState,
  caseDefinition: MedicalCase,
  differential: DifferentialEntry[],
  change: Omit<DifferentialChange, "id" | "timeMinute" | "snapshot">,
): GameState {
  let sequence = state.sequence + 1;
  const historyEntry: DifferentialChange = {
    ...change,
    id: `differential_${sequence}`,
    timeMinute: state.timeMinute,
    snapshot: differentialSnapshot(differential),
  };
  sequence += 1;
  return withDerivedState(
    {
      ...state,
      differential,
      differentialHistory: [...state.differentialHistory, historyEntry],
      sequence,
      timeline: [
        ...state.timeline,
        eventWithId(sequence, {
          timeMinute: state.timeMinute,
          type: "differential",
          title: "Differential updated",
          detail: change.detail,
          ...(change.diagnosisId ? { diagnosisId: change.diagnosisId } : {}),
        }),
      ],
    },
    caseDefinition,
  );
}

function assertDiagnosis(caseDefinition: MedicalCase, diagnosisId: string): void {
  if (!caseDefinition.differential.some((diagnosis) => diagnosis.id === diagnosisId)) {
    throw new CaseEngineError(`Unknown diagnosis: ${diagnosisId}`);
  }
}

export function addToDifferential(
  state: GameState,
  caseDefinition: MedicalCase,
  diagnosisId: string,
  confidence = 50,
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  assertDiagnosis(caseDefinition, diagnosisId);
  if (state.differential.some((entry) => entry.diagnosisId === diagnosisId)) {
    throw new CaseEngineError("That diagnosis is already on the differential board.");
  }
  const diagnosis = caseDefinition.differential.find((entry) => entry.id === diagnosisId);
  const differential = [
    ...state.differential,
    {
      diagnosisId,
      rank: state.differential.length + 1,
      confidence: Math.round(clamp(confidence, 0, 100)),
      evidenceTags: [],
    },
  ];
  return finishDifferentialChange(state, caseDefinition, differential, {
    type: "add",
    diagnosisId,
    detail: `${diagnosis?.label ?? diagnosisId} was added.`,
  });
}

export function removeFromDifferential(
  state: GameState,
  caseDefinition: MedicalCase,
  diagnosisId: string,
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  if (!state.differential.some((entry) => entry.diagnosisId === diagnosisId)) {
    throw new CaseEngineError("That diagnosis is not on the differential board.");
  }
  const differential = state.differential
    .filter((entry) => entry.diagnosisId !== diagnosisId)
    .sort((a, b) => a.rank - b.rank)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return finishDifferentialChange(state, caseDefinition, differential, {
    type: "remove",
    diagnosisId,
    detail: `${diagnosisId} was removed.`,
  });
}

export function rankDifferential(
  state: GameState,
  caseDefinition: MedicalCase,
  rankedDiagnosisIds: string[],
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  const current = state.differential.map((entry) => entry.diagnosisId).sort();
  const proposed = unique(rankedDiagnosisIds).sort();
  if (
    current.length !== proposed.length ||
    current.some((diagnosisId, index) => diagnosisId !== proposed[index])
  ) {
    throw new CaseEngineError("A ranking must include every board diagnosis exactly once.");
  }
  const byId = new Map(state.differential.map((entry) => [entry.diagnosisId, entry]));
  const differential = rankedDiagnosisIds.map((diagnosisId, index) => ({
    ...byId.get(diagnosisId)!,
    rank: index + 1,
  }));
  return finishDifferentialChange(state, caseDefinition, differential, {
    type: "rank",
    detail: "The differential was re-ranked.",
  });
}

export function setDifferentialConfidence(
  state: GameState,
  caseDefinition: MedicalCase,
  diagnosisId: string,
  confidence: number,
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  if (!state.differential.some((entry) => entry.diagnosisId === diagnosisId)) {
    throw new CaseEngineError("That diagnosis is not on the differential board.");
  }
  const nextConfidence = Math.round(clamp(confidence, 0, 100));
  const differential = state.differential.map((entry) =>
    entry.diagnosisId === diagnosisId ? { ...entry, confidence: nextConfidence } : entry,
  );
  return finishDifferentialChange(state, caseDefinition, differential, {
    type: "confidence",
    diagnosisId,
    detail: `${diagnosisId} confidence changed to ${nextConfidence}%.`,
  });
}

export function tagEvidence(
  state: GameState,
  caseDefinition: MedicalCase,
  diagnosisId: string,
  evidenceActionId: string,
  relationship: EvidenceRelationship,
): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  if (!state.discoveredEvidence.some((evidence) => evidence.actionId === evidenceActionId)) {
    throw new CaseEngineError("Only discovered evidence can be tagged.");
  }
  if (!state.differential.some((entry) => entry.diagnosisId === diagnosisId)) {
    throw new CaseEngineError("That diagnosis is not on the differential board.");
  }
  const differential = state.differential.map((entry) => {
    if (entry.diagnosisId !== diagnosisId) return entry;
    const tags = entry.evidenceTags.filter((tag) => tag.evidenceActionId !== evidenceActionId);
    return {
      ...entry,
      evidenceTags: [...tags, { evidenceActionId, relationship, taggedAtMinute: state.timeMinute }],
    };
  });
  return finishDifferentialChange(state, caseDefinition, differential, {
    type: "tag",
    diagnosisId,
    detail: `${evidenceActionId} was tagged as ${relationship} ${diagnosisId}.`,
  });
}

export function requestNextHint(state: GameState, caseDefinition: MedicalCase): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  const hint = caseDefinition.hints[state.hintsUsed.length];
  if (!hint) throw new CaseEngineError("All hints have already been used.");
  const sequence = state.sequence + 1;
  return withDerivedState(
    {
      ...state,
      hintsUsed: [...state.hintsUsed, { ...hint, usedAtMinute: state.timeMinute }],
      sequence,
      timeline: [
        ...state.timeline,
        eventWithId(sequence, {
          timeMinute: state.timeMinute,
          type: "hint",
          title: `${DR_AMBROSE.name} hint ${hint.tier}`,
          detail: hint.text,
        }),
      ],
    },
    caseDefinition,
  );
}

export function getCommitReadiness(state: GameState, caseDefinition: MedicalCase): CommitReadiness {
  assertCase(state, caseDefinition);
  const actionById = new Map(caseDefinition.actions.map((action) => [action.id, action]));
  const hasInvestigation = state.completedActions.some(
    (entry) => actionById.get(entry.actionId)?.category === "test",
  );
  const hasDifferential = state.differential.length > 0;
  return { ready: hasInvestigation && hasDifferential, hasInvestigation, hasDifferential };
}

export function openCommit(state: GameState, caseDefinition: MedicalCase): GameState {
  assertCase(state, caseDefinition);
  assertActiveInvestigation(state);
  return withDerivedState({ ...state, phase: "commit" }, caseDefinition);
}

export function cancelCommit(state: GameState, caseDefinition: MedicalCase): GameState {
  assertCase(state, caseDefinition);
  if (state.status !== "active" || state.phase !== "commit") {
    throw new CaseEngineError("There is no open commitment to cancel.");
  }
  return withDerivedState({ ...state, phase: "investigate" }, caseDefinition);
}

export function commitCase(
  state: GameState,
  caseDefinition: MedicalCase,
  selection: CommitSelection,
): GameState {
  assertCase(state, caseDefinition);
  if (state.status !== "active" || state.phase !== "commit") {
    throw new CaseEngineError("Open the commitment step before submitting a diagnosis.");
  }
  assertDiagnosis(caseDefinition, selection.diagnosisId);
  const actionById = new Map(caseDefinition.actions.map((action) => [action.id, action]));
  const treatmentIds = unique(selection.treatmentIds);
  for (const treatmentId of treatmentIds) {
    const action = actionById.get(treatmentId);
    if (!action || action.category !== "treat") {
      throw new CaseEngineError(`Unknown treatment plan action: ${treatmentId}`);
    }
  }

  const selectedHarmful = treatmentIds.filter((id) => actionById.get(id)?.harmful);
  const selectedImmediateFailure = selectedHarmful.find(
    (id) => actionById.get(id)?.immediateFailure,
  );
  const correctDiagnosis = selection.diagnosisId === caseDefinition.solution.diagnosisId;
  const outcome: CaseOutcome = selectedImmediateFailure
    ? "patient_lost"
    : correctDiagnosis
      ? "diagnosed"
      : "missed";
  const committedDiagnosis = caseDefinition.differential.find(
    (diagnosis) => diagnosis.id === selection.diagnosisId,
  );
  const outcomeReason = selectedImmediateFailure
    ? (actionById.get(selectedImmediateFailure)?.result.content ?? "A harmful plan caused a crash.")
    : correctDiagnosis
      ? `You committed to ${committedDiagnosis?.label ?? selection.diagnosisId}.`
      : `You committed to ${committedDiagnosis?.label ?? selection.diagnosisId}; the diagnosis was ${caseDefinition.solution.diagnosis}.`;

  let sequence = state.sequence + 1;
  const timeline = [
    ...state.timeline,
    eventWithId(sequence, {
      timeMinute: state.timeMinute,
      type: "commit" as const,
      title: `Committed: ${committedDiagnosis?.label ?? selection.diagnosisId}`,
      detail: `${treatmentIds.length} treatment action${treatmentIds.length === 1 ? "" : "s"} selected.`,
      diagnosisId: selection.diagnosisId,
    }),
  ];
  sequence += 1;
  timeline.push(
    eventWithId(sequence, {
      timeMinute: state.timeMinute,
      type: "outcome",
      title:
        outcome === "diagnosed"
          ? "Diagnosis made"
          : outcome === "missed"
            ? "Diagnosis missed"
            : "Patient lost",
      detail: outcomeReason,
      diagnosisId: selection.diagnosisId,
    }),
  );

  return withDerivedState(
    {
      ...state,
      phase: "debrief",
      status: "complete",
      outcome,
      outcomeReason,
      committedDiagnosisId: selection.diagnosisId,
      committedTreatmentIds: treatmentIds,
      harmfulActionIds: unique([...state.harmfulActionIds, ...selectedHarmful]),
      sequence,
      timeline,
    },
    caseDefinition,
  );
}

export function createDebrief(state: GameState, caseDefinition: MedicalCase): DebriefModel {
  assertCase(state, caseDefinition);
  if (state.status !== "complete" || !state.outcome) {
    throw new CaseEngineError("The debrief is available only after the case ends.");
  }
  const foundKeyClues = state.discoveredEvidence.filter((evidence) => evidence.isKeyClue);
  const foundKeyIds = new Set(foundKeyClues.map((evidence) => evidence.actionId));
  const missedKeyClues = caseDefinition.actions
    .filter((action) => action.isKeyClue && !foundKeyIds.has(action.id))
    .map((action) => ({ actionId: action.id, label: action.label }));
  const harmfulActions = state.harmfulActionIds.map((actionId) => {
    const action = caseDefinition.actions.find((candidate) => candidate.id === actionId);
    return {
      actionId,
      label: action?.label ?? actionId,
      explanation:
        caseDefinition.solution.harmfulActionDebrief[actionId] ??
        action?.safeWhen?.explanation ??
        "This action added avoidable risk.",
    };
  });
  const committedDiagnosis = caseDefinition.differential.find(
    (diagnosis) => diagnosis.id === state.committedDiagnosisId,
  );

  return {
    outcome: state.outcome,
    outcomeReason: state.outcomeReason,
    correctDiagnosis: caseDefinition.solution.diagnosis,
    committedDiagnosis: committedDiagnosis?.label ?? null,
    foundKeyClues,
    missedKeyClues,
    harmfulActions,
    whyNotTempting: caseDefinition.solution.whyNotTempting,
    teachingPoints: caseDefinition.solution.teachingPoints,
    score: state.score,
    timeline: [...state.timeline].sort(
      (a, b) => a.timeMinute - b.timeMinute || Number(a.id.slice(6)) - Number(b.id.slice(6)),
    ),
    mockComparisonPercent: caseDefinition.mockComparisonPercent,
  };
}

export function formatCaseClock(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(
    safeMinutes % 60,
  ).padStart(2, "0")}`;
}

export function formatBloodPressure(vitals: RuntimeVitals): string {
  return `${vitals.systolicBp}/${vitals.diastolicBp}`;
}

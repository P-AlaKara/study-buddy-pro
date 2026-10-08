import type {
  ChecklistDomain,
  ExaminerAnswer,
  OsceState,
  OsceTimelineEvent,
  RapportPoint,
} from "./engine.js";
import type {
  ExaminerQuestion,
  ModelRunStep,
  OsceChecklistItem,
  OsceCue,
  OsceStation,
} from "./schema.js";

export const CHECKLIST_DOMAINS: readonly ChecklistDomain[] = [
  "opening_and_consent",
  "history_content",
  "risk_and_red_flags",
  "ice",
  "communication",
  "closing_and_safety",
];

export const CHECKLIST_DOMAIN_LABELS: Record<ChecklistDomain, string> = {
  opening_and_consent: "Opening and consent",
  history_content: "History content",
  risk_and_red_flags: "Risk and red flags",
  ice: "Ideas, concerns and expectations",
  communication: "Communication",
  closing_and_safety: "Closing and safety",
};

export type ChecklistReviewStatus = "found" | "missed" | "penalised";

export interface ChecklistReviewItem {
  item: OsceChecklistItem;
  status: ChecklistReviewStatus;
  achievedAtSecond: number | null;
  penalisedAtSecond: number | null;
  cardId: string | null;
}

export interface ChecklistDomainReview {
  domain: ChecklistDomain;
  label: string;
  score: number;
  foundCount: number;
  items: ChecklistReviewItem[];
}

export interface CueReview {
  cue: OsceCue;
  status: "not_triggered" | "picked" | "missed" | "active";
  triggeredAtSecond: number | null;
  resolvedAtSecond: number | null;
  idealResponseLabel: string;
}

export interface TimelineReview extends OsceTimelineEvent {
  wastedSeconds: number;
}

export interface ExaminerQuestionReview {
  question: ExaminerQuestion;
  answer: ExaminerAnswer | null;
  selectedLabels: string[];
  correctLabels: string[];
}

export interface ModelRunReview extends ModelRunStep {
  label: string;
  chosenAtAction: number | null;
}

export interface OsceDebrief {
  checklistDomains: ChecklistDomainReview[];
  timeline: TimelineReview[];
  cues: CueReview[];
  triggeredCueCount: number;
  pickedCueCount: number;
  rapportHistory: RapportPoint[];
  coachingLines: string[];
  examinerQuestions: ExaminerQuestionReview[];
  modelRun: ModelRunReview[];
}

function checklistReview(state: OsceState, item: OsceChecklistItem): ChecklistReviewItem {
  const achievement = state.checklistAchievements[item.id];
  const penalty = state.checklistPenalties.find((entry) => entry.checklistItemId === item.id);
  return {
    item,
    status: penalty ? "penalised" : achievement ? "found" : "missed",
    achievedAtSecond: achievement?.elapsedSecond ?? null,
    penalisedAtSecond: penalty?.elapsedSecond ?? null,
    cardId: achievement?.cardId ?? penalty?.cardId ?? null,
  };
}

function coachingLines(items: ChecklistReviewItem[]): string[] {
  return items
    .filter((entry) => entry.status !== "found")
    .sort((left, right) => {
      const leftPriority =
        (left.status === "penalised" ? 20 : 0) +
        (left.item.criticalFailIfMissing ? 10 : 0) +
        left.item.weight;
      const rightPriority =
        (right.status === "penalised" ? 20 : 0) +
        (right.item.criticalFailIfMissing ? 10 : 0) +
        right.item.weight;
      return rightPriority - leftPriority;
    })
    .map((entry) => entry.item.coachingLine)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 3);
}

export function createOsceDebrief(state: OsceState, station: OsceStation): OsceDebrief {
  if (!state.finalResult) throw new Error("The OSCE debrief is only available after scoring.");

  const allChecklistItems = station.checklist.map((item) => checklistReview(state, item));
  const checklistDomains = CHECKLIST_DOMAINS.map((domain) => {
    const items = allChecklistItems.filter((entry) => entry.item.domain === domain);
    return {
      domain,
      label: CHECKLIST_DOMAIN_LABELS[domain],
      score: state.finalResult!.score.domainScores[domain],
      foundCount: items.filter((entry) => entry.status === "found").length,
      items,
    };
  });

  const cues = station.cues.map((cue): CueReview => {
    const runtime = state.cueStates.find((entry) => entry.cueId === cue.id);
    return {
      cue,
      status: runtime?.status ?? "not_triggered",
      triggeredAtSecond: runtime?.triggeredAtSecond ?? null,
      resolvedAtSecond: runtime?.resolvedAtSecond ?? null,
      idealResponseLabel:
        station.cards.find((card) => card.id === cue.idealResponseCardId)?.label ??
        cue.idealResponseCardId,
    };
  });

  const timeline = state.timeline.map((event): TimelineReview => {
    const action = event.cardId
      ? state.completedActions.find(
          (entry) =>
            entry.cardId === event.cardId && entry.completedAtSecond === event.elapsedSecond,
        )
      : undefined;
    return {
      ...event,
      wastedSeconds: action?.wasPoorTechnique ? action.timeCostSec : 0,
    };
  });

  const examinerQuestions = station.examinerQuestions.map((question) => {
    const answer = state.examinerAnswers.find((entry) => entry.questionId === question.id) ?? null;
    const selected = new Set(answer?.selectedOptionIds ?? []);
    return {
      question,
      answer,
      selectedLabels: question.options
        .filter((option) => selected.has(option.id))
        .map((option) => option.text),
      correctLabels: question.options
        .filter((option) => option.correct)
        .map((option) => option.text),
    };
  });

  return {
    checklistDomains,
    timeline,
    cues,
    triggeredCueCount: cues.filter((cue) => cue.status !== "not_triggered").length,
    pickedCueCount: cues.filter((cue) => cue.status === "picked").length,
    rapportHistory: state.rapportHistory,
    coachingLines: coachingLines(allChecklistItems),
    examinerQuestions,
    modelRun: station.modelRun.map((step) => ({
      ...step,
      label: station.cards.find((card) => card.id === step.cardId)?.label ?? step.cardId,
      chosenAtAction:
        state.completedActions.find((action) => action.cardId === step.cardId)?.actionNumber ??
        null,
    })),
  };
}

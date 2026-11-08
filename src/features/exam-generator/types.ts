// Shared, client-safe types for the Exam Generator. No server-only imports here
// so routes and components can import freely.

export type ExamStatus = "generating" | "ready" | "partial" | "failed";
export type ObjectiveStatus = "pending" | "covered" | "partial" | "unassessable";
export type QuestionType = "mcq" | "short" | "long";
export type AttemptStatus = "in_progress" | "submitted";
export type JobStage =
  "extracting" | "mapping" | "generating" | "auditing" | "done" | "failed" | "cancelled";

export type DocumentKind = "pdf" | "pptx";

export interface SourceDocumentMeta {
  name: string;
  kind: DocumentKind;
  unitCount: number;
}

export interface ExamOption {
  id: string; // "A", "B", ...
  text: string;
}

export interface RubricPoint {
  point: string;
  marks: number;
}

export interface CoverageTopic {
  topic: string;
  total: number;
  covered: number;
  percent: number;
}

export interface CoverageSummary {
  topics: CoverageTopic[];
  typeDistribution: { mcq: number; short: number; long: number };
  objectives: { total: number; covered: number; partial: number; unassessable: number };
  warnings: string[];
}

/** Full question including answer/explanation. Returned only for review. */
export interface ExamQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  options: ExamOption[] | null;
  correctOption: string | null;
  optionExplanations: Record<string, string> | null;
  modelAnswer: string | null;
  explanation: string;
  rubric: RubricPoint[] | null;
  topic: string;
  subtopic: string | null;
  difficulty: number;
  bloom: string | null;
  sourceDocument: string | null;
  sourceRef: string | null;
  position: number;
}

/** Question as presented during the exam — answer fields are withheld. */
export interface TakingQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  options: ExamOption[] | null;
  topic: string;
  subtopic: string | null;
  difficulty: number;
  sourceDocument: string | null;
  sourceRef: string | null;
  position: number;
}

export interface ExamAnswer {
  questionId: string;
  selectedOption: string | null;
  responseText: string | null;
  isCorrect: boolean | null;
  aiVerdict: string | null;
  aiFeedback: string | null;
  flagged: boolean;
}

export interface ExamListItem {
  id: string;
  title: string;
  status: ExamStatus;
  questionCount: number;
  createdAt: string;
  completedAt: string | null;
  sourceDocuments: SourceDocumentMeta[];
  /** Student-directed focus for this exam; null = a general exam. */
  focusAreas: string | null;
  attempt: {
    status: AttemptStatus;
    answered: number;
    total: number;
    score: number | null;
  } | null;
}

export interface ExamOverview {
  id: string;
  title: string;
  status: ExamStatus;
  questionCount: number;
  sourceDocuments: SourceDocumentMeta[];
  /** Student-directed focus for this exam; null = a general exam. */
  focusAreas: string | null;
  coverage: CoverageSummary;
  generationError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface GenerationProgress {
  stage: JobStage;
  percent: number;
  message: string;
  filesProcessed: number;
  totalFiles: number;
  unitCount: number;
  objectivesTotal: number;
  objectivesCovered: number;
  questionsGenerated: number;
  topicChips: string[];
  warnings: string[];
}

export interface TopicPerformance {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface ResultsSummary {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  written: number;
  score: number; // percent, graded questions only
  savedFlashcards: number;
  topicPerformance: TopicPerformance[];
  message: string;
}

/** Everything the player needs in one payload. */
export interface AttemptPayload {
  examId: string;
  examTitle: string;
  attemptId: string;
  status: AttemptStatus;
  currentIndex: number;
  questions: TakingQuestion[];
  answers: ExamAnswer[];
  savedQuestionIds: string[];
}

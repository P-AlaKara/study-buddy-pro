export type ReaderTheme = "light" | "dark" | "sepia";
export type AnnotationType = "highlight" | "note" | "bookmark";
export type RecallVerdict = "correct" | "partially_correct" | "incorrect";
export type QuizResult = RecallVerdict | "skipped";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnnieDocument = {
  id: string;
  title: string;
  page_count: number | null;
  status: "processing" | "ready" | "failed";
  processing_error: string | null;
  last_opened_at: string | null;
  last_page: number;
  created_at: string;
};

export type PageText = {
  page: number;
  text: string;
  layout_data: JsonValue;
};

export type QuizCandidate = {
  id: string;
  page: number;
  text: string;
  prompt: string;
  difficulty: number;
  attempts?: Array<{ result: QuizResult; created_at: string }>;
};

export type AnnieAnnotation = {
  id: string;
  document_id: string;
  type: AnnotationType;
  page: number;
  geometry: NormalizedRect[];
  color: string | null;
  content: string | null;
  selected_text: string | null;
  created_at: string;
  updated_at: string;
};

export type ReaderPreferences = {
  theme: ReaderTheme;
};

export type PageOverview = {
  page: number;
  summary: string;
  learningObjectives: string[];
  keyConcepts: string[];
};

export type SelectionSnapshot = {
  page: number;
  text: string;
  geometry: NormalizedRect[];
  anchor: { x: number; y: number };
};

export type ExplanationResult = {
  explanation: string;
  terms: Array<{ term: string; definition: string }>;
  memoryAid: string | null;
};

export type RecallChallenge = {
  id: string;
  page: number;
  prompt: string;
  targetText: string;
};

export type RecallEvaluation = {
  verdict: RecallVerdict;
  feedback: string;
  correctExplanation: string;
};

export type AssistantStatus =
  "idle" | "thinking" | "speaking" | "expanded" | "awaiting_answer" | "feedback";

export type AssistantMessage =
  | { kind: "overview"; overview: PageOverview }
  | { kind: "explanation"; explanation: ExplanationResult; selection: SelectionSnapshot }
  | { kind: "recall"; challenge: RecallChallenge }
  | { kind: "feedback"; evaluation: RecallEvaluation }
  | { kind: "error"; title: string; detail: string };

export type ReaderPayload = {
  document: AnnieDocument;
  fileUrl: string;
  pages: PageText[];
  annotations: AnnieAnnotation[];
  preferences: ReaderPreferences;
  sessionId: string;
};

export type SessionSummary = {
  attempted: number;
  correct: number;
  pagesCovered: number;
  revisit: string[];
  message: string;
};

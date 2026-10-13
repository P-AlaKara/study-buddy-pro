export type AnnieMood = "stern" | "friendly" | "cheeky";
export type AnnieState =
  "idle" | "reading" | "thinking" | "celebrating" | "teasing" | "disappointed";
export type Chattiness = "quiet" | "normal" | "chatty";
export type ReaderTheme = "light" | "dark" | "sepia";
export type AnnotationType = "highlight" | "note" | "bookmark";
export type QuizResult = "correct" | "partially_correct" | "incorrect" | "skipped";
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

export type CommentaryCandidate = {
  id: string;
  page: number;
  text: string;
  type: "explain" | "common_mistake" | "analogy" | "context";
  beyond_notes: boolean;
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

export type AnnieSettings = {
  mood: AnnieMood;
  chattiness: Chattiness;
  quizzes_enabled: boolean;
  commentary_enabled: boolean;
  theme: ReaderTheme;
  silenced_until: string | null;
  silenced_forever: boolean;
};

export type ReaderPayload = {
  document: AnnieDocument;
  fileUrl: string;
  pages: PageText[];
  quizCandidates: QuizCandidate[];
  commentaryCandidates: CommentaryCandidate[];
  annotations: AnnieAnnotation[];
  settings: AnnieSettings;
  sessionId: string;
};

export type SessionSummary = {
  attempted: number;
  correct: number;
  pagesCovered: number;
  revisit: string[];
  message: string;
};

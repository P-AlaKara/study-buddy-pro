export type Deck = {
  id: string;
  title: string;
  description: string;
  subject: string;
  topic: string;
  organ_system: string;
  year: number;
  difficulty: string;
  is_official: boolean;
  owner_student_id: string | null;
  tags: string[];
  is_published: boolean;
};
export type CardType =
  "basic" | "cloze" | "image" | "image_identification" | "anatomy_labeling" | "ecg" | "histology";
export type Card = {
  id: string;
  deck_id: string;
  type: CardType;
  front: string;
  back: string;
  cloze_text: string | null;
  image_url: string | null;
  position: number;
};
export type Review = {
  id: string;
  flashcard_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_rating: Rating | null;
};
export type Rating = "again" | "hard" | "good" | "easy";
export const CARD_TYPES: CardType[] = [
  "basic",
  "cloze",
  "image",
  "image_identification",
  "anatomy_labeling",
  "ecg",
  "histology",
];
export const CARD_TYPE_LABEL: Record<CardType, string> = {
  basic: "Basic",
  cloze: "Cloze",
  image: "Image",
  image_identification: "Image ID",
  anatomy_labeling: "Anatomy label",
  ecg: "ECG",
  histology: "Histology",
};

/** SM-2 style scheduling. Returns the next state for a card after a rating. */
export function schedule(
  prev: { ease_factor: number; interval_days: number; repetitions: number } | null,
  rating: Rating,
) {
  let ease = Number(prev?.ease_factor ?? 2.5),
    interval = Number(prev?.interval_days ?? 1),
    reps = prev?.repetitions ?? 0;
  if (rating === "again") {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === "hard") {
    interval = reps === 0 ? 1 : Math.max(1, interval * 1.2);
    ease = Math.max(1.3, ease - 0.15);
    reps++;
  } else if (rating === "good") {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease;
    reps++;
  } else {
    interval = reps === 0 ? 4 : interval * ease * 1.3;
    ease = ease + 0.15;
    reps++;
  }
  interval = Math.round(interval * 10) / 10;
  const due = new Date(Date.now() + interval * 86400000).toISOString();
  return {
    ease_factor: Math.round(ease * 100) / 100,
    interval_days: interval,
    repetitions: reps,
    due_date: due,
  };
}
export function previewInterval(prev: Parameters<typeof schedule>[0], r: Rating) {
  const d = schedule(prev, r).interval_days;
  return d < 1.5 ? "1 day" : d < 30 ? `${Math.round(d)} days` : `${Math.round(d / 30)} mo`;
}

export const clozeFront = (t: string) => t.replace(/\{\{c\d+::(.*?)\}\}/g, "[ … ]");
export const clozeBack = (t: string) => t.replace(/\{\{c\d+::(.*?)\}\}/g, "【$1】");

// Data access is backend-mediated. The server derives ownership from the
// session, so the studentId argument kept for call-site compatibility is unused.
export async function fetchDecks(): Promise<Deck[]> {
  const { listDecks } = await import("./flashcards.functions");
  return listDecks();
}

/** Turns a pending suggestion into a real card in the student's "Suggested for me" deck. */
export async function acceptSuggestion(
  _studentId: string,
  s: { id: string; front: string; back: string },
) {
  const { acceptSuggestionFn } = await import("./flashcards.functions");
  await acceptSuggestionFn({ data: { suggestionId: s.id, front: s.front, back: s.back } });
}
export async function dismissSuggestion(id: string) {
  const { dismissSuggestionFn } = await import("./flashcards.functions");
  await dismissSuggestionFn({ data: { suggestionId: id } });
}
export async function createSuggestion(
  _studentId: string,
  source_type: "quiz" | "osce" | "case",
  source_id: string,
  front: string,
  back: string,
) {
  const { createSuggestionFn } = await import("./flashcards.functions");
  return createSuggestionFn({
    data: { sourceType: source_type, sourceId: source_id, front, back },
  });
}

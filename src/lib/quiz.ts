import { supabase } from "@/integrations/supabase/client";

export type Opt = { id: string; text: string };
export type Region = { id: string; label: string; x: number; y: number; w: number; h: number };
export type QType = "single_best_answer" | "multi_response" | "image" | "image_hotspot" | "matching" | "sequencing" | "short_vignette";
export type Question = {
  id: string; question_text: string; question_type: QType;
  options: Opt[] | { left: Opt[]; right: Opt[] } | { regions: Region[] };
  correct_answer: string | string[] | Record<string, string>;
  option_explanations: Record<string, string>; key_concept: string; clinical_pearl: string;
  subject: string; organ_system: string; topic: string; year: number; difficulty: string;
  clinical_competency: string; media_url: string | null; references: string[];
  related_case_id: string | null; related_flashcard_deck_id: string | null;
};
export type Answer = string | string[] | Record<string, string>;
export type QuizMode = "quick" | "topic" | "adaptive" | "timed" | "mistakes" | "bookmarked" | "group";

export const SUBJECTS = ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology"];
export const MODE_INFO: Record<Exclude<QuizMode, "group">, { label: string; desc: string }> = {
  quick: { label: "Quick quiz", desc: "10 random questions" },
  topic: { label: "Topic practice", desc: "Pick a subject and drill it" },
  adaptive: { label: "Adaptive practice", desc: "Focuses on your weak areas" },
  timed: { label: "Timed quiz", desc: "10 questions, 60 seconds each" },
  mistakes: { label: "Mistakes mode", desc: "Retry questions you got wrong" },
  bookmarked: { label: "Bookmarked", desc: "Questions you saved" },
};
export const TYPE_LABEL: Record<QType, string> = {
  single_best_answer: "Single best answer", multi_response: "Select all that apply", image: "Image question",
  image_hotspot: "Click the image", matching: "Matching", sequencing: "Put in order", short_vignette: "Clinical vignette",
};

export async function fetchQuestions(): Promise<Question[]> {
  const { data, error } = await supabase.from("quiz_questions").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as Question[];
}

export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (a == null) return false;
  const c = q.correct_answer;
  if (q.question_type === "multi_response") {
    const x = [...(a as string[])].sort(), y = [...(c as string[])].sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  if (q.question_type === "sequencing") return (a as string[]).join() === (c as string[]).join();
  if (q.question_type === "matching") {
    const cc = c as Record<string, string>, aa = a as Record<string, string>;
    return Object.keys(cc).every(k => aa[k] === cc[k]);
  }
  return a === c;
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T]; }
  return a;
}

export function hashSeed(str: string) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 1e9; return h; }

type History = { answers: Record<string, { correct: boolean }> }[];

export function topicAccuracy(questions: Question[], history: History) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const acc: Record<string, { right: number; total: number }> = {};
  for (const s of history) for (const [id, r] of Object.entries(s.answers ?? {})) {
    const q = byId.get(id); if (!q) continue;
    for (const key of [q.subject, q.topic]) { acc[key] ??= { right: 0, total: 0 }; acc[key].total++; if (r.correct) acc[key].right++; }
  }
  return acc;
}

/** Simple adaptive rule: weak areas and lowest-accuracy topics first, then everything else. */
export function adaptivePick(questions: Question[], weakAreas: string[], history: History, n = 10) {
  const acc = topicAccuracy(questions, history);
  const weak = weakAreas.map(w => w.toLowerCase());
  const score = (q: Question) => {
    let s = Math.random() * 0.2;
    if (weak.some(w => [q.subject, q.topic, q.organ_system].some(x => x.toLowerCase().includes(w) || w.includes(x.toLowerCase())))) s += 2;
    const t = acc[q.topic] ?? acc[q.subject];
    s += t ? 1 - t.right / t.total : 0.5;
    return s;
  };
  return [...questions].sort((a, b) => score(b) - score(a)).slice(0, n);
}

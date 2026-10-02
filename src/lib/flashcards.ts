import { supabase } from "@/integrations/supabase/client";

export type Deck = {
  id: string; title: string; description: string; subject: string; topic: string; organ_system: string; year: number;
  difficulty: string; is_official: boolean; owner_student_id: string | null; tags: string[]; is_published: boolean;
};
export type CardType = "basic" | "cloze" | "image" | "image_identification" | "anatomy_labeling" | "ecg" | "histology";
export type Card = { id: string; deck_id: string; type: CardType; front: string; back: string; cloze_text: string | null; image_url: string | null; position: number };
export type Review = { id: string; flashcard_id: string; ease_factor: number; interval_days: number; repetitions: number; due_date: string; last_rating: Rating | null };
export type Rating = "again" | "hard" | "good" | "easy";
export const CARD_TYPES: CardType[] = ["basic", "cloze", "image", "image_identification", "anatomy_labeling", "ecg", "histology"];
export const CARD_TYPE_LABEL: Record<CardType, string> = { basic: "Basic", cloze: "Cloze", image: "Image", image_identification: "Image ID", anatomy_labeling: "Anatomy label", ecg: "ECG", histology: "Histology" };

/** SM-2 style scheduling. Returns the next state for a card after a rating. */
export function schedule(prev: { ease_factor: number; interval_days: number; repetitions: number } | null, rating: Rating) {
  let ease = Number(prev?.ease_factor ?? 2.5), interval = Number(prev?.interval_days ?? 1), reps = prev?.repetitions ?? 0;
  if (rating === "again") { reps = 0; interval = 1; ease = Math.max(1.3, ease - 0.2); }
  else if (rating === "hard") { interval = reps === 0 ? 1 : Math.max(1, interval * 1.2); ease = Math.max(1.3, ease - 0.15); reps++; }
  else if (rating === "good") { interval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease; reps++; }
  else { interval = reps === 0 ? 4 : interval * ease * 1.3; ease = ease + 0.15; reps++; }
  interval = Math.round(interval * 10) / 10;
  const due = new Date(Date.now() + interval * 86400000).toISOString();
  return { ease_factor: Math.round(ease * 100) / 100, interval_days: interval, repetitions: reps, due_date: due };
}
export function previewInterval(prev: Parameters<typeof schedule>[0], r: Rating) {
  const d = schedule(prev, r).interval_days;
  return d < 1.5 ? "1 day" : d < 30 ? `${Math.round(d)} days` : `${Math.round(d / 30)} mo`;
}

export const clozeFront = (t: string) => t.replace(/\{\{c\d+::(.*?)\}\}/g, "[ … ]");
export const clozeBack = (t: string) => t.replace(/\{\{c\d+::(.*?)\}\}/g, "【$1】");

export async function fetchDecks(): Promise<Deck[]> {
  const { data, error } = await supabase.from("flashcard_decks").select("id,title,description,subject,topic,organ_system,year,difficulty,is_official,owner_student_id,tags,is_published").order("is_official", { ascending: false }).order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Deck[];
}

/** Turns a pending suggestion into a real card in the student's "Suggested for me" deck. */
export async function acceptSuggestion(studentId: string, s: { id: string; front: string; back: string }) {
  let { data: deck } = await supabase.from("flashcard_decks").select("id").eq("owner_student_id", studentId).eq("title", "Suggested for me").maybeSingle();
  if (!deck) {
    const r = await supabase.from("flashcard_decks").insert({ title: "Suggested for me", description: "Cards created from questions and checklist items you missed.", owner_student_id: studentId, is_official: false, subject: "Mixed", tags: ["suggested"] }).select("id").single();
    if (r.error) throw r.error;
    deck = r.data;
  }
  const { data: card, error } = await supabase.from("flashcards").insert({ deck_id: deck.id, type: "basic", front: s.front, back: s.back }).select("id").single();
  if (error) throw error;
  await supabase.from("suggested_flashcards").update({ status: "added", suggested_flashcard_id: card.id }).eq("id", s.id);
}
export async function dismissSuggestion(id: string) {
  await supabase.from("suggested_flashcards").update({ status: "dismissed" }).eq("id", id);
}
export async function createSuggestion(studentId: string, source_type: "quiz" | "osce" | "case", source_id: string, front: string, back: string) {
  const { data: existing } = await supabase.from("suggested_flashcards").select("id,front,back,status").eq("student_id", studentId).eq("source_id", source_id).eq("front", front).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase.from("suggested_flashcards").insert({ student_id: studentId, source_type, source_id, front, back }).select("id,front,back,status").single();
  return data;
}

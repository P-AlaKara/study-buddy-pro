import { supabase } from "@/integrations/supabase/client";

export type ChecklistItem = { id: string; item: string; marks: number; domain: string; safety?: boolean };
export type Station = {
  id: string; title: string; category: string; specialty: string; topic: string; year: number;
  difficulty: "easy" | "medium" | "hard"; duration_minutes: number; candidate_instructions: string;
  patient_instructions: { background: string; opening?: string; symptoms: string; history: string; emotional_state: string; reveal_on_ask: string[] };
  examiner_checklist: ChecklistItem[]; global_assessment_criteria: { domain: string; descriptor: string }[];
  hints: string[]; suggested_structure: string[]; learning_points: string[]; resources: { title: string; type: string }[];
};
export type ChecklistResult = { id: string; item: string; done: boolean };

export const CATEGORY_LABELS: Record<string, string> = {
  history_taking: "History taking", physical_exam: "Physical exam", communication: "Communication", counseling: "Counselling",
  breaking_bad_news: "Breaking bad news", procedures: "Procedures", emergency_assessment: "Emergency assessment",
  data_interpretation: "Data interpretation", prescribing: "Prescribing", patient_education: "Patient education",
  ethics: "Ethics", consent: "Consent", handover: "Handover", clinical_reasoning: "Clinical reasoning",
};
export const DOMAIN_LABELS: Record<string, string> = { history: "History", exam: "Examination", communication: "Communication", reasoning: "Clinical reasoning", safety: "Patient safety" };

export async function fetchStations(): Promise<Station[]> {
  const { data, error } = await supabase.from("osce_stations").select("*").eq("is_published", true).order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Station[];
}

export function scoreChecklist(s: Station, done: Record<string, boolean>) {
  const total = s.examiner_checklist.reduce((a, i) => a + i.marks, 0);
  const got = s.examiner_checklist.reduce((a, i) => a + (done[i.id] ? i.marks : 0), 0);
  return Math.round((got / Math.max(1, total)) * 100);
}
export function toResults(s: Station, done: Record<string, boolean>): ChecklistResult[] {
  return s.examiner_checklist.map(i => ({ id: i.id, item: i.item, done: !!done[i.id] }));
}
export function band(score: number) {
  return score >= 80 ? "Good pass" : score >= 60 ? "Pass" : score >= 50 ? "Borderline" : "Fail";
}
export function fmt(sec: number) {
  const s = Math.abs(sec);
  return `${sec < 0 ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

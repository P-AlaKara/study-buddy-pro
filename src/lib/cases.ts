import { supabase } from "@/integrations/supabase/client";

export type HistoryCategory = { category: string; questions: { id: string; q: string; a: string }[] };
export type Finding = { id: string; name: string; finding: string };
export type Investigation = { id: string; name: string; result: string };
export type Option = { id: string; label: string };
export type CaseRow = {
  id: string; title: string; teaser: string; specialty: string; organ_system: string; topic: string;
  year_level: number; difficulty: "easy" | "medium" | "hard"; clinical_setting: string; estimated_minutes: number;
  xp_reward: number; mode: string; is_weekly_challenge: boolean; challenge_end: string | null; completions_count: number;
  patient: { name: string; age: number; sex: string; location: string };
  initial_presentation: string; history_categories: HistoryCategory[]; examinations: Finding[];
  investigations: Investigation[]; interpretation_task: { prompt: string; investigation: string; options: string[] };
  differential_prompt: string; diagnosis_options: string[]; management_options: Option[];
  communication_task: { prompt: string; options: { id: string; text: string }[] } | null;
};

export const CASE_COLUMNS = "id,title,teaser,specialty,organ_system,topic,year_level,difficulty,clinical_setting,estimated_minutes,xp_reward,mode,is_weekly_challenge,challenge_end,completions_count,patient,initial_presentation,history_categories,examinations,investigations,interpretation_task,differential_prompt,diagnosis_options,management_options,communication_task";

export async function fetchCases(): Promise<CaseRow[]> {
  const { data, error } = await supabase.from("cases").select(CASE_COLUMNS).order("is_weekly_challenge", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CaseRow[];
}
export async function fetchCase(id: string): Promise<CaseRow> {
  const { data, error } = await supabase.from("cases").select(CASE_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return data as unknown as CaseRow;
}

export const STAGES = ["presentation", "history", "exam", "differential", "investigations", "interpretation", "diagnosis", "management", "communication", "outcome", "debrief"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  presentation: "Presentation", history: "History", exam: "Examination", differential: "Differentials",
  investigations: "Investigations", interpretation: "Interpretation", diagnosis: "Diagnosis",
  management: "Management", communication: "Communication", outcome: "Outcome", debrief: "Debrief",
};
export const SETTING_LABELS: Record<string, string> = { ED: "Emergency", outpatient: "Outpatient", ward: "Ward", surgical: "Surgical", ICU: "ICU", community: "Community", pediatrics: "Paediatrics", maternity: "Maternity" };
export const DIFFICULTY_COLOR: Record<string, string> = { easy: "bg-mint-soft", medium: "bg-yellow-soft", hard: "bg-pink-soft" };
export const CATEGORY_LABELS: Record<string, string> = {
  diagnostic_accuracy: "Diagnosis", clinical_reasoning: "Reasoning", management: "Management",
  investigations: "Investigations", patient_safety: "Safety", communication: "Communication",
};

export function formatCountdown(end: string | null, now: number) {
  if (!end) return "";
  const ms = Math.max(0, new Date(end).getTime() - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}

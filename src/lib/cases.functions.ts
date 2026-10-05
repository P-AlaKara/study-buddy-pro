import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Key = {
  key_history: string[];
  key_exams: string[];
  key_investigations: string[];
  unnecessary_investigations: string[];
  interpretation: string;
  management_correct: string[];
  management_harmful: string[];
  communication_best: string;
};

// Scores an attempt on the server (answer keys are never sent to the browser before completion).
export const completeAttempt = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await supabaseAdmin
      .from("case_attempts")
      .select("*")
      .eq("id", data.attemptId)
      .single();
    if (error || !attempt) throw new Error("Attempt not found");
    const { data: c, error: ce } = await supabaseAdmin
      .from("cases")
      .select("*")
      .eq("id", attempt.case_id)
      .single();
    if (ce || !c) throw new Error("Case not found");
    const key = c.answer_key as unknown as Key;
    const outcomes = c.outcomes as Record<string, string>;

    let breakdown = attempt.score_breakdown as Record<string, number> | null;
    let total = attempt.total_score ?? 0;
    let outcomeKey = attempt.management_path_outcome ?? "partial";

    if (attempt.status !== "completed") {
      const frac = (picked: string[], wanted: string[]) =>
        wanted.length ? wanted.filter((x) => picked.includes(x)).length / wanted.length : 1;
      const hist = (attempt.history_questions_asked as string[]) ?? [];
      const exams = (attempt.exams_performed as string[]) ?? [];
      const inv = (attempt.investigations_ordered as string[]) ?? [];
      const diffs = (attempt.differential_submission as string[] | null) ?? [];
      const mgmt = (attempt.management_choices as string[]) ?? [];
      const comm = (attempt.communication_response as { id?: string } | null)?.id;
      const harmful = mgmt.filter((m) => key.management_harmful.includes(m)).length;
      const unnecessary = inv.filter((i) => key.unnecessary_investigations.includes(i)).length;
      const w = c.scoring_weights as {
        diagnostic_accuracy: number;
        clinical_reasoning: number;
        investigations: number;
        management: number;
        patient_safety: number;
        communication: number;
      };
      const diffScore =
        c.correct_differentials.filter((d: string) => diffs.includes(d)).length /
        Math.max(1, c.correct_differentials.length);
      const r = (n: number) => Math.max(0, Math.round(n));
      breakdown = {
        diagnostic_accuracy: r(
          attempt.final_diagnosis === c.correct_diagnosis
            ? w.diagnostic_accuracy
            : c.correct_differentials.includes(attempt.final_diagnosis ?? "")
              ? w.diagnostic_accuracy / 3
              : 0,
        ),
        clinical_reasoning: r(
          w.clinical_reasoning *
            (0.35 * frac(hist, key.key_history) +
              0.3 * frac(exams, key.key_exams) +
              0.35 * diffScore),
        ),
        investigations: r(
          w.investigations *
            (0.6 * frac(inv, key.key_investigations) +
              0.4 * (attempt.interpretation_answer === key.interpretation ? 1 : 0)) -
            2 * unnecessary,
        ),
        management: r(w.management * frac(mgmt, key.management_correct) - 7 * harmful),
        patient_safety: r(w.patient_safety - 5 * harmful - 2 * unnecessary),
        communication: r(comm === key.communication_best ? w.communication : 1),
      };
      total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      outcomeKey = total >= 75 && harmful === 0 ? "good" : total >= 50 ? "partial" : "poor";
      const { error: ue } = await supabaseAdmin
        .from("case_attempts")
        .update({
          status: "completed",
          current_stage: "debrief",
          score_breakdown: breakdown,
          total_score: total,
          management_path_outcome: outcomeKey,
          completed_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);
      if (ue) throw new Error(ue.message);

      const { data: student } = await supabaseAdmin
        .from("students")
        .select("name,university,year_of_study")
        .eq("id", attempt.student_id)
        .single();
      await supabaseAdmin
        .from("cases")
        .update({ completions_count: c.completions_count + 1 })
        .eq("id", c.id);
      if (c.is_weekly_challenge && student) {
        const { data: ch } = await supabaseAdmin
          .from("weekly_challenges")
          .select("id")
          .eq("case_id", c.id)
          .maybeSingle();
        if (ch) {
          const { data: existing } = await supabaseAdmin
            .from("challenge_participants")
            .select("id")
            .eq("challenge_id", ch.id)
            .eq("student_id", attempt.student_id)
            .eq("mode", attempt.mode)
            .maybeSingle();
          if (!existing) {
            let teamName: string | null = null;
            if (attempt.room_id)
              teamName =
                (
                  await supabaseAdmin
                    .from("case_rooms")
                    .select("name")
                    .eq("id", attempt.room_id)
                    .maybeSingle()
                ).data?.name ?? null;
            await supabaseAdmin.from("challenge_participants").insert({
              challenge_id: ch.id,
              student_id: attempt.student_id,
              display_name: attempt.mode === "team" && teamName ? teamName : student.name,
              mode: attempt.mode,
              team_id: attempt.room_id,
              team_name: teamName,
              group_name: `${student.university
                .split(" ")
                .map((x: string) => x[0])
                .join("")} Year ${student.year_of_study}`,
              score: total,
              time_taken_seconds: Math.round(
                (Date.now() - new Date(attempt.started_at).getTime()) / 1000,
              ),
            });
          }
        }
      }
    }
    return {
      breakdown: breakdown as Record<string, number>,
      total,
      outcomeKey,
      outcome: outcomes[outcomeKey] ?? "",
      weights: c.scoring_weights as Record<string, number>,
      debrief: c.debrief as { summary: string; teaching_points: string[]; pitfalls: string[] },
      correctDiagnosis: c.correct_diagnosis,
      correctDifferentials: c.correct_differentials as string[],
      correctManagement: key.management_correct,
      harmfulManagement: key.management_harmful,
      yourDiagnosis: attempt.final_diagnosis,
      yourManagement: (attempt.management_choices as string[]) ?? [],
    };
  });

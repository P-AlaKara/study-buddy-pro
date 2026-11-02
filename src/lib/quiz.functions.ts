/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";
import type { Question } from "./quiz";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// Quiz questions are shared content, served through the backend.
export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Question[]> => {
    const db = await adminDb();
    const { data, error } = await db.from("quiz_questions").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Question[];
  });

type AnswerHistory = { answers: Record<string, { correct: boolean }> }[];

// Completed-session history + bookmarked question ids, scoped to the user.
export const getQuizHistory = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<{ history: AnswerHistory; bookmarkedIds: string[] }> => {
    const db = await adminDb();
    const [{ data: hist }, { data: bms }] = await Promise.all([
      db
        .from("quiz_sessions")
        .select("answers")
        .eq("student_id", context.profileId)
        .not("completed_at", "is", null),
      db.from("bookmarked_questions").select("question_id").eq("student_id", context.profileId),
    ]);
    return {
      history: (hist ?? []) as unknown as AnswerHistory,
      bookmarkedIds: (bms ?? []).map((b: any) => b.question_id as string),
    };
  });

export const createQuizSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        mode: z.string().max(40),
        questionIds: z.array(z.string()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const db = await adminDb();
    const { data: row, error } = await db
      .from("quiz_sessions")
      .insert({
        student_id: context.profileId,
        mode: data.mode,
        question_ids: data.questionIds,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const finishQuizSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        answers: z.record(z.string(), z.any()),
        score: z.number().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    // Only finish a session the caller owns.
    const { error } = await db
      .from("quiz_sessions")
      .update({
        answers: data.answers,
        score: data.score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId)
      .eq("student_id", context.profileId);
    if (error) throw new Error(error.message);
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ questionId: z.string(), bookmark: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    if (data.bookmark) {
      await db
        .from("bookmarked_questions")
        .insert({ student_id: context.profileId, question_id: data.questionId });
    } else {
      await db
        .from("bookmarked_questions")
        .delete()
        .eq("student_id", context.profileId)
        .eq("question_id", data.questionId);
    }
  });

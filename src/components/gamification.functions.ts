/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";

// All handlers derive ownership from the session (context.profileId); the
// browser never supplies a student id. Leaderboards and search intentionally
// read shared/public columns across users.

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// --- Notifications ---------------------------------------------------------
export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<number> => {
    const db = await adminDb();
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", context.profileId)
      .eq("is_read", false);
    return count ?? 0;
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data } = await db
      .from("notifications")
      .select("*")
      .eq("student_id", context.profileId)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as any[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", data.id)
      .eq("student_id", context.profileId);
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ prefs: z.record(z.string(), z.boolean()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await db
      .from("students")
      .update({ notification_prefs: data.prefs })
      .eq("user_id", context.userId);
  });

// --- Achievements / celebration -------------------------------------------
export const getEarnedAchievements = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const [{ data: earned }, { data: all }] = await Promise.all([
      db.from("student_achievements").select("achievement_id").eq("student_id", context.profileId),
      db.from("achievements").select("*"),
    ]);
    return {
      earnedIds: (earned ?? [])
        .map((x: any) => x.achievement_id)
        .filter((x: any): x is string => Boolean(x)),
      all: (all ?? []) as any[],
    };
  });

// --- Home widgets ----------------------------------------------------------
export const getHomeGamification = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [reviews, xp, earned] = await Promise.all([
      db
        .from("flashcard_reviews")
        .select("id", { count: "exact", head: true })
        .eq("student_id", context.profileId)
        .lte("due_date", new Date().toISOString()),
      db
        .from("xp_events")
        .select("xp_amount")
        .eq("student_id", context.profileId)
        .gte("created_at", start.toISOString()),
      db
        .from("student_achievements")
        .select("earned_at,achievements(*)")
        .eq("student_id", context.profileId)
        .order("earned_at", { ascending: false })
        .limit(1),
    ]);
    const row = earned.data?.[0] as { achievements: any | null } | undefined;
    return {
      due: reviews.count ?? 0,
      todayXp: (xp.data ?? []).reduce((n: number, x: any) => n + x.xp_amount, 0),
      achievement: row?.achievements ?? null,
    };
  });

export const getHomeMastery = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data } = await db
      .from("mastery_scores")
      .select("*")
      .eq("student_id", context.profileId)
      .order("numeric_score")
      .limit(3);
    return (data ?? []) as any[];
  });

// --- Notes & saved items ---------------------------------------------------
export const addNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        contentType: z.enum(["case", "quiz_question", "flashcard"]),
        contentId: z.string().max(200),
        noteText: z.string().trim().min(1).max(5000),
        isShared: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { error } = await db.from("notes").insert({
      student_id: context.profileId,
      content_type: data.contentType,
      content_id: data.contentId,
      note_text: data.noteText,
      is_shared: data.isShared,
    });
    if (error) throw new Error(error.message);
  });

export const setNoteShared = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), shared: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await db
      .from("notes")
      .update({ is_shared: data.shared })
      .eq("id", data.id)
      .eq("student_id", context.profileId);
  });

export const getSavedState = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ contentType: z.string().max(40), contentId: z.string().max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<boolean> => {
    const db = await adminDb();
    const { data: row } = await db
      .from("saved_items")
      .select("id")
      .eq("student_id", context.profileId)
      .eq("content_type", data.contentType)
      .eq("content_id", data.contentId)
      .maybeSingle();
    return Boolean(row);
  });

export const toggleSavedItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        contentType: z.enum(["case", "resource"]),
        contentId: z.string().max(200),
        title: z.string().max(300),
        href: z.string().max(2000),
        save: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    if (data.save) {
      await db.from("saved_items").insert({
        student_id: context.profileId,
        content_type: data.contentType,
        content_id: data.contentId,
        title: data.title,
        related_link: data.href,
      });
    } else {
      await db
        .from("saved_items")
        .delete()
        .eq("student_id", context.profileId)
        .eq("content_type", data.contentType)
        .eq("content_id", data.contentId);
    }
  });

// --- Progress dashboard ----------------------------------------------------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const id = context.profileId;
    const [
      xp,
      cases,
      quizzes,
      reviews,
      mastery,
      achievements,
      earned,
      challenges,
      notes,
      saved,
      questions,
      decks,
      optout,
    ] = await Promise.all([
      db.from("xp_events").select("xp_amount,source_type,created_at").eq("student_id", id),
      db
        .from("case_attempts")
        .select("id,total_score,completed_at,started_at")
        .eq("student_id", id)
        .eq("status", "completed"),
      db
        .from("quiz_sessions")
        .select("id,score,started_at,completed_at")
        .eq("student_id", id)
        .not("completed_at", "is", null),
      db.from("flashcard_reviews").select("id,created_at,last_reviewed_at").eq("student_id", id),
      db.from("mastery_scores").select("*").eq("student_id", id).order("subject_or_system"),
      db.from("achievements").select("*").order("name"),
      db.from("student_achievements").select("achievement_id,earned_at").eq("student_id", id),
      db.from("challenge_participants").select("id,score,rank,created_at").eq("student_id", id),
      db
        .from("notes")
        .select("id,content_type,note_text,is_shared,created_at")
        .eq("student_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("saved_items")
        .select("id,content_type,title,related_link,created_at")
        .eq("student_id", id),
      db
        .from("bookmarked_questions")
        .select("id,quiz_questions(question_text)")
        .eq("student_id", id),
      db.from("saved_decks").select("id,flashcard_decks(title)").eq("student_id", id),
      db.from("leaderboard_opt_outs").select("student_id").eq("student_id", id).maybeSingle(),
    ]);
    return {
      xp: xp.data ?? [],
      cases: cases.data ?? [],
      quizzes: quizzes.data ?? [],
      reviews: reviews.data ?? [],
      mastery: mastery.data ?? [],
      achievements: achievements.data ?? [],
      earned: (earned.data ?? []).map((e: any) => ({
        achievement_id: e.achievement_id ?? "",
        earned_at: e.earned_at,
      })),
      challenges: challenges.data ?? [],
      notes: notes.data ?? [],
      saved: (saved.data ?? []).map((s: any) => ({ ...s, related_link: s.related_link ?? "" })),
      questions: questions.data ?? [],
      decks: decks.data ?? [],
      optedOut: Boolean(optout.data),
    };
  });

export const toggleLeaderboardOptOut = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ optOut: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    if (data.optOut) {
      await db.from("leaderboard_opt_outs").insert({ student_id: context.profileId });
    } else {
      await db.from("leaderboard_opt_outs").delete().eq("student_id", context.profileId);
    }
  });

// --- Leaderboards (cross-user, opt-outs respected server-side) -------------
export interface LeaderboardData {
  students: { id: string; name: string; university: string; year_of_study: number; xp: number }[];
  xp: { student_id: string; xp_amount: number; created_at: string }[];
  optouts: { student_id: string }[];
  attempts: { student_id: string; total_score: number | null; completed_at: string | null }[];
  participants: {
    id: string;
    student_id: string;
    display_name: string;
    team_name: string | null;
    mode: string;
    score: number;
    rank: number | null;
  }[];
}

export const getLeaderboardData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<LeaderboardData> => {
    const db = await adminDb();
    const [students, xp, optouts, attempts, participants] = await Promise.all([
      db.from("students").select("id,name,university,year_of_study,xp"),
      db.from("xp_events").select("student_id,xp_amount,created_at"),
      db.from("leaderboard_opt_outs").select("student_id"),
      db
        .from("case_attempts")
        .select("student_id,total_score,completed_at")
        .eq("status", "completed"),
      db
        .from("challenge_participants")
        .select("id,student_id,display_name,team_name,mode,score,rank"),
    ]);
    return {
      students: students.data ?? [],
      xp: xp.data ?? [],
      optouts: optouts.data ?? [],
      attempts: attempts.data ?? [],
      participants: participants.data ?? [],
    };
  });

// --- Global search ---------------------------------------------------------
export interface SearchResult {
  cases: { id: string; title: string; specialty: string; topic: string }[];
  questions: { id: string; question_text: string; subject: string; topic: string }[];
  decks: { id: string; title: string; subject: string; topic: string }[];
}

export const searchLibrary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ term: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const db = await adminDb();
    const term = `%${data.term.toLowerCase()}%`;
    const [cases, questions, decks] = await Promise.all([
      db
        .from("cases")
        .select("id,title,specialty,topic")
        .or(`title.ilike.${term},topic.ilike.${term},specialty.ilike.${term}`)
        .limit(6),
      db
        .from("quiz_questions")
        .select("id,question_text,subject,topic")
        .or(`question_text.ilike.${term},topic.ilike.${term},subject.ilike.${term}`)
        .limit(6),
      // Personal decks are only matched for their owner; official decks for all.
      db
        .from("flashcard_decks")
        .select("id,title,subject,topic,is_official,owner_student_id")
        .or(`title.ilike.${term},topic.ilike.${term},subject.ilike.${term}`)
        .limit(20),
    ]);
    const deckRows = (decks.data ?? [])
      .filter((d: any) => d.is_official || d.owner_student_id === context.profileId)
      .slice(0, 6);
    return {
      cases: cases.data ?? [],
      questions: questions.data ?? [],
      decks: deckRows,
    };
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";

// Columns the app shell and profile UI consume. xp/level/streak are
// system-managed and never writable through the profile editor.
export const PROFILE_COLUMNS =
  "id,user_id,name,email,university,country,year_of_study,medical_program,current_level," +
  "subjects_studying,current_rotation,specialty_interests,weak_areas,study_goal," +
  "daily_study_target_minutes,notification_prefs,xp,level,streak_days,longest_streak,created_at";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data, error } = await db
      .from("students")
      .select(PROFILE_COLUMNS)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  university: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(100).optional(),
  year_of_study: z.number().int().min(1).max(8).nullable().optional(),
  medical_program: z.string().trim().max(100).nullable().optional(),
  current_level: z.string().trim().max(100).nullable().optional(),
  subjects_studying: z.array(z.string().max(100)).max(50).optional(),
  current_rotation: z.string().trim().max(100).nullable().optional(),
  specialty_interests: z.array(z.string().max(100)).max(50).optional(),
  weak_areas: z.array(z.string().max(100)).max(50).optional(),
  study_goal: z.string().trim().max(500).nullable().optional(),
  daily_study_target_minutes: z.number().int().min(5).max(480).optional(),
  notification_prefs: z
    .object({ study_reminders: z.boolean(), weekly_digest: z.boolean() })
    .partial()
    .optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    // Ownership is enforced by filtering on the authenticated user's id; the
    // client cannot target another user's profile.
    const { data: row, error } = await db
      .from("students")
      .update(data)
      .eq("user_id", context.userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuth } from "@/features/auth/middleware";

const feedbackSchema = z.object({
  sentiment: z.string().max(40).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
  liked: z.string().max(4000).nullable().optional(),
  improve: z.string().max(4000).nullable().optional(),
  wanted: z.string().max(4000).nullable().optional(),
  page: z.string().max(300).nullable().optional(),
  user_agent: z.string().max(500).nullable().optional(),
});

// Feedback can be sent signed-out (e.g. from the login page), so the session is
// optional; when present the feedback is associated with the user's profile.
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator((input: unknown) => feedbackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("feedback")
      .insert({ ...data, student_id: context.profileId ?? null });
    if (error) throw new Error(error.message);
  });

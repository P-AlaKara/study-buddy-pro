/* eslint-disable @typescript-eslint/no-explicit-any */
// Server functions for the USMLE Prep feature: coach profiles, classes,
// enrollments, reviews, and private coach <-> student messaging / class
// announcements. All access goes through the service-role client (the browser
// is locked out of the tables); authorization is enforced here, keyed to the
// authenticated account's role and profile id.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// --- Types -----------------------------------------------------------------
export type CoachProfile = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  qualifications: string;
  expertise: string[];
  availability: string;
  created_at: string;
};
export type CoachClass = {
  id: string;
  coach_id: string;
  title: string;
  description: string;
  usmle_step: string;
  schedule: string;
  capacity: number | null;
  is_open: boolean;
  created_at: string;
};
export type CoachReview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  student_id: string;
  student_name: string;
};
export type UsmleMessage = {
  id: string;
  coach_id: string;
  student_id: string;
  sender_role: "coach" | "student";
  body: string;
  created_at: string;
};
export type ClassAnnouncement = {
  id: string;
  class_id: string;
  class_title: string;
  body: string;
  created_at: string;
};

const USMLE_STEPS = ["Step 1", "Step 2 CK", "Step 3"] as const;

// --- Shared helpers --------------------------------------------------------

/** Resolve the caller's coach profile, or throw if they are not a coach. */
async function requireCoach(db: any, context: any): Promise<string> {
  if (context.role !== "coach") throw new Error("Only coaches can do that.");
  const { data } = await db
    .from("coaches")
    .select("id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Your coach profile is missing. Contact support.");
  return data.id as string;
}

function requireStudent(context: any) {
  if (context.role !== "student") throw new Error("Only students can do that.");
}

/** True when the student is enrolled in at least one of the coach's classes. */
async function studentSharesEnrollment(
  db: any,
  coachId: string,
  studentId: string,
): Promise<boolean> {
  const { data: classes } = await db.from("coach_classes").select("id").eq("coach_id", coachId);
  const ids = (classes ?? []).map((c: any) => c.id as string);
  if (ids.length === 0) return false;
  const { data } = await db
    .from("class_enrollments")
    .select("id")
    .eq("student_id", studentId)
    .in("class_id", ids)
    .limit(1);
  return (data ?? []).length > 0;
}

function ratingSummary(reviews: { rating: number }[]): { average: number; count: number } {
  const count = reviews.length;
  if (count === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((n, r) => n + (r.rating ?? 0), 0);
  return { average: Math.round((sum / count) * 10) / 10, count };
}

// ===========================================================================
// COACH: own profile + dashboard
// ===========================================================================

export const getMyCoachProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<CoachProfile> => {
    const db = await adminDb();
    if (context.role !== "coach") throw new Error("Not a coach account.");
    const { data, error } = await db
      .from("coaches")
      .select("id,user_id,name,email,headline,bio,qualifications,expertise,availability,created_at")
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return data as CoachProfile;
  });

const coachProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  qualifications: z.string().trim().max(4000).optional(),
  expertise: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  availability: z.string().trim().max(1000).optional(),
});

export const updateCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => coachProfileSchema.parse(d))
  .handler(async ({ data, context }): Promise<CoachProfile> => {
    const db = await adminDb();
    await requireCoach(db, context);
    const { data: row, error } = await db
      .from("coaches")
      .update(data)
      .eq("user_id", context.userId)
      .select("id,user_id,name,email,headline,bio,qualifications,expertise,availability,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as CoachProfile;
  });

export type CoachDashboard = {
  coach: CoachProfile;
  classes: (CoachClass & {
    enrollments: { student_id: string; name: string; enrolled_at: string }[];
  })[];
  threads: { student_id: string; name: string; last_message: string; last_at: string }[];
};

export const getCoachDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<CoachDashboard> => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);

    const [{ data: coach }, { data: classes }] = await Promise.all([
      db
        .from("coaches")
        .select(
          "id,user_id,name,email,headline,bio,qualifications,expertise,availability,created_at",
        )
        .eq("id", coachId)
        .single(),
      db
        .from("coach_classes")
        .select("*")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false }),
    ]);

    const classIds = (classes ?? []).map((c: any) => c.id as string);
    let enrollments: any[] = [];
    if (classIds.length) {
      const { data } = await db
        .from("class_enrollments")
        .select("class_id,student_id,created_at,students(name)")
        .in("class_id", classIds);
      enrollments = data ?? [];
    }

    // Most recent message per student thread, for the inbox list.
    const { data: messages } = await db
      .from("usmle_messages")
      .select("student_id,body,created_at,students(name)")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false })
      .limit(500);
    const threadMap = new Map<string, { name: string; last_message: string; last_at: string }>();
    for (const m of messages ?? []) {
      if (!threadMap.has(m.student_id)) {
        threadMap.set(m.student_id, {
          name: m.students?.name ?? "Student",
          last_message: m.body,
          last_at: m.created_at,
        });
      }
    }

    return {
      coach: coach as CoachProfile,
      classes: (classes ?? []).map((c: any) => ({
        ...c,
        enrollments: enrollments
          .filter((e) => e.class_id === c.id)
          .map((e) => ({
            student_id: e.student_id,
            name: e.students?.name ?? "Student",
            enrolled_at: e.created_at,
          })),
      })),
      threads: [...threadMap.entries()].map(([student_id, v]) => ({ student_id, ...v })),
    };
  });

const classSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  usmle_step: z.enum(USMLE_STEPS).optional(),
  schedule: z.string().trim().max(1000).optional(),
  capacity: z.number().int().min(1).max(1000).nullable().optional(),
  is_open: z.boolean().optional(),
});

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => classSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    const { data: row, error } = await db
      .from("coach_classes")
      .insert({
        coach_id: coachId,
        title: data.title,
        description: data.description ?? "",
        usmle_step: data.usmle_step ?? "Step 1",
        schedule: data.schedule ?? "",
        capacity: data.capacity ?? null,
        is_open: data.is_open ?? true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => classSchema.partial().extend({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    const { classId, ...fields } = data;
    const { error } = await db
      .from("coach_classes")
      .update(fields)
      .eq("id", classId)
      .eq("coach_id", coachId);
    if (error) throw new Error(error.message);
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    const { error } = await db
      .from("coach_classes")
      .delete()
      .eq("id", data.classId)
      .eq("coach_id", coachId);
    if (error) throw new Error(error.message);
  });

export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    // Confirm the class belongs to this coach before broadcasting.
    const { data: cls } = await db
      .from("coach_classes")
      .select("id")
      .eq("id", data.classId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (!cls) throw new Error("Class not found.");
    const { error } = await db
      .from("class_announcements")
      .insert({ class_id: data.classId, coach_id: coachId, body: data.body });
    if (error) throw new Error(error.message);
  });

// ===========================================================================
// MESSAGING (shared thread storage; both sides read/write the same rows)
// ===========================================================================

export const getCoachThread = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<UsmleMessage[]> => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    const { data: rows } = await db
      .from("usmle_messages")
      .select("*")
      .eq("coach_id", coachId)
      .eq("student_id", data.studentId)
      .order("created_at")
      .limit(500);
    return (rows ?? []) as UsmleMessage[];
  });

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ studentId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<UsmleMessage | null> => {
    const db = await adminDb();
    const coachId = await requireCoach(db, context);
    const enrolled = await studentSharesEnrollment(db, coachId, data.studentId);
    if (!enrolled) throw new Error("You can only message students enrolled in your classes.");
    const { data: row, error } = await db
      .from("usmle_messages")
      .insert({
        coach_id: coachId,
        student_id: data.studentId,
        sender_role: "coach",
        body: data.body,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return (row as UsmleMessage) ?? null;
  });

export const getStudentThread = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ coachId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<UsmleMessage[]> => {
    const db = await adminDb();
    requireStudent(context);
    const { data: rows } = await db
      .from("usmle_messages")
      .select("*")
      .eq("coach_id", data.coachId)
      .eq("student_id", context.profileId)
      .order("created_at")
      .limit(500);
    return (rows ?? []) as UsmleMessage[];
  });

export const sendStudentMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ coachId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<UsmleMessage | null> => {
    const db = await adminDb();
    requireStudent(context);
    const enrolled = await studentSharesEnrollment(db, data.coachId, context.profileId);
    if (!enrolled) throw new Error("Enroll in one of this coach's classes to message them.");
    const { data: row, error } = await db
      .from("usmle_messages")
      .insert({
        coach_id: data.coachId,
        student_id: context.profileId,
        sender_role: "student",
        body: data.body,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return (row as UsmleMessage) ?? null;
  });

// ===========================================================================
// STUDENT: discovery, enrollment, reviews, announcements
// ===========================================================================

export type CoachListItem = {
  id: string;
  name: string;
  headline: string;
  expertise: string[];
  rating: number;
  reviews: number;
  classes: number;
};

export const listCoaches = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<CoachListItem[]> => {
    const db = await adminDb();
    const [{ data: coaches }, { data: reviews }, { data: classes }] = await Promise.all([
      db
        .from("coaches")
        .select("id,name,headline,expertise")
        .order("created_at", { ascending: false }),
      db.from("coach_reviews").select("coach_id,rating"),
      db.from("coach_classes").select("coach_id,is_open"),
    ]);
    return (coaches ?? []).map((c: any) => {
      const mine = (reviews ?? []).filter((r: any) => r.coach_id === c.id);
      const { average, count } = ratingSummary(mine);
      return {
        id: c.id,
        name: c.name,
        headline: c.headline,
        expertise: c.expertise ?? [],
        rating: average,
        reviews: count,
        classes: (classes ?? []).filter((k: any) => k.coach_id === c.id && k.is_open).length,
      };
    });
  });

export type CoachPublic = {
  coach: CoachProfile;
  rating: number;
  reviews: CoachReview[];
  classes: (CoachClass & { enrolled: number; isEnrolled: boolean })[];
  myReview: { rating: number; comment: string } | null;
  canMessage: boolean;
};

export const getCoachPublic = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ coachId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CoachPublic> => {
    const db = await adminDb();
    const studentId = context.role === "student" ? context.profileId : null;

    const [{ data: coach, error }, { data: classes }, { data: reviews }] = await Promise.all([
      db
        .from("coaches")
        .select(
          "id,user_id,name,email,headline,bio,qualifications,expertise,availability,created_at",
        )
        .eq("id", data.coachId)
        .single(),
      db
        .from("coach_classes")
        .select("*")
        .eq("coach_id", data.coachId)
        .order("created_at", { ascending: false }),
      db
        .from("coach_reviews")
        .select("id,rating,comment,created_at,student_id,students(name)")
        .eq("coach_id", data.coachId)
        .order("created_at", { ascending: false }),
    ]);
    if (error || !coach) throw new Error("Coach not found.");

    const classIds = (classes ?? []).map((c: any) => c.id as string);
    const counts: Record<string, number> = {};
    const myClassIds = new Set<string>();
    if (classIds.length) {
      const { data: enr } = await db
        .from("class_enrollments")
        .select("class_id,student_id")
        .in("class_id", classIds);
      for (const e of enr ?? []) {
        counts[e.class_id] = (counts[e.class_id] ?? 0) + 1;
        if (studentId && e.student_id === studentId) myClassIds.add(e.class_id);
      }
    }

    const reviewRows: CoachReview[] = (reviews ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      student_id: r.student_id,
      student_name: r.students?.name ?? "Student",
    }));
    const mine = studentId ? reviewRows.find((r) => r.student_id === studentId) : undefined;

    return {
      coach: coach as CoachProfile,
      rating: ratingSummary(reviewRows).average,
      reviews: reviewRows,
      classes: (classes ?? []).map((c: any) => ({
        ...c,
        enrolled: counts[c.id] ?? 0,
        isEnrolled: myClassIds.has(c.id),
      })),
      myReview: mine ? { rating: mine.rating, comment: mine.comment } : null,
      canMessage: myClassIds.size > 0,
    };
  });

export const enrollInClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    requireStudent(context);
    const { data: cls } = await db
      .from("coach_classes")
      .select("id,is_open,capacity")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls) throw new Error("Class not found.");
    if (!cls.is_open) throw new Error("This class is not accepting new students.");
    if (cls.capacity != null) {
      const { count } = await db
        .from("class_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", data.classId);
      if ((count ?? 0) >= cls.capacity) throw new Error("This class is full.");
    }
    const { error } = await db
      .from("class_enrollments")
      .upsert(
        { class_id: data.classId, student_id: context.profileId },
        { onConflict: "class_id,student_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  });

export const unenroll = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    requireStudent(context);
    await db
      .from("class_enrollments")
      .delete()
      .eq("class_id", data.classId)
      .eq("student_id", context.profileId);
  });

export const leaveReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        coachId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    requireStudent(context);
    // Students may only review a coach they have studied with.
    const enrolled = await studentSharesEnrollment(db, data.coachId, context.profileId);
    if (!enrolled) throw new Error("Enroll in one of this coach's classes to leave a review.");
    const { error } = await db.from("coach_reviews").upsert(
      {
        coach_id: data.coachId,
        student_id: context.profileId,
        rating: data.rating,
        comment: data.comment ?? "",
      },
      { onConflict: "coach_id,student_id" },
    );
    if (error) throw new Error(error.message);
  });

export type MyEnrollment = {
  class_id: string;
  class_title: string;
  usmle_step: string;
  schedule: string;
  coach_id: string;
  coach_name: string;
};

export const getStudentHome = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(
    async ({
      context,
    }): Promise<{ enrollments: MyEnrollment[]; announcements: ClassAnnouncement[] }> => {
      const db = await adminDb();
      requireStudent(context);
      const { data: enr } = await db
        .from("class_enrollments")
        .select("class_id,coach_classes(id,title,usmle_step,schedule,coach_id,coaches(name))")
        .eq("student_id", context.profileId);
      const enrollments: MyEnrollment[] = (enr ?? [])
        .map((e: any) => e.coach_classes)
        .filter(Boolean)
        .map((c: any) => ({
          class_id: c.id,
          class_title: c.title,
          usmle_step: c.usmle_step,
          schedule: c.schedule,
          coach_id: c.coach_id,
          coach_name: c.coaches?.name ?? "Coach",
        }));

      const classIds = enrollments.map((e) => e.class_id);
      let announcements: ClassAnnouncement[] = [];
      if (classIds.length) {
        const { data: ann } = await db
          .from("class_announcements")
          .select("id,class_id,body,created_at,coach_classes(title)")
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .limit(50);
        announcements = (ann ?? []).map((a: any) => ({
          id: a.id,
          class_id: a.class_id,
          class_title: a.coach_classes?.title ?? "Class",
          body: a.body,
          created_at: a.created_at,
        }));
      }
      return { enrollments, announcements };
    },
  );

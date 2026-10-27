/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  members: number;
};
export type GroupMember = {
  student_id: string;
  role: string;
  students: {
    name: string;
    university: string;
    year_of_study: number;
    xp: number;
    level: number;
  };
};
export type GroupMessage = {
  id: string;
  student_id: string;
  message: string;
  created_at: string;
};
export type GroupResource = {
  id: string;
  resource_type: string;
  resource_ref: string;
  title: string;
  shared_by_student_id: string | null;
};

async function assertMember(db: any, groupId: string, profileId: string) {
  const { data } = await db
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("student_id", profileId)
    .maybeSingle();
  if (!data) throw new Error("You are not a member of this group.");
}

export const getMyGroups = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<GroupSummary[]> => {
    const db = await adminDb();
    const { data } = await db
      .from("group_members")
      .select("group_id, groups(id,name,description,invite_code)")
      .eq("student_id", context.profileId);
    const groups = (data ?? []).map((r: any) => r.groups).filter(Boolean) as Omit<
      GroupSummary,
      "members"
    >[];
    if (groups.length === 0) return [];
    const { data: all } = await db
      .from("group_members")
      .select("group_id")
      .in(
        "group_id",
        groups.map((g) => g.id),
      );
    return groups.map((g) => ({
      ...g,
      members: (all ?? []).filter((m: any) => m.group_id === g.id).length,
    }));
  });

export const joinByCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(10) }).parse(d))
  .handler(async ({ data, context }): Promise<{ groupId: string }> => {
    const db = await adminDb();
    const { data: g } = await db
      .from("groups")
      .select("id")
      .eq("invite_code", data.code.toUpperCase())
      .maybeSingle();
    if (!g) throw new Error("No group found with that code.");
    await db
      .from("group_members")
      .upsert(
        { group_id: g.id, student_id: context.profileId },
        { onConflict: "group_id,student_id", ignoreDuplicates: true },
      );
    return { groupId: g.id as string };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ groupId: string }> => {
    const db = await adminDb();
    const { data: g, error } = await db
      .from("groups")
      .insert({
        name: data.name,
        description: data.description ?? "",
        created_by_student_id: context.profileId,
      })
      .select("id")
      .single();
    if (error || !g) throw new Error(error?.message ?? "Could not create group.");
    await db
      .from("group_members")
      .insert({ group_id: g.id, student_id: context.profileId, role: "team_lead" });
    return { groupId: g.id as string };
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [g, m, ms, r, q] = await Promise.all([
      db.from("groups").select("name,description,invite_code").eq("id", data.groupId).single(),
      db
        .from("group_members")
        .select("student_id, role, students(name,university,year_of_study,xp,level)")
        .eq("group_id", data.groupId),
      db
        .from("group_messages")
        .select("*")
        .eq("group_id", data.groupId)
        .order("created_at")
        .limit(200),
      db
        .from("group_shared_resources")
        .select("*")
        .eq("group_id", data.groupId)
        .order("created_at", { ascending: false }),
      db
        .from("quiz_sessions")
        .select("student_id,score")
        .eq("group_id", data.groupId)
        .not("completed_at", "is", null)
        .gte("completed_at", today.toISOString()),
    ]);
    if (g.error || !g.data) throw new Error("Group not found.");
    return {
      group: g.data as { name: string; description: string; invite_code: string },
      members: (m.data ?? []) as unknown as GroupMember[],
      messages: (ms.data ?? []) as GroupMessage[],
      resources: (r.data ?? []) as GroupResource[],
      quiz: (q.data ?? []).map((x: any) => ({
        student_id: x.student_id as string,
        score: (x.score ?? 0) as number,
      })),
    };
  });

export const listGroupMessages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<GroupMessage[]> => {
    const db = await adminDb();
    const { data: ms } = await db
      .from("group_messages")
      .select("*")
      .eq("group_id", data.groupId)
      .order("created_at")
      .limit(200);
    return (ms ?? []) as GroupMessage[];
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await db
      .from("group_members")
      .upsert(
        { group_id: data.groupId, student_id: context.profileId },
        { onConflict: "group_id,student_id", ignoreDuplicates: true },
      );
  });

export const sendGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ groupId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<GroupMessage | null> => {
    const db = await adminDb();
    await assertMember(db, data.groupId, context.profileId);
    const { data: row } = await db
      .from("group_messages")
      .insert({
        group_id: data.groupId,
        student_id: context.profileId,
        message: data.message.slice(0, 2000),
      })
      .select("*")
      .single();
    return (row as GroupMessage) ?? null;
  });

export const shareGroupResource = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        groupId: z.string().uuid(),
        ref: z.string().trim().min(1).max(1000),
        title: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await assertMember(db, data.groupId, context.profileId);
    const isUrl = /^https?:\/\//.test(data.ref);
    await db.from("group_shared_resources").insert({
      group_id: data.groupId,
      resource_type: isUrl ? "link" : "note",
      resource_ref: data.ref.slice(0, 1000),
      title: data.title || (isUrl ? "Link" : "Note"),
      shared_by_student_id: context.profileId,
    });
  });

export const startTeamCase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        groupId: z.string().uuid(),
        caseId: z.string(),
        caseTitle: z.string().max(200),
        groupName: z.string().max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await assertMember(db, data.groupId, context.profileId);
    await db.from("case_rooms").insert({
      case_id: data.caseId,
      group_id: data.groupId,
      name: `${data.groupName} team`,
      created_by: context.profileId,
    });
    await db.from("group_messages").insert({
      group_id: data.groupId,
      student_id: context.profileId,
      message: `Started a team case: ${data.caseTitle}`,
    });
  });

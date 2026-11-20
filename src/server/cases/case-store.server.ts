// Server-only access to the clinical case bank (`public.clinical_cases`) and
// its image bucket. Never import this from client code: server functions load
// it with a dynamic import inside their handlers.
//
// A row holds the published case students play and, optionally, an
// unpublished draft (a new case or changes to a published one). Every write
// bumps `version`; draft saves and publishes must name the version they were
// based on, so two editors cannot silently overwrite each other.
import type { MedicalCase } from "@/features/case-challenge/schema";
import { checkCaseShape, inspectCase, nextSlug } from "@/features/case-studio/drafts";

export const CASE_IMAGES_BUCKET = "case-images";
export const CASE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const CASE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const TABLE = "clinical_cases";

export interface CaseRow {
  id: string;
  slug: string;
  published: MedicalCase | null;
  draft: MedicalCase | null;
  sort_order: number;
  version: number;
  updated_at: string;
  published_at: string | null;
}

const ROW_COLUMNS = "id,slug,published,draft,sort_order,version,updated_at,published_at";

// The generated Database types predate this table, so queries go through an untyped client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = any;

async function db(): Promise<UntypedClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as UntypedClient;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/* ---- Students ------------------------------------------------------------ */

export async function listPublishedCases(): Promise<MedicalCase[]> {
  const client = await db();
  const { data, error } = await client
    .from(TABLE)
    .select("published")
    .not("published", "is", null)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: true });
  fail(error);
  return ((data ?? []) as { published: MedicalCase }[]).map((row) => row.published);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findPublishedCase(idOrSlug: string): Promise<MedicalCase | null> {
  const client = await db();
  const { data, error } = await client
    .from(TABLE)
    .select("published")
    .eq(UUID.test(idOrSlug) ? "id" : "slug", idOrSlug)
    .not("published", "is", null)
    .maybeSingle();
  fail(error);
  return (data as { published: MedicalCase } | null)?.published ?? null;
}

/* ---- Studio ------------------------------------------------------------ */

export async function listCaseRows(): Promise<CaseRow[]> {
  const client = await db();
  const { data, error } = await client
    .from(TABLE)
    .select(ROW_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  fail(error);
  return (data ?? []) as CaseRow[];
}

export async function getCaseRow(id: string): Promise<CaseRow | null> {
  const client = await db();
  const { data, error } = await client.from(TABLE).select(ROW_COLUMNS).eq("id", id).maybeSingle();
  fail(error);
  return (data as CaseRow | null) ?? null;
}

/**
 * Make a submitted case safe to store: it must have the shape the editor and
 * engine expect, and its id and slug always match the row (the raw JSON
 * editor could otherwise change them). Retired fields are dropped.
 */
export function normalizeDefinition(
  value: unknown,
  row: { id: string; slug: string },
): MedicalCase {
  const problems = checkCaseShape(value);
  if (problems.length) {
    throw new Error(
      `The case is not in the expected format: ${problems[0]!.path} ${problems[0]!.message}`,
    );
  }
  const definition = structuredClone(value) as MedicalCase & { actions: Record<string, unknown>[] };
  definition.id = row.id;
  definition.slug = row.slug;
  for (const action of definition.actions) delete action["isCritical"];
  if (JSON.stringify(definition).length > 2_000_000) {
    throw new Error("The case is too large to save.");
  }
  return definition;
}

async function freeSlug(client: UntypedClient, preferred: string | undefined): Promise<string> {
  const { data, error } = await client.from(TABLE).select("slug");
  fail(error);
  const taken = ((data ?? []) as { slug: string }[]).map((row) => row.slug);
  if (preferred && /^[a-z0-9_]{1,48}$/.test(preferred) && !taken.includes(preferred)) {
    return preferred;
  }
  return nextSlug(taken);
}

/** Store a new, unpublished case. Keeps `preferredId`/`preferredSlug` when they are free. */
export async function insertDraftCase(
  value: unknown,
  userId: string,
  preferred: { id?: string | undefined; slug?: string | undefined } = {},
): Promise<CaseRow> {
  const client = await db();
  let id: string = crypto.randomUUID();
  if (preferred.id && UUID.test(preferred.id) && !(await getCaseRow(preferred.id))) {
    id = preferred.id;
  }
  const slug = await freeSlug(client, preferred.slug);
  const draft = normalizeDefinition(value, { id, slug });
  const { data, error } = await client
    .from(TABLE)
    .insert({ id, slug, draft, created_by: userId, updated_by: userId })
    .select(ROW_COLUMNS)
    .single();
  fail(error);
  return data as CaseRow;
}

export type DraftWrite =
  { status: "saved"; row: CaseRow } | { status: "conflict"; row: CaseRow | null };

/** Replace a row's draft, if nobody else has written since `expectedVersion`. */
export async function writeDraft(
  id: string,
  value: unknown | null,
  expectedVersion: number,
  userId: string,
): Promise<DraftWrite> {
  const client = await db();
  const current = await getCaseRow(id);
  if (!current) return { status: "conflict", row: null };
  const draft = value === null ? null : normalizeDefinition(value, current);
  const { data, error } = await client
    .from(TABLE)
    .update({
      draft,
      version: expectedVersion + 1,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select(ROW_COLUMNS);
  fail(error);
  const row = (data as CaseRow[] | null)?.[0];
  return row ? { status: "saved", row } : { status: "conflict", row: await getCaseRow(id) };
}

export type PublishResult =
  | { status: "published"; row: CaseRow }
  | { status: "invalid"; problems: string[] }
  | { status: "conflict"; row: CaseRow | null };

/** Make the draft what students play. Refuses drafts that fail the automated checks. */
export async function publishDraft(
  id: string,
  expectedVersion: number,
  userId: string,
): Promise<PublishResult> {
  const client = await db();
  const current = await getCaseRow(id);
  if (!current || current.version !== expectedVersion) return { status: "conflict", row: current };
  if (!current.draft) return { status: "invalid", problems: ["There are no changes to publish."] };
  const problems = inspectCase(current.draft)
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message);
  if (problems.length) return { status: "invalid", problems };
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .update({
      published: current.draft,
      draft: null,
      version: expectedVersion + 1,
      updated_by: userId,
      updated_at: now,
      published_by: userId,
      published_at: now,
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select(ROW_COLUMNS);
  fail(error);
  const row = (data as CaseRow[] | null)?.[0];
  return row ? { status: "published", row } : { status: "conflict", row: await getCaseRow(id) };
}

/** Drop unpublished work. A case that was never published is deleted outright. */
export async function discardDraft(id: string, userId: string): Promise<CaseRow | null> {
  const client = await db();
  const current = await getCaseRow(id);
  if (!current) return null;
  if (!current.published) {
    const { error } = await client.from(TABLE).delete().eq("id", id);
    fail(error);
    return null;
  }
  const { data, error } = await client
    .from(TABLE)
    .update({
      draft: null,
      version: current.version + 1,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ROW_COLUMNS)
    .single();
  fail(error);
  return data as CaseRow;
}

/* ---- Images ---------------------------------------------------------------- */

export function safeImageName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const extension = (dot > 0 ? fileName.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${base || "image"}.${extension || "jpg"}`;
}

/**
 * A one-time URL the browser uploads the file to directly (so large images
 * never pass through the app server), plus the public URL it will have.
 */
export async function createImageUpload(
  caseId: string,
  fileName: string,
): Promise<{ uploadUrl: string; publicUrl: string; fileName: string }> {
  const client = await db();
  const stored = `${Date.now().toString(36)}-${safeImageName(fileName)}`;
  const path = `${caseId}/${stored}`;
  const bucket = client.storage.from(CASE_IMAGES_BUCKET);
  const { data, error } = await bucket.createSignedUploadUrl(path);
  fail(error);
  const { data: url } = bucket.getPublicUrl(path);
  return {
    uploadUrl: data.signedUrl as string,
    publicUrl: url.publicUrl as string,
    fileName: stored,
  };
}

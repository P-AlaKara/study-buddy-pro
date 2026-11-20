import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";
import type { MedicalCase } from "@/features/case-challenge/schema";

/*
 * Case studio operations on the shared case bank. Every call re-checks, on
 * the server, that the signed-in account is on the content-creator allowlist
 * (CONTENT_CREATOR_EMAILS); the browser is never trusted with that.
 */

/** A case as the studio sees it: what students play, and any unpublished changes. */
export interface StudioCase {
  id: string;
  slug: string;
  published: MedicalCase | null;
  draft: MedicalCase | null;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
}

async function requireContentCreator(userId: string): Promise<void> {
  const { getUserById } = await import("@/server/auth/users.server");
  const { isContentCreator } = await import("@/server/auth/content-creators.server");
  const user = await getUserById(userId);
  if (!user || user.status !== "active" || !isContentCreator(user.email)) {
    setResponseStatus(403);
    throw new Error("Only content creators can change cases.");
  }
}

function toStudioCase(row: {
  id: string;
  slug: string;
  published: MedicalCase | null;
  draft: MedicalCase | null;
  version: number;
  updated_at: string;
  published_at: string | null;
}): StudioCase {
  return {
    id: row.id,
    slug: row.slug,
    published: row.published,
    draft: row.draft,
    version: row.version,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

const caseId = z.string().uuid();
// The definition is checked structurally by the case store (normalizeDefinition).
const definitionInput = z.record(z.string(), z.unknown());

export const listStudioCases = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<StudioCase[]> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    return (await store.listCaseRows()).map(toStudioCase);
  });

/** Start a new, unpublished case (blank, from a template, or from a file). */
export const createStudioCase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        definition: definitionInput,
        keepIdentity: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<StudioCase> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    const preferred = data.keepIdentity
      ? {
          id: typeof data.definition["id"] === "string" ? data.definition["id"] : undefined,
          slug: typeof data.definition["slug"] === "string" ? data.definition["slug"] : undefined,
        }
      : {};
    return toStudioCase(await store.insertDraftCase(data.definition, context.userId, preferred));
  });

/** Begin changing a published case: its draft starts as a copy of what students see. */
export const reviseStudioCase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: caseId }).parse(input))
  .handler(async ({ data, context }): Promise<StudioCase> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    const row = await store.getCaseRow(data.id);
    if (!row) throw new Error("This case no longer exists.");
    if (row.draft || !row.published) return toStudioCase(row);
    const result = await store.writeDraft(row.id, row.published, row.version, context.userId);
    if (result.status === "saved") return toStudioCase(result.row);
    const latest = result.row ?? (await store.getCaseRow(data.id));
    if (!latest) throw new Error("This case no longer exists.");
    return toStudioCase(latest);
  });

export type SaveDraftResult =
  { status: "saved"; case: StudioCase } | { status: "conflict"; case: StudioCase | null };

export const saveStudioDraft = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        id: caseId,
        definition: definitionInput,
        expectedVersion: z.number().int().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SaveDraftResult> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    const result = await store.writeDraft(
      data.id,
      data.definition,
      data.expectedVersion,
      context.userId,
    );
    return result.status === "saved"
      ? { status: "saved", case: toStudioCase(result.row) }
      : { status: "conflict", case: result.row ? toStudioCase(result.row) : null };
  });

export type PublishCaseResult =
  | { status: "published"; case: StudioCase }
  | { status: "invalid"; problems: string[] }
  | { status: "conflict"; case: StudioCase | null };

export const publishStudioCase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ id: caseId, expectedVersion: z.number().int().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PublishCaseResult> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    const result = await store.publishDraft(data.id, data.expectedVersion, context.userId);
    if (result.status === "published")
      return { status: "published", case: toStudioCase(result.row) };
    if (result.status === "invalid") return result;
    return { status: "conflict", case: result.row ? toStudioCase(result.row) : null };
  });

/** Throw away unpublished changes; a never-published case is deleted. */
export const discardStudioDraft = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: caseId }).parse(input))
  .handler(async ({ data, context }): Promise<StudioCase | null> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    const row = await store.discardDraft(data.id, context.userId);
    return row ? toStudioCase(row) : null;
  });

export interface ImageUploadTarget {
  uploadUrl: string;
  publicUrl: string;
  fileName: string;
}

/** A one-time URL to upload a case image straight to storage from the browser. */
export const createCaseImageUpload = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId,
        fileName: z.string().trim().min(1).max(200),
        contentType: z.string(),
        size: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ImageUploadTarget> => {
    await requireContentCreator(context.userId);
    const store = await import("@/server/cases/case-store.server");
    if (!(store.CASE_IMAGE_TYPES as readonly string[]).includes(data.contentType)) {
      throw new Error("Use a JPEG, PNG, WebP or GIF image.");
    }
    if (data.size > store.CASE_IMAGE_MAX_BYTES) {
      throw new Error("Images can be at most 10 MB.");
    }
    if (!(await store.getCaseRow(data.caseId)))
      throw new Error("Save the case before adding images.");
    return store.createImageUpload(data.caseId, data.fileName);
  });

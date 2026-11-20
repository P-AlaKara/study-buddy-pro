import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";
import { summarizeCase, type CaseSummary, type NextCase } from "./case-summary";
import { FEATURED_CASE_ID } from "./config";
import type { MedicalCase } from "./schema";

/*
 * Published cases for students, read from Supabase (`public.clinical_cases`).
 * Content creators publish them from the case studio; nothing here returns
 * unpublished drafts.
 */

export const listPublishedCases = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<CaseSummary[]> => {
    const { listPublishedCases: list } = await import("@/server/cases/case-store.server");
    return (await list()).map(summarizeCase);
  });

export interface PlayableCase {
  definition: MedicalCase;
  nextCase: NextCase | null;
}

export const getPublishedCase = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ idOrSlug: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data }): Promise<PlayableCase | null> => {
    const { listPublishedCases: list } = await import("@/server/cases/case-store.server");
    const cases = await list();
    const index = cases.findIndex(
      (item) => item.id === data.idOrSlug || item.slug === data.idOrSlug,
    );
    const definition = cases[index];
    if (!definition) return null;
    const next = cases.length > 1 ? cases[(index + 1) % cases.length] : undefined;
    return {
      definition,
      nextCase: next ? { id: next.id, title: next.title } : null,
    };
  });

/** The case shown on the home screen: the configured one, else the first published. */
export const getFeaturedCase = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<CaseSummary | null> => {
    const { listPublishedCases: list } = await import("@/server/cases/case-store.server");
    const cases = await list();
    const featured =
      cases.find((item) => item.id === FEATURED_CASE_ID || item.slug === FEATURED_CASE_ID) ??
      cases[0];
    return featured ? summarizeCase(featured) : null;
  });

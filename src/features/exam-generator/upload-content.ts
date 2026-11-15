// Wire format between browser-side extraction and createExamFromUploads. The
// browser reads each file locally and sends only its text as JSON; the server
// re-validates everything here (it never sees the original file). Pure.
import { z } from "zod";
import { MAX_FILES, type DocumentExtraction, type ExtractedUnit } from "./extract-text";
import type { SourceDocumentMeta } from "./types";

const MAX_UNITS_PER_DOCUMENT = 20_000;

const uploadedDocumentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: z.enum(["pdf", "pptx"]),
  unitCount: z.number().int().min(1).max(MAX_UNITS_PER_DOCUMENT),
  units: z
    .array(
      z.object({
        unit: z.number().int().min(1).max(MAX_UNITS_PER_DOCUMENT),
        text: z.string().max(200_000),
      }),
    )
    .max(MAX_UNITS_PER_DOCUMENT),
  warning: z.string().max(1000).nullable(),
});

export const uploadedContentSchema = z
  .object({
    documents: z.array(uploadedDocumentSchema).max(MAX_FILES),
    /** Files the browser couldn't read; surfaced as generation warnings. */
    skipped: z
      .array(z.object({ name: z.string().max(255), reason: z.string().max(1000) }))
      .max(MAX_FILES),
  })
  .refine((c) => c.documents.length + c.skipped.length <= MAX_FILES, {
    message: `Upload at most ${MAX_FILES} files at once.`,
  });

export type UploadedContent = z.infer<typeof uploadedContentSchema>;

/** Browser side: package local extractions for the server. */
export function buildUploadedContent(
  extractions: DocumentExtraction[],
  skipped: { name: string; reason: string }[],
): UploadedContent {
  return {
    documents: extractions.map((e) => ({
      name: e.name,
      kind: e.kind,
      unitCount: e.unitCount,
      units: e.units.map((u) => ({ unit: u.unit, text: u.text })),
      warning: e.warning,
    })),
    skipped,
  };
}

/** Server side: validate the payload and flatten it into pipeline units. */
export function parseUploadedContent(raw: unknown): {
  units: ExtractedUnit[];
  sourceDocuments: SourceDocumentMeta[];
  warnings: string[];
} {
  const parsed = uploadedContentSchema.safeParse(raw);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.find((i) => i.message.startsWith("Upload at most"));
    throw new Error(tooMany?.message ?? "Your material couldn’t be read. Please try again.");
  }
  const { documents, skipped } = parsed.data;

  const units: ExtractedUnit[] = [];
  const sourceDocuments: SourceDocumentMeta[] = [];
  const warnings = skipped.map((s) => `“${s.name}”: ${s.reason}`);

  for (const doc of documents) {
    const unitKind = doc.kind === "pdf" ? "page" : "slide";
    const readable = doc.units
      .map((u) => ({ unit: u.unit, text: u.text.trim() }))
      .filter((u) => u.text.length > 0);
    if (readable.length === 0) {
      warnings.push(`“${doc.name}”: No readable text was found in this file.`);
      continue;
    }
    for (const u of readable) {
      units.push({ document: doc.name, unitKind, unit: u.unit, text: u.text });
    }
    sourceDocuments.push({
      name: doc.name,
      kind: doc.kind,
      unitCount: Math.max(doc.unitCount, readable.length),
    });
    if (doc.warning) warnings.push(doc.warning);
  }

  if (units.length === 0) {
    throw new Error(warnings[0] ?? "None of the uploaded files contained readable text.");
  }
  return { units, sourceDocuments, warnings };
}

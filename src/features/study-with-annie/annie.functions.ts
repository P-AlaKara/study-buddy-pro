/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateQuizCandidates, sentenceCandidates } from "./candidate-validation";
import { ANNIE_SYSTEM_PROMPT, DEFAULT_READER_PREFERENCES } from "./config";
import { requireStudyWithAnnieEnabled } from "./feature-flag";
import { chunkPageText, contextAroundSelection, normalizePdfText } from "./text-mapping";
import type {
  AnnieAnnotation,
  AnnieDocument,
  ExplanationResult,
  PageOverview,
  PageText,
  QuizResult,
  ReaderPreferences,
  ReaderPayload,
  RecallChallenge,
  RecallEvaluation,
  SessionSummary,
} from "./types";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const STORAGE_BUCKET = "annie-notes";
const RUNTIME_LLM_CALL_LIMIT = 20;

const idSchema = z.object({ documentId: z.string().uuid() });
const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "sepia"]),
});
const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});
const annotationSchema = z.object({
  id: z.string().uuid().optional(),
  documentId: z.string().uuid(),
  type: z.enum(["highlight", "note", "bookmark"]),
  page: z.number().int().positive(),
  geometry: z.array(rectSchema).max(100),
  color: z.string().max(32).nullable(),
  content: z.string().max(4000).nullable(),
  selectedText: z.string().max(8000).nullable(),
});

const generatedCandidatesSchema = z.object({
  candidate_blotouts: z.array(
    z.object({
      page: z.number().int().positive(),
      text: z.string().min(1),
      question_prompt: z.string().min(1).max(300),
      difficulty: z.number().int().min(1).max(3),
    }),
  ),
});

const evaluationSchema = z.object({
  verdict: z.enum(["correct", "partially_correct", "incorrect"]),
  feedback: z.string().min(1).max(500),
  correct_explanation: z.string().min(1).max(700),
});

const overviewSchema = z.object({
  summary: z.string().min(1).max(1200),
  learning_objectives: z.array(z.string().min(1).max(240)).min(1).max(5),
  key_concepts: z.array(z.string().min(1).max(240)).min(1).max(6),
});

const explanationSchema = z.object({
  explanation: z.string().min(1).max(1800),
  terms: z
    .array(z.object({ term: z.string().min(1).max(100), definition: z.string().min(1).max(400) }))
    .max(6),
  memory_aid: z.string().min(1).max(500).nullable(),
});

const recallGenerationSchema = z.object({
  target_text: z.string().min(1).max(1200),
  question: z.string().min(1).max(400),
});

async function adminDb() {
  requireStudyWithAnnieEnabled();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function safeTitle(name: string) {
  const title = name
    .replace(/\.pdf$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  return (title || "Untitled notes").slice(0, 180);
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

// PDF.js references browser globals (notably `new DOMMatrix()` at module top level)
// that don't exist in the Node/serverless runtime where we extract text. Without
// them the import itself throws "DOMMatrix is not defined". We only read text and
// never rasterise, so minimal pure-JS polyfills are enough and avoid pulling in a
// native canvas dependency. Must run before importing PDF.js.
function ensurePdfServerGlobals() {
  const globalObject = globalThis as Record<string, unknown>;

  if (typeof globalObject["DOMMatrix"] === "undefined") {
    class DOMMatrixPolyfill {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(init?: number[] | Float32Array | Float64Array | string) {
        if (Array.isArray(init) || init instanceof Float32Array || init instanceof Float64Array) {
          const values = Array.from(init);
          if (values.length === 6) {
            this.a = values[0]!;
            this.b = values[1]!;
            this.c = values[2]!;
            this.d = values[3]!;
            this.e = values[4]!;
            this.f = values[5]!;
          } else if (values.length === 16) {
            this.a = values[0]!;
            this.b = values[1]!;
            this.c = values[4]!;
            this.d = values[5]!;
            this.e = values[12]!;
            this.f = values[13]!;
          }
        }
      }

      private clone() {
        return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]);
      }

      multiplySelf(other: DOMMatrixPolyfill) {
        const a = this.a * other.a + this.c * other.b;
        const b = this.b * other.a + this.d * other.b;
        const c = this.a * other.c + this.c * other.d;
        const d = this.b * other.c + this.d * other.d;
        const e = this.a * other.e + this.c * other.f + this.e;
        const f = this.b * other.e + this.d * other.f + this.f;
        Object.assign(this, { a, b, c, d, e, f });
        return this;
      }

      preMultiplySelf(other: DOMMatrixPolyfill) {
        return this.multiplySelf(other);
      }

      multiply(other: DOMMatrixPolyfill) {
        return this.clone().multiplySelf(other);
      }

      translateSelf(tx = 0, ty = 0) {
        this.e += this.a * tx + this.c * ty;
        this.f += this.b * tx + this.d * ty;
        return this;
      }

      scaleSelf(sx = 1, sy = sx) {
        this.a *= sx;
        this.b *= sx;
        this.c *= sy;
        this.d *= sy;
        return this;
      }

      translate(tx?: number, ty?: number) {
        return this.clone().translateSelf(tx, ty);
      }

      scale(sx?: number, sy?: number) {
        return this.clone().scaleSelf(sx, sy);
      }

      invertSelf() {
        const det = this.a * this.d - this.b * this.c;
        if (!det) {
          Object.assign(this, { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 });
          return this;
        }
        const a = this.d / det;
        const b = -this.b / det;
        const c = -this.c / det;
        const d = this.a / det;
        const e = (this.c * this.f - this.d * this.e) / det;
        const f = (this.b * this.e - this.a * this.f) / det;
        Object.assign(this, { a, b, c, d, e, f });
        return this;
      }
    }
    globalObject["DOMMatrix"] = DOMMatrixPolyfill;
  }

  if (typeof globalObject["Path2D"] === "undefined") {
    class Path2DPolyfill {
      addPath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      rect() {}
      closePath() {}
    }
    globalObject["Path2D"] = Path2DPolyfill;
  }

  if (typeof globalObject["ImageData"] === "undefined") {
    class ImageDataPolyfill {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(Math.max(0, width * height * 4));
      }
    }
    globalObject["ImageData"] = ImageDataPolyfill;
  }
}

// In Node, PDF.js defaults to a "fake worker" that is set up by dynamically
// importing "./pdf.worker.mjs" *relative to the bundled module*. In a bundled
// serverless deployment (our Vercel target) that relative specifier isn't
// resolvable at runtime, so the import throws and PDF.js rejects with
// `Setting up fake worker failed: "Cannot find module './pdf.worker.mjs'"`.
// That message hits the "worker"/"module" branch of friendlyProcessingError and
// is the root cause of the frequent "we couldn't prepare this PDF" errors.
//
// Registering the worker's message handler on globalThis makes PDF.js use it
// directly (see PDFWorker._setupFakeWorkerGlobal) and skip the fragile dynamic
// import entirely. The static specifier below is bundled normally, so the code
// is always present in the deployed function.
let pdfWorkerReady: Promise<void> | null = null;
function ensurePdfWorker() {
  pdfWorkerReady ??= (async () => {
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as Record<string, unknown>)["pdfjsWorker"] = workerModule;
  })();
  return pdfWorkerReady;
}

const PDF_EXTRACTION_ATTEMPTS = 2;

type ExtractedPage = { page: number; text: string; layout_data: unknown[] };

async function extractPdfPagesOnce(bytes: Uint8Array): Promise<ExtractedPage[]> {
  ensurePdfServerGlobals();
  await ensurePdfWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Pass a fresh copy: PDF.js may transfer/detach the underlying ArrayBuffer,
  // which would break any retry that reuses the same bytes.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    // Only surface genuine errors; otherwise PDF.js floods logs with per-glyph
    // and missing-font warnings for ordinary notes.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const document = await task.promise;
  try {
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      let page: Awaited<ReturnType<typeof document.getPage>> | undefined;
      try {
        page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const layout = content.items.flatMap((item) => {
          if (!("str" in item)) return [];
          const transform = item.transform as number[];
          return [
            {
              text: item.str,
              x: transform[4] ?? 0,
              y: transform[5] ?? 0,
              width: item.width,
              height: item.height,
            },
          ];
        });
        const text = content.items
          .flatMap((item) => ("str" in item && item.str.trim() ? [item.str.trim()] : []))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push({ page: pageNumber, text, layout_data: layout });
      } catch (pageError) {
        // A single malformed page shouldn't sink the whole document. Keep its
        // slot (with empty text) so page numbering stays aligned with the PDF.
        console.error("[Annie] Failed to read page", pageNumber, pageError);
        pages.push({ page: pageNumber, text: "", layout_data: [] });
      } finally {
        page?.cleanup();
      }
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

async function extractPdfPages(bytes: Uint8Array): Promise<ExtractedPage[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PDF_EXTRACTION_ATTEMPTS; attempt += 1) {
    try {
      return await extractPdfPagesOnce(bytes);
    } catch (error) {
      lastError = error;
      if (attempt < PDF_EXTRACTION_ATTEMPTS) {
        console.warn(`[Annie] PDF extraction attempt ${attempt} failed; retrying`, error);
      }
    }
  }
  throw lastError;
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

// Gemini occasionally wraps JSON in Markdown fences or adds stray prose even with
// responseMimeType set. Pull out the first balanced JSON object before parsing.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

async function geminiJson<T>(
  prompt: string,
  parser: z.ZodType<T>,
  retryMalformed = true,
): Promise<T | null> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return null;
  const model = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 4096,
            // Gemini uses responseMimeType (not responseFormat) to request JSON.
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    let json: unknown;
    try {
      json = JSON.parse(extractJson(text));
    } catch {
      return retryMalformed ? geminiJson(prompt, parser, false) : null;
    }
    const parsed = parser.safeParse(json);
    if (parsed.success) return parsed.data;
    if (retryMalformed) return geminiJson(prompt, parser, false);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateCandidates(pages: Array<{ page: number; text: string }>) {
  const pageMap = new Map(pages.map((page) => [page.page, page.text]));
  const fallbackQuizzes = pages.flatMap((page) => sentenceCandidates(page.page, page.text));

  const generatedQuizzes: ReturnType<typeof sentenceCandidates> = [];

  const batches: (typeof pages)[] = [];
  let batch: typeof pages = [];
  let size = 0;
  for (const page of pages) {
    if (batch.length && size + page.text.length > 24_000) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(page);
    size += page.text.length;
  }
  if (batch.length) batches.push(batch);

  for (const group of batches) {
    const notes = group.map((page) => `PAGE ${page.page}\n${page.text}`).join("\n\n");
    const response = await geminiJson(
      `${ANNIE_SYSTEM_PROMPT} Identify important definitions, mechanisms, relationships, or explanations suitable for active recall. The target text MUST be an exact substring copied from its page. Return 1-3 useful items per substantive page.\n\nRespond with JSON of exactly this shape: {"candidate_blotouts":[{"page":<integer>,"text":<exact page substring>,"question_prompt":<string>,"difficulty":<1|2|3>}]}. Use at most 18 items.\n\n${notes}`,
      generatedCandidatesSchema,
    );
    if (response) {
      generatedQuizzes.push(...validateQuizCandidates(pageMap, response.candidate_blotouts));
    }
  }

  return generatedQuizzes.length ? generatedQuizzes : fallbackQuizzes;
}

// Translate low-level processing failures (PDF.js internals, runtime globals,
// network blips) into a short, reassuring message the student can act on, while
// the technical detail is logged server-side for debugging.
function friendlyProcessingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException" || /password|encrypted/i.test(raw)) {
    return "This PDF is password-protected. Remove the password and upload it again.";
  }
  if (name === "InvalidPDFException" || /invalid pdf|corrupt|structure/i.test(raw)) {
    return "This file doesn’t look like a readable PDF. Please check it and try again.";
  }
  if (/DOMMatrix|is not defined|canvas|worker|module/i.test(raw)) {
    return "We couldn’t prepare this PDF just now. Please try again in a moment.";
  }
  return "We couldn’t prepare this PDF. Please try again, or upload a different file.";
}

async function ownedDocument(db: any, documentId: string, userId: string, columns = "*") {
  const { data, error } = await db
    .from("annie_documents")
    .select(columns)
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Document not found");
  return data;
}

export const listAnnieDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnnieDocument[]> => {
    const db = await adminDb();
    const { data, error } = await db
      .from("annie_documents")
      .select("id,title,page_count,status,processing_error,last_opened_at,last_page,created_at")
      .eq("user_id", context.userId)
      .order("last_opened_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const uploadAnnieDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: FormData) => input)
  .handler(async ({ data, context }): Promise<AnnieDocument> => {
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a PDF to upload.");
    if (file.size === 0 || file.size > MAX_PDF_BYTES)
      throw new Error("PDFs must be between 1 byte and 25 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type !== "application/pdf" || !isPdf(bytes))
      throw new Error("That file is not a valid PDF.");

    const db = await adminDb();
    const documentId = crypto.randomUUID();
    const filePath = `${context.userId}/${documentId}.pdf`;
    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: document, error } = await db
      .from("annie_documents")
      .insert({
        id: documentId,
        user_id: context.userId,
        title: safeTitle(file.name),
        file_path: filePath,
        status: "processing",
      })
      .select("id,title,page_count,status,processing_error,last_opened_at,last_page,created_at")
      .single();
    if (error || !document) {
      await db.storage.from(STORAGE_BUCKET).remove([filePath]);
      throw new Error(error?.message ?? "The document could not be saved.");
    }
    return document;
  });

export const processAnnieDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(
    async ({ data, context }): Promise<{ status: "ready" | "failed"; error: string | null }> => {
      const db = await adminDb();
      const document = await ownedDocument(
        db,
        data.documentId,
        context.userId,
        "id,file_path,status,processing_attempts",
      );
      if (document.status === "ready") return { status: "ready", error: null };

      await db
        .from("annie_documents")
        .update({
          status: "processing",
          processing_error: null,
          processing_attempts: (document.processing_attempts ?? 0) + 1,
        })
        .eq("id", document.id)
        .eq("user_id", context.userId);

      try {
        const { data: blob, error: downloadError } = await db.storage
          .from(STORAGE_BUCKET)
          .download(document.file_path);
        if (downloadError || !blob)
          throw new Error(downloadError?.message ?? "The PDF could not be read.");
        const pages = await extractPdfPages(new Uint8Array(await blob.arrayBuffer()));
        const characterCount = pages.reduce((sum, page) => sum + page.text.length, 0);
        if (characterCount < Math.max(30, pages.length * 10)) {
          const message = "This PDF appears to be scanned. Scanned notes are not supported yet.";
          await db
            .from("annie_documents")
            .update({ status: "failed", processing_error: message, page_count: pages.length })
            .eq("id", document.id)
            .eq("user_id", context.userId);
          return { status: "failed", error: message };
        }

        const candidates = await generateCandidates(pages);
        await Promise.all([
          db.from("annie_page_texts").delete().eq("document_id", document.id),
          db.from("annie_quiz_candidates").delete().eq("document_id", document.id),
          db.from("annie_commentary_candidates").delete().eq("document_id", document.id),
          db.from("annie_page_overviews").delete().eq("document_id", document.id),
        ]);
        const { error: pageError } = await db.from("annie_page_texts").insert(
          pages.map((page) => ({
            document_id: document.id,
            page: page.page,
            text: page.text,
            layout_data: page.layout_data,
          })),
        );
        if (pageError) throw new Error(pageError.message);
        if (candidates.length) {
          const { error } = await db.from("annie_quiz_candidates").insert(
            candidates.map((candidate) => ({
              document_id: document.id,
              page: candidate.page,
              text: candidate.text,
              prompt: candidate.question_prompt,
              difficulty: candidate.difficulty,
            })),
          );
          if (error) throw new Error(error.message);
        }
        await db
          .from("annie_documents")
          .update({ status: "ready", processing_error: null, page_count: pages.length })
          .eq("id", document.id)
          .eq("user_id", context.userId);
        return { status: "ready", error: null };
      } catch (error) {
        console.error("[Annie] Failed to process document", document.id, error);
        const message = friendlyProcessingError(error);
        await db
          .from("annie_documents")
          .update({ status: "failed", processing_error: message })
          .eq("id", document.id)
          .eq("user_id", context.userId);
        return { status: "failed", error: message };
      }
    },
  );

export const deleteAnnieDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const document = await ownedDocument(db, data.documentId, context.userId, "id,file_path");
    await db.storage.from(STORAGE_BUCKET).remove([document.file_path]);
    const { error } = await db
      .from("annie_documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const openAnnieDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }): Promise<ReaderPayload> => {
    const db = await adminDb();
    const document = await ownedDocument(db, data.documentId, context.userId);
    if (document.status !== "ready") throw new Error("This document is not ready yet.");

    const [pageResult, annotationResult, settingsResult] = await Promise.all([
      db
        .from("annie_page_texts")
        .select("page,text,layout_data")
        .eq("document_id", document.id)
        .order("page"),
      db
        .from("annie_annotations")
        .select("*")
        .eq("document_id", document.id)
        .eq("user_id", context.userId)
        .order("created_at"),
      db.from("user_annie_settings").select("theme").eq("user_id", context.userId).maybeSingle(),
    ]);
    for (const result of [pageResult, annotationResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const preferences = (settingsResult.data ?? DEFAULT_READER_PREFERENCES) as ReaderPreferences;
    if (!settingsResult.data) {
      await db
        .from("user_annie_settings")
        .upsert({ user_id: context.userId, ...DEFAULT_READER_PREFERENCES });
    }
    const { data: signed, error: signedError } = await db.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.file_path, 60 * 60);
    if (signedError || !signed?.signedUrl) throw new Error("The PDF could not be opened.");

    const { data: session, error: sessionError } = await db
      .from("annie_study_sessions")
      .insert({ user_id: context.userId, document_id: document.id })
      .select("id")
      .single();
    if (sessionError || !session) throw new Error("The study session could not be started.");
    await db
      .from("annie_documents")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", document.id)
      .eq("user_id", context.userId);

    return {
      document: {
        id: document.id,
        title: document.title,
        page_count: document.page_count,
        status: document.status,
        processing_error: document.processing_error,
        last_opened_at: document.last_opened_at,
        last_page: Math.min(document.page_count ?? 1, Math.max(1, document.last_page ?? 1)),
        created_at: document.created_at,
      },
      fileUrl: signed.signedUrl,
      pages: (pageResult.data ?? []) as PageText[],
      annotations: (annotationResult.data ?? []) as AnnieAnnotation[],
      preferences,
      sessionId: session.id,
    };
  });

export const saveAnnieAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => annotationSchema.parse(input))
  .handler(async ({ data, context }): Promise<AnnieAnnotation> => {
    const db = await adminDb();
    await ownedDocument(db, data.documentId, context.userId, "id");
    const values = {
      document_id: data.documentId,
      user_id: context.userId,
      type: data.type,
      page: data.page,
      geometry: data.geometry,
      color: data.color,
      content: data.content,
      selected_text: data.selectedText,
    };
    const query = data.id
      ? db.from("annie_annotations").update(values).eq("id", data.id).eq("user_id", context.userId)
      : db.from("annie_annotations").insert(values);
    const { data: annotation, error } = await query.select("*").single();
    if (error || !annotation)
      throw new Error(error?.message ?? "The annotation could not be saved.");
    return annotation as AnnieAnnotation;
  });

export const deleteAnnieAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ annotationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { error } = await db
      .from("annie_annotations")
      .delete()
      .eq("id", data.annotationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveReaderPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => preferencesSchema.parse(input))
  .handler(async ({ data, context }): Promise<ReaderPreferences> => {
    const db = await adminDb();
    const { data: settings, error } = await db
      .from("user_annie_settings")
      .upsert({ user_id: context.userId, ...data })
      .select("theme")
      .single();
    if (error || !settings)
      throw new Error(error?.message ?? "Reader settings could not be saved.");
    return settings as ReaderPreferences;
  });

export const saveReadingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), page: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const document = await ownedDocument(db, data.documentId, context.userId, "id,page_count");
    const page = Math.min(document.page_count ?? data.page, data.page);
    const { error } = await db
      .from("annie_documents")
      .update({ last_page: page })
      .eq("id", document.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { page, progress: document.page_count ? page / document.page_count : 0 };
  });

async function spendLlmCall(db: any, sessionId: string, userId: string) {
  const { data } = await db
    .from("annie_study_sessions")
    .select("stats")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const calls = typeof stats["llm_calls"] === "number" ? stats["llm_calls"] : 0;
  if (calls >= RUNTIME_LLM_CALL_LIMIT) return false;
  await db
    .from("annie_study_sessions")
    .update({ stats: { ...stats, llm_calls: calls + 1 } })
    .eq("id", sessionId)
    .eq("user_id", userId);
  return true;
}

async function pageTextForOwner(db: any, documentId: string, page: number, userId: string) {
  const document = await ownedDocument(db, documentId, userId, "id,title,page_count");
  if (page > (document.page_count ?? page)) throw new Error("Page not found.");
  const { data, error } = await db
    .from("annie_page_texts")
    .select("text")
    .eq("document_id", documentId)
    .eq("page", page)
    .single();
  if (error || !data?.text?.trim()) {
    throw new Error(
      "An accurate response is unavailable because text could not be extracted from this page.",
    );
  }
  return { text: data.text as string, title: document.title as string };
}

async function createOverview(text: string, title: string, page: number) {
  const chunks = chunkPageText(text);
  const partials: z.infer<typeof overviewSchema>[] = [];
  for (const chunk of chunks) {
    const overview = await geminiJson(
      `${ANNIE_SYSTEM_PROMPT}\nCreate a quick orientation for page ${page} of “${title}”. State what the student will learn and the concepts worth remembering. Be concise and use only the supplied page text.\n\nRespond as JSON: {"summary":<string>,"learning_objectives":[<string>],"key_concepts":[<string>]}.\n\nPAGE TEXT:\n${chunk}`,
      overviewSchema,
    );
    if (!overview) return null;
    partials.push(overview);
  }
  if (partials.length === 1) return partials[0]!;
  return geminiJson(
    `${ANNIE_SYSTEM_PROMPT}\nCombine these grounded partial page overviews into one concise orientation without adding facts. Respond as JSON: {"summary":<string>,"learning_objectives":[<string>],"key_concepts":[<string>]}.\n\nPARTIAL OVERVIEWS:\n${JSON.stringify(partials)}`,
    overviewSchema,
  );
}

export const generatePageOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        page: z.number().int().positive(),
        sessionId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PageOverview> => {
    const db = await adminDb();
    await ownedDocument(db, data.documentId, context.userId, "id");
    const { data: cached } = await db
      .from("annie_page_overviews")
      .select("summary,learning_objectives,key_concepts")
      .eq("document_id", data.documentId)
      .eq("page", data.page)
      .maybeSingle();
    if (cached) {
      return {
        page: data.page,
        summary: cached.summary,
        learningObjectives: cached.learning_objectives ?? [],
        keyConcepts: cached.key_concepts ?? [],
      };
    }
    const source = await pageTextForOwner(db, data.documentId, data.page, context.userId);
    if (!(await spendLlmCall(db, data.sessionId, context.userId)))
      throw new Error("Annie has reached the AI limit for this study session.");
    const overview = await createOverview(source.text, source.title, data.page);
    if (!overview) throw new Error("An accurate page overview could not be generated right now.");
    const { error } = await db.from("annie_page_overviews").upsert({
      document_id: data.documentId,
      page: data.page,
      summary: overview.summary,
      learning_objectives: overview.learning_objectives,
      key_concepts: overview.key_concepts,
    });
    if (error)
      console.error("[Annie] overview cache write failed", {
        documentId: data.documentId,
        page: data.page,
        error: error.message,
      });
    return {
      page: data.page,
      summary: overview.summary,
      learningObjectives: overview.learning_objectives,
      keyConcepts: overview.key_concepts,
    };
  });

export const explainSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        page: z.number().int().positive(),
        sessionId: z.string().uuid(),
        selectedText: z.string().trim().min(2).max(8000),
        followUpQuestion: z.string().trim().min(2).max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ExplanationResult> => {
    const db = await adminDb();
    const source = await pageTextForOwner(db, data.documentId, data.page, context.userId);
    const surrounding = contextAroundSelection(source.text, data.selectedText);
    if (!surrounding) throw new Error("The selected text could not be matched to this page.");
    if (!(await spendLlmCall(db, data.sessionId, context.userId)))
      throw new Error("Annie has reached the AI limit for this study session.");
    const followUp = data.followUpQuestion ? `\nFOLLOW-UP QUESTION:\n${data.followUpQuestion}` : "";
    const response = await geminiJson(
      `${ANNIE_SYSTEM_PROMPT}\nExplain the selected material so it is intuitive without oversimplifying it. Define unfamiliar terms. Add a memory aid only when it is accurate and genuinely useful. Answer a follow-up only in relation to this selection.\n\nRespond as JSON: {"explanation":<string>,"terms":[{"term":<string>,"definition":<string>}],"memory_aid":<string|null>}.\n\nSELECTED TEXT:\n${data.selectedText}\n\nSURROUNDING PAGE CONTEXT:\n${surrounding}${followUp}`,
      explanationSchema,
    );
    if (!response) throw new Error("An accurate explanation could not be generated right now.");
    return {
      explanation: response.explanation,
      terms: response.terms,
      memoryAid: response.memory_aid,
    };
  });

export const generateRecallChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        page: z.number().int().positive(),
        sessionId: z.string().uuid(),
        selectedText: z.string().trim().min(2).max(8000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RecallChallenge> => {
    const db = await adminDb();
    const source = await pageTextForOwner(db, data.documentId, data.page, context.userId);
    let { data: candidates } = await db
      .from("annie_quiz_candidates")
      .select("id,page,text,prompt,difficulty")
      .eq("document_id", data.documentId)
      .eq("page", data.page)
      .order("difficulty", { ascending: true });
    if (data.selectedText) {
      const selected = normalizePdfText(data.selectedText);
      candidates = (candidates ?? []).filter((candidate: any) =>
        selected.includes(normalizePdfText(candidate.text)),
      );
    }
    if (candidates?.length) {
      const candidateIds = candidates.map((candidate: any) => candidate.id);
      const { data: attempts } = await db
        .from("annie_quiz_attempts")
        .select("candidate_id,result,created_at")
        .eq("user_id", context.userId)
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false });
      const rank = (candidate: any) => {
        const latest = (attempts ?? []).find(
          (attempt: any) => attempt.candidate_id === candidate.id,
        );
        if (!latest) return 0;
        if (latest.result === "incorrect") return 1;
        if (latest.result === "partially_correct") return 2;
        if (latest.result === "skipped") return 3;
        return 4;
      };
      candidates.sort((left: any, right: any) => rank(left) - rank(right));
    }
    let candidate = candidates?.[0] ?? null;
    if (!candidate) {
      if (!(await spendLlmCall(db, data.sessionId, context.userId)))
        throw new Error("Annie has reached the AI limit for this study session.");
      const focus =
        data.selectedText && contextAroundSelection(source.text, data.selectedText)
          ? data.selectedText
          : source.text.slice(0, 12_000);
      const generated = await geminiJson(
        `${ANNIE_SYSTEM_PROMPT}\nChoose one meaningful definition, mechanism, relationship, or explanation for active recall. target_text must be an exact substring of the supplied text and should be reasonable to recall. Respond as JSON: {"target_text":<exact substring>,"question":<concise conceptual prompt>}.\n\nTEXT:\n${focus}`,
        recallGenerationSchema,
      );
      if (!generated || !source.text.includes(generated.target_text))
        throw new Error("No suitable recall passage could be found on this page.");
      const { data: inserted, error } = await db
        .from("annie_quiz_candidates")
        .upsert(
          {
            document_id: data.documentId,
            page: data.page,
            text: generated.target_text,
            prompt: generated.question,
            difficulty: 2,
          },
          { onConflict: "document_id,page,text" },
        )
        .select("id,page,text,prompt")
        .single();
      if (error || !inserted)
        throw new Error(error?.message ?? "The recall challenge could not be prepared.");
      candidate = inserted;
    }
    return {
      id: candidate.id,
      page: candidate.page,
      prompt: candidate.prompt,
      targetText: candidate.text,
    };
  });

export const evaluateRecallAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        sessionId: z.string().uuid(),
        studentAnswer: z.string().trim().min(1).max(1500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RecallEvaluation> => {
    const db = await adminDb();
    const { data: candidate, error } = await db
      .from("annie_quiz_candidates")
      .select("id,text,document_id,annie_documents!inner(user_id)")
      .eq("id", data.challengeId)
      .eq("annie_documents.user_id", context.userId)
      .single();
    if (error || !candidate) throw new Error("Recall passage not found.");
    if (!(await spendLlmCall(db, data.sessionId, context.userId)))
      throw new Error("Annie has reached the AI limit for this study session.");
    const evaluation = await geminiJson(
      `${ANNIE_SYSTEM_PROMPT}\nEvaluate conceptual understanding against only the source passage. Accept accurate paraphrases and tolerate typos. Do not require exact wording. A correct verdict requires the essential meaning; partial means a key point is missing; incorrect means the central meaning is wrong.\n\nRespond as JSON: {"verdict":"correct"|"partially_correct"|"incorrect","feedback":<concise specific feedback>,"correct_explanation":<concise grounded explanation>}.\n\nSOURCE PASSAGE:\n${candidate.text}\n\nSTUDENT ANSWER:\n${data.studentAnswer}`,
      evaluationSchema,
    );
    if (!evaluation)
      throw new Error(
        "Annie could not evaluate that answer. The original passage has been restored.",
      );
    const { error: attemptError } = await db.from("annie_quiz_attempts").insert({
      user_id: context.userId,
      candidate_id: candidate.id,
      result: evaluation.verdict,
      user_answer: data.studentAnswer,
    });
    if (attemptError) throw new Error(attemptError.message);
    return {
      verdict: evaluation.verdict,
      feedback: evaluation.feedback,
      correctExplanation: evaluation.correct_explanation,
    };
  });

export const skipRecallChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: candidate } = await db
      .from("annie_quiz_candidates")
      .select("id,annie_documents!inner(user_id)")
      .eq("id", data.challengeId)
      .eq("annie_documents.user_id", context.userId)
      .maybeSingle();
    if (!candidate) throw new Error("Recall passage not found.");
    await db.from("annie_quiz_attempts").insert({
      user_id: context.userId,
      candidate_id: candidate.id,
      result: "skipped",
      user_answer: "",
    });
    return { result: "skipped" as QuizResult };
  });

export const finishAnnieSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        documentId: z.string().uuid(),
        pages: z.array(z.number().int().positive()).max(1000),
        results: z.array(
          z.object({
            candidateId: z.string().uuid(),
            result: z.enum(["correct", "partially_correct", "incorrect", "skipped"]),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SessionSummary> => {
    const db = await adminDb();
    await ownedDocument(db, data.documentId, context.userId, "id");
    const attempted = data.results.filter((item) => item.result !== "skipped").length;
    const correct = data.results.filter((item) => item.result === "correct").length;
    const revisitIds = data.results
      .filter((item) => item.result !== "correct")
      .map((item) => item.candidateId)
      .slice(0, 3);
    let revisit: string[] = [];
    if (revisitIds.length) {
      const { data: candidates } = await db
        .from("annie_quiz_candidates")
        .select("text")
        .eq("document_id", data.documentId)
        .in("id", revisitIds);
      revisit = (candidates ?? []).map((candidate: { text: string }) => candidate.text).slice(0, 3);
    }
    const pagesCovered = new Set(data.pages).size;
    const stats = { attempted, correct, pages: [...new Set(data.pages)], revisit };
    await db
      .from("annie_study_sessions")
      .update({ ended_at: new Date().toISOString(), stats })
      .eq("id", data.sessionId)
      .eq("document_id", data.documentId)
      .eq("user_id", context.userId);

    const score = attempted ? correct / attempted : 0;
    const message =
      score >= 0.75
        ? "Strong session. Revisit the marked passages once more before you stop."
        : "A short review of the marked passages will strengthen the concepts that need more work.";
    return { attempted, correct, pagesCovered, revisit, message };
  });

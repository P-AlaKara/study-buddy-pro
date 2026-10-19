/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateQuizCandidates, sentenceCandidates } from "./candidate-validation";
import { ANNIE_SYSTEM_PROMPTS, DEFAULT_ANNIE_SETTINGS, fallbackLine } from "./config";
import { requireStudyWithAnnieEnabled } from "./feature-flag";
import type {
  AnnieAnnotation,
  AnnieDocument,
  AnnieMood,
  AnnieSettings,
  CommentaryCandidate,
  PageText,
  QuizCandidate,
  QuizResult,
  ReaderPayload,
  SessionSummary,
} from "./types";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const STORAGE_BUCKET = "annie-notes";
const RUNTIME_LLM_CALL_LIMIT = 20;

const idSchema = z.object({ documentId: z.string().uuid() });
const settingsSchema = z.object({
  mood: z.enum(["stern", "friendly", "cheeky"]),
  chattiness: z.enum(["quiet", "normal", "chatty"]),
  quizzes_enabled: z.boolean(),
  commentary_enabled: z.boolean(),
  theme: z.enum(["light", "dark", "sepia"]),
  silenced_until: z.string().datetime().nullable(),
  silenced_forever: z.boolean(),
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
  commentary_candidates: z.array(
    z.object({
      page: z.number().int().positive(),
      text: z.string().min(1).max(500),
      type: z.enum(["explain", "common_mistake", "analogy", "context"]),
      beyond_notes: z.boolean(),
    }),
  ),
});

const evaluationSchema = z.object({
  result: z.enum(["correct", "partially_correct", "incorrect"]),
  explanation: z.string().min(1).max(240),
});

const questionAnswerSchema = z.object({
  answer: z.string().min(1).max(900),
  beyond_notes: z.boolean(),
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
  const fallbackCommentary = pages.flatMap((page) => {
    const anchor = sentenceCandidates(page.page, page.text)[0]?.text;
    return anchor
      ? [
          {
            page: page.page,
            text: `A useful anchor on this page is: “${anchor.slice(0, 220)}”`,
            type: "context" as const,
            beyond_notes: false,
          },
        ]
      : [];
  });

  const generatedQuizzes: ReturnType<typeof sentenceCandidates> = [];
  const generatedCommentary: Array<
    z.infer<typeof generatedCandidatesSchema>["commentary_candidates"][number]
  > = [];

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
      `Create concise study interactions from only the supplied note text. Blotout text MUST be an exact substring copied from its page. Commentary must be grounded in the page; set beyond_notes true if it adds any outside fact. Return 1-3 useful items per substantive page.\n\nRespond with JSON of exactly this shape: {"candidate_blotouts":[{"page":<integer>,"text":<exact page substring>,"question_prompt":<string>,"difficulty":<1|2|3>}],"commentary_candidates":[{"page":<integer>,"text":<string>,"type":"explain"|"common_mistake"|"analogy"|"context","beyond_notes":<boolean>}]}. Use at most 18 items per array.\n\n${notes}`,
      generatedCandidatesSchema,
    );
    if (response) {
      generatedQuizzes.push(...validateQuizCandidates(pageMap, response.candidate_blotouts));
      generatedCommentary.push(
        ...response.commentary_candidates.filter((candidate) => pageMap.has(candidate.page)),
      );
    }
  }

  return {
    quizzes: generatedQuizzes.length ? generatedQuizzes : fallbackQuizzes,
    commentary: generatedCommentary.length ? generatedCommentary : fallbackCommentary,
  };
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
      .select("id,title,page_count,status,processing_error,last_opened_at,created_at")
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
      .select("id,title,page_count,status,processing_error,last_opened_at,created_at")
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
        if (candidates.quizzes.length) {
          const { error } = await db.from("annie_quiz_candidates").insert(
            candidates.quizzes.map((candidate) => ({
              document_id: document.id,
              page: candidate.page,
              text: candidate.text,
              prompt: candidate.question_prompt,
              difficulty: candidate.difficulty,
            })),
          );
          if (error) throw new Error(error.message);
        }
        if (candidates.commentary.length) {
          const { error } = await db.from("annie_commentary_candidates").insert(
            candidates.commentary.map((candidate) => ({
              document_id: document.id,
              page: candidate.page,
              text: candidate.text,
              type: candidate.type,
              beyond_notes: candidate.beyond_notes,
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

    const [pageResult, quizResult, commentaryResult, annotationResult, settingsResult] =
      await Promise.all([
        db
          .from("annie_page_texts")
          .select("page,text,layout_data")
          .eq("document_id", document.id)
          .order("page"),
        db
          .from("annie_quiz_candidates")
          .select("id,page,text,prompt,difficulty")
          .eq("document_id", document.id)
          .order("page"),
        db
          .from("annie_commentary_candidates")
          .select("id,page,text,type,beyond_notes")
          .eq("document_id", document.id)
          .order("page"),
        db
          .from("annie_annotations")
          .select("*")
          .eq("document_id", document.id)
          .eq("user_id", context.userId)
          .order("created_at"),
        db
          .from("user_annie_settings")
          .select(
            "mood,chattiness,quizzes_enabled,commentary_enabled,theme,silenced_until,silenced_forever",
          )
          .eq("user_id", context.userId)
          .maybeSingle(),
      ]);
    for (const result of [pageResult, quizResult, commentaryResult, annotationResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const candidateIds = (quizResult.data ?? []).map((candidate: { id: string }) => candidate.id);
    let attempts: any[] = [];
    if (candidateIds.length) {
      const result = await db
        .from("annie_quiz_attempts")
        .select("candidate_id,result,created_at")
        .eq("user_id", context.userId)
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false });
      if (result.error) throw new Error(result.error.message);
      attempts = result.data ?? [];
    }

    const settings = (settingsResult.data ?? DEFAULT_ANNIE_SETTINGS) as AnnieSettings;
    if (!settingsResult.data) {
      await db.from("user_annie_settings").upsert({ user_id: context.userId, ...settings });
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

    const quizzes = (quizResult.data ?? []).map((candidate: any) => ({
      ...candidate,
      attempts: attempts
        .filter((attempt) => attempt.candidate_id === candidate.id)
        .map(({ result, created_at }) => ({ result, created_at })),
    }));

    return {
      document: {
        id: document.id,
        title: document.title,
        page_count: document.page_count,
        status: document.status,
        processing_error: document.processing_error,
        last_opened_at: document.last_opened_at,
        created_at: document.created_at,
      },
      fileUrl: signed.signedUrl,
      pages: (pageResult.data ?? []) as PageText[],
      quizCandidates: quizzes as QuizCandidate[],
      commentaryCandidates: (commentaryResult.data ?? []) as CommentaryCandidate[],
      annotations: (annotationResult.data ?? []) as AnnieAnnotation[],
      settings,
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

export const saveAnnieSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<AnnieSettings> => {
    const db = await adminDb();
    const { data: settings, error } = await db
      .from("user_annie_settings")
      .upsert({ user_id: context.userId, ...data })
      .select(
        "mood,chattiness,quizzes_enabled,commentary_enabled,theme,silenced_until,silenced_forever",
      )
      .single();
    if (error || !settings) throw new Error(error?.message ?? "Settings could not be saved.");
    return settings as AnnieSettings;
  });

function fallbackEvaluation(answer: string, source: string) {
  const ignored = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "is",
    "are",
    "was",
    "were",
  ]);
  const words = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !ignored.has(word)),
    );
  const expected = words(source);
  const actual = words(answer);
  const overlap =
    [...expected].filter((word) => actual.has(word)).length / Math.max(1, expected.size);
  if (overlap >= 0.62)
    return {
      result: "correct" as const,
      explanation: "Your answer captures the key details in the hidden text.",
    };
  if (overlap >= 0.3)
    return {
      result: "partially_correct" as const,
      explanation: "You have part of the idea, but an important detail is missing.",
    };
  return {
    result: "incorrect" as const,
    explanation: "Your answer does not yet match the main idea in the hidden text.",
  };
}

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

export const evaluateAnnieAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        candidateId: z.string().uuid(),
        sessionId: z.string().uuid(),
        answer: z.string().trim().min(1).max(1500),
        mood: z.enum(["stern", "friendly", "cheeky"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: candidate, error } = await db
      .from("annie_quiz_candidates")
      .select("id,text,document_id,annie_documents!inner(user_id)")
      .eq("id", data.candidateId)
      .eq("annie_documents.user_id", context.userId)
      .single();
    if (error || !candidate) throw new Error("Quiz passage not found.");

    let evaluation = null;
    if (await spendLlmCall(db, data.sessionId, context.userId)) {
      evaluation = await geminiJson(
        `${ANNIE_SYSTEM_PROMPTS[data.mood]} Compare the student's answer only against the source text. Accept accurate paraphrases and tolerate typos.\n\nRespond with JSON of exactly this shape: {"result":"correct"|"partially_correct"|"incorrect","explanation":<one short sentence, max 240 chars>}.\n\nSOURCE TEXT:\n${candidate.text}\n\nSTUDENT ANSWER:\n${data.answer}`,
        evaluationSchema,
      );
    }
    evaluation ??= fallbackEvaluation(data.answer, candidate.text);
    const { error: attemptError } = await db.from("annie_quiz_attempts").insert({
      user_id: context.userId,
      candidate_id: candidate.id,
      result: evaluation.result,
      user_answer: data.answer,
    });
    if (attemptError) throw new Error(attemptError.message);
    return {
      ...evaluation,
      reaction: fallbackLine(
        data.mood,
        evaluation.result === "partially_correct" ? "partial" : evaluation.result,
      ),
    };
  });

export const skipAnnieQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ candidateId: z.string().uuid(), mood: z.enum(["stern", "friendly", "cheeky"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: candidate } = await db
      .from("annie_quiz_candidates")
      .select("id,annie_documents!inner(user_id)")
      .eq("id", data.candidateId)
      .eq("annie_documents.user_id", context.userId)
      .maybeSingle();
    if (!candidate) throw new Error("Quiz passage not found.");
    await db.from("annie_quiz_attempts").insert({
      user_id: context.userId,
      candidate_id: candidate.id,
      result: "skipped",
      user_answer: "",
    });
    return { result: "skipped" as QuizResult, reaction: fallbackLine(data.mood, "skip") };
  });

export const askAnnie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        page: z.number().int().positive(),
        sessionId: z.string().uuid(),
        question: z.string().trim().min(2).max(600),
        mood: z.enum(["stern", "friendly", "cheeky"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await ownedDocument(db, data.documentId, context.userId, "id");
    const { data: page } = await db
      .from("annie_page_texts")
      .select("text")
      .eq("document_id", data.documentId)
      .eq("page", data.page)
      .single();
    if (!page) throw new Error("Page text not found.");
    let response = null;
    if (await spendLlmCall(db, data.sessionId, context.userId)) {
      response = await geminiJson(
        `${ANNIE_SYSTEM_PROMPTS[data.mood]} Answer in at most 2 sentences. Use the page text as the primary source. If the answer includes anything not stated or directly inferable from the page, set beyond_notes true. Do not include links or recommend sources.\n\nRespond with JSON of exactly this shape: {"answer":<string>,"beyond_notes":<boolean>}.\n\nPAGE TEXT:\n${page.text}\n\nQUESTION:\n${data.question}`,
        questionAnswerSchema,
      );
    }
    response ??= {
      answer: "I couldn’t check that just now. Try using the wording on this page as your anchor.",
      beyond_notes: false,
    };
    return {
      answer: `${response.beyond_notes ? "Beyond your notes: " : ""}${response.answer}`,
      beyondNotes: response.beyond_notes,
    };
  });

export const finishAnnieSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        documentId: z.string().uuid(),
        mood: z.enum(["stern", "friendly", "cheeky"]),
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
    const messageByMood: Record<AnnieMood, string> = {
      stern:
        score >= 0.75
          ? "Solid work. Revisit the weak passages before you stop."
          : "There is work left. Review the marked passages.",
      friendly:
        score >= 0.75
          ? "Great session — you held onto most of the key ideas."
          : "Good effort. A quick revisit will make these ideas much stronger.",
      cheeky:
        score >= 0.75
          ? "Not bad at all — your brain was clearly on duty."
          : "A few ideas escaped. Luckily, I took names.",
    };
    return { attempted, correct, pagesCovered, revisit, message: messageByMood[data.mood] };
  });

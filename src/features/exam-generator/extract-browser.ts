// Browser-side document extraction. Files are read on the student's device and
// only their text is sent to the server, so the original file never leaves the
// browser. This also keeps uploads under Vercel's 4.5 MB request-body limit:
// lecture PDFs are large because of images, which text extraction ignores.
// pdfjs (and its worker) are loaded lazily, only once a PDF is actually added.
import {
  ExtractionError,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  detectKind,
  extractPptx,
  finalizeExtraction,
  friendlyExtractionError,
  type DocumentExtraction,
  type ExtractedUnit,
} from "./extract-text";

export interface ExtractOptions {
  signal?: AbortSignal;
  /** Called after each PDF page is read. */
  onProgress?: (done: number, total: number) => void;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException("Extraction cancelled", "AbortError");
}

async function loadPdfjs() {
  // Never called during SSR; the guard also keeps pdfjs out of the server bundle.
  if (import.meta.env.SSR) throw new Error("PDF extraction only runs in the browser.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: workerSrc } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  return pdfjs;
}

async function extractPdf(
  name: string,
  bytes: Uint8Array,
  { signal, onProgress }: ExtractOptions,
): Promise<ExtractedUnit[]> {
  const pdfjs = await loadPdfjs();
  throwIfAborted(signal);
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const cancel = () => void task.destroy();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const doc = await task.promise;
    const units: ExtractedUnit[] = [];
    for (let page = 1; page <= doc.numPages; page += 1) {
      throwIfAborted(signal);
      let handle: Awaited<ReturnType<typeof doc.getPage>> | undefined;
      try {
        handle = await doc.getPage(page);
        const content = await handle.getTextContent();
        const text = content.items
          .flatMap((item) => ("str" in item && item.str.trim() ? [item.str.trim()] : []))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        units.push({ document: name, unitKind: "page", unit: page, text });
      } catch (pageError) {
        throwIfAborted(signal);
        console.error("[ExamGen] Failed to read page", page, pageError);
        units.push({ document: name, unitKind: "page", unit: page, text: "" });
      } finally {
        handle?.cleanup();
      }
      onProgress?.(page, doc.numPages);
    }
    return units;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await task.destroy();
  }
}

/** Read a PDF/PPTX locally. Throws ExtractionError (user-facing message) or an AbortError. */
export async function extractInBrowser(
  file: File,
  options: ExtractOptions = {},
): Promise<DocumentExtraction> {
  if (file.size === 0) throw new ExtractionError("This file is empty.", "empty");
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError(`Files must be ${MAX_FILE_MB} MB or smaller.`, "too_large");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(options.signal);
  const kind = detectKind(file.name, bytes);
  if (!kind) {
    throw new ExtractionError(
      "Only PDF and PowerPoint (.pptx) files are supported.",
      "unsupported",
    );
  }

  let units: ExtractedUnit[];
  try {
    units =
      kind === "pdf" ? await extractPdf(file.name, bytes, options) : extractPptx(file.name, bytes);
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      throw new DOMException("Extraction cancelled", "AbortError");
    }
    if (error instanceof ExtractionError) throw error;
    console.error("[ExamGen] extraction failed", file.name, error);
    throw new ExtractionError(friendlyExtractionError(error), "failed");
  }
  return finalizeExtraction(file.name, kind, units);
}

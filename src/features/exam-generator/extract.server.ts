// Server-only document extraction entry point. PDF extraction uses pdfjs (with
// pure-JS server polyfills + a globally registered worker so text extraction
// works in the Node/serverless runtime); PPTX and all pure helpers live in
// extract-text.ts so they stay unit-testable.
// Nothing here persists a file — callers hold the text only in the temp job.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExtractionError,
  MAX_FILE_BYTES,
  detectKind,
  extractPptx,
  finalizeExtraction,
  friendlyExtractionError,
  type DocumentExtraction,
  type ExtractedUnit,
} from "./extract-text";

export { ExtractionError, detectKind };
export type { DocumentExtraction, ExtractedUnit };

// ---------------------------------------------------------------------------
// pdfjs server globals + worker (required to extract text in Node/serverless).
// ---------------------------------------------------------------------------
function ensurePdfServerGlobals() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["DOMMatrix"] === "undefined") {
    class DOMMatrixPolyfill {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(init?: number[] | Float32Array | Float64Array | string) {
        if (Array.isArray(init) || init instanceof Float32Array || init instanceof Float64Array) {
          const v = Array.from(init as ArrayLike<number>);
          if (v.length === 6) {
            this.a = v[0]!;
            this.b = v[1]!;
            this.c = v[2]!;
            this.d = v[3]!;
            this.e = v[4]!;
            this.f = v[5]!;
          } else if (v.length === 16) {
            this.a = v[0]!;
            this.b = v[1]!;
            this.c = v[4]!;
            this.d = v[5]!;
            this.e = v[12]!;
            this.f = v[13]!;
          }
        }
      }
      private clone() {
        return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]);
      }
      multiplySelf(o: DOMMatrixPolyfill) {
        const a = this.a * o.a + this.c * o.b;
        const b = this.b * o.a + this.d * o.b;
        const c = this.a * o.c + this.c * o.d;
        const d = this.b * o.c + this.d * o.d;
        const e = this.a * o.e + this.c * o.f + this.e;
        const f = this.b * o.e + this.d * o.f + this.f;
        Object.assign(this, { a, b, c, d, e, f });
        return this;
      }
      preMultiplySelf(o: DOMMatrixPolyfill) {
        return this.multiplySelf(o);
      }
      multiply(o: DOMMatrixPolyfill) {
        return this.clone().multiplySelf(o);
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
    g["DOMMatrix"] = DOMMatrixPolyfill;
  }
  if (typeof g["Path2D"] === "undefined") {
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
    g["Path2D"] = Path2DPolyfill;
  }
  if (typeof g["ImageData"] === "undefined") {
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
    g["ImageData"] = ImageDataPolyfill;
  }
}

let pdfWorkerReady: Promise<void> | null = null;
function ensurePdfWorker() {
  pdfWorkerReady ??= (async () => {
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as Record<string, unknown>)["pdfjsWorker"] = workerModule;
  })();
  return pdfWorkerReady;
}

async function extractPdfOnce(name: string, bytes: Uint8Array): Promise<ExtractedUnit[]> {
  ensurePdfServerGlobals();
  await ensurePdfWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const doc = await task.promise;
  try {
    const units: ExtractedUnit[] = [];
    for (let page = 1; page <= doc.numPages; page += 1) {
      let handle: Awaited<ReturnType<typeof doc.getPage>> | undefined;
      try {
        handle = await doc.getPage(page);
        const content = await handle.getTextContent();
        const text = content.items
          .flatMap((item: any) => ("str" in item && item.str.trim() ? [item.str.trim()] : []))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        units.push({ document: name, unitKind: "page", unit: page, text });
      } catch (pageError) {
        console.error("[ExamGen] Failed to read page", page, pageError);
        units.push({ document: name, unitKind: "page", unit: page, text: "" });
      } finally {
        handle?.cleanup();
      }
    }
    return units;
  } finally {
    await doc.destroy();
  }
}

async function extractPdf(name: string, bytes: Uint8Array): Promise<ExtractedUnit[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await extractPdfOnce(name, bytes);
    } catch (error) {
      lastError = error;
      if (attempt < 2) console.warn(`[ExamGen] PDF extraction attempt ${attempt} failed`, error);
    }
  }
  throw lastError;
}

export async function extractDocument(
  name: string,
  bytes: Uint8Array,
): Promise<DocumentExtraction> {
  if (bytes.length === 0) throw new ExtractionError("This file is empty.", "empty");
  if (bytes.length > MAX_FILE_BYTES) {
    throw new ExtractionError("Files must be 40 MB or smaller.", "too_large");
  }
  const kind = detectKind(name, bytes);
  if (!kind) {
    throw new ExtractionError(
      "Only PDF and PowerPoint (.pptx) files are supported.",
      "unsupported",
    );
  }

  let units: ExtractedUnit[];
  try {
    units = kind === "pdf" ? await extractPdf(name, bytes) : extractPptx(name, bytes);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    console.error("[ExamGen] extraction failed", name, error);
    throw new ExtractionError(friendlyExtractionError(error), "failed");
  }

  return finalizeExtraction(name, kind, units);
}

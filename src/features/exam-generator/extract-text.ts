// Pure + PPTX (fflate-only) extraction helpers. No pdfjs here, so this module is
// safe to unit-test directly. PDF extraction lives in extract.server.ts.
import { strFromU8, unzipSync } from "fflate";
import type { DocumentKind } from "./types";

export interface ExtractedUnit {
  document: string;
  unitKind: "page" | "slide";
  unit: number;
  text: string;
}

export interface DocumentExtraction {
  name: string;
  kind: DocumentKind;
  unitCount: number;
  units: ExtractedUnit[];
  warning: string | null;
}

export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported" | "empty" | "scanned" | "corrupt" | "too_large" | "failed",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

function hasMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}
const isPdf = (b: Uint8Array) => hasMagic(b, [0x25, 0x50, 0x44, 0x46]); // %PDF
const isZip = (b: Uint8Array) => hasMagic(b, [0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

export function detectKind(name: string, bytes: Uint8Array): DocumentKind | null {
  const lower = name.toLowerCase();
  if (isPdf(bytes) || lower.endsWith(".pdf")) return "pdf";
  if (isZip(bytes) && (lower.endsWith(".pptx") || lower.endsWith(".ppt"))) return "pptx";
  return null;
}

/** Scanned/empty heuristic shared by both formats. */
export function looksEmpty(units: ExtractedUnit[]): boolean {
  const chars = units.reduce((sum, u) => sum + u.text.length, 0);
  return chars < Math.max(30, units.length * 10);
}

export function friendlyExtractionError(error: unknown): string {
  if (error instanceof ExtractionError) return error.message;
  const raw = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException" || /password|encrypted/i.test(raw)) {
    return "This file is password-protected. Remove the password and upload it again.";
  }
  if (name === "InvalidPDFException" || /invalid pdf|corrupt|structure/i.test(raw)) {
    return "This file doesn’t look like a readable document. Please check it and try again.";
  }
  if (/DOMMatrix|is not defined|canvas|worker|module/i.test(raw)) {
    return "We couldn’t process this file just now. Please try again in a moment.";
  }
  return "We couldn’t read this file. Please try again, or upload a different one.";
}

/** Shared post-extraction validation → DocumentExtraction (or throws). Pure. */
export function finalizeExtraction(
  name: string,
  kind: DocumentKind,
  units: ExtractedUnit[],
): DocumentExtraction {
  const readable = units.filter((u) => u.text.trim().length > 0);
  if (readable.length === 0 || looksEmpty(units)) {
    throw new ExtractionError(
      kind === "pdf"
        ? "This PDF appears to be scanned or image-only. Text-based PDFs are required (OCR isn’t supported)."
        : "No readable text was found in this presentation.",
      "scanned",
    );
  }
  const unreadable = units.length - readable.length;
  const unitWord = units[0]?.unitKind ?? "page";
  const warning =
    unreadable > 0
      ? `${unreadable} ${unitWord}${unreadable === 1 ? "" : "s"} in “${name}” couldn’t be read and were skipped.`
      : null;
  return { name, kind, unitCount: units.length, units: readable, warning };
}

// ---------------------------------------------------------------------------
// PPTX — a zip of XML; read slide text runs (<a:t>) per slide, in order.
// ---------------------------------------------------------------------------
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

export function slideTextFromXml(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/).map((para) => {
    const runs = [...para.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1] ?? ""),
    );
    return runs.join("").replace(/\s+/g, " ").trim();
  });
  return paragraphs.filter(Boolean).join("\n").trim();
}

export function slideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function extractPptx(name: string, bytes: Uint8Array): ExtractedUnit[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ExtractionError(
      "This presentation couldn’t be opened. If it’s an older .ppt file, re-save it as .pptx.",
      "corrupt",
    );
  }
  const slidePaths = Object.keys(files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (slidePaths.length === 0) {
    throw new ExtractionError(
      "No slides were found in this presentation. If it’s an older .ppt file, re-save it as .pptx.",
      "unsupported",
    );
  }
  const notesAvailable = new Set(
    Object.keys(files).filter((path) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(path)),
  );
  return slidePaths.map((path, index) => {
    let text = slideTextFromXml(strFromU8(files[path]!));
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber(path)}.xml`;
    if (notesAvailable.has(notesPath)) {
      const notes = slideTextFromXml(strFromU8(files[notesPath]!));
      if (notes) text = `${text}\n[Speaker notes] ${notes}`.trim();
    }
    return { document: name, unitKind: "slide" as const, unit: index + 1, text: text.trim() };
  });
}

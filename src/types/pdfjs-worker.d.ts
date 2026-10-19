// The PDF.js worker bundle ships without type declarations. We import it on the
// server only to register its message handler on `globalThis` (see
// annie.functions.ts), so a minimal ambient declaration is enough.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LoaderCircle, Save, Trash2, X } from "lucide-react";
import type { AnnieAnnotation, NormalizedRect, QuizCandidate, ReaderTheme } from "./types";

type AnnotationTool = "select" | "highlight" | "note";

type NoteDraft = { x: number; y: number; text: string } | null;

function rectStyle(rect: NormalizedRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function findCandidateRects(container: HTMLElement, wrapper: HTMLElement, text: string) {
  const spans = [...container.querySelectorAll("span")].filter((span) => span.textContent?.trim());
  const parts = spans.map((span) => span.textContent ?? "");
  const joined = parts.join(" ");
  const start = joined.indexOf(text);
  if (start < 0) return [];
  const end = start + text.length;
  const wrapperRect = wrapper.getBoundingClientRect();
  let cursor = 0;
  return spans.flatMap((span, index) => {
    const partStart = cursor;
    const partEnd = cursor + parts[index]!.length;
    cursor = partEnd + 1;
    if (partEnd <= start || partStart >= end) return [];
    const rect = span.getBoundingClientRect();
    return [
      {
        x: (rect.left - wrapperRect.left) / wrapperRect.width,
        y: (rect.top - wrapperRect.top) / wrapperRect.height,
        width: rect.width / wrapperRect.width,
        height: rect.height / wrapperRect.height,
      },
    ];
  });
}

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  theme,
  annotations,
  tool,
  highlightColor,
  activeQuiz,
  revealQuiz,
  onHighlight,
  onAddNote,
  onUpdateNote,
  onDeleteAnnotation,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  theme: ReaderTheme;
  annotations: AnnieAnnotation[];
  tool: AnnotationTool;
  highlightColor: string;
  activeQuiz: QuizCandidate | null;
  revealQuiz: boolean;
  onHighlight: (rects: NormalizedRect[], text: string, color: string) => Promise<void>;
  onAddNote: (rect: NormalizedRect, text: string) => Promise<void>;
  onUpdateNote: (annotation: AnnieAnnotation, text: string) => Promise<void>;
  onDeleteAnnotation: (annotation: AnnieAnnotation) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [rendering, setRendering] = useState(true);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(null);
  const [blotRects, setBlotRects] = useState<NormalizedRect[]>([]);

  useEffect(() => {
    let active = true;
    setRendering(true);
    pdf.getPage(pageNumber).then((nextPage) => {
      if (active) setPage(nextPage);
    });
    return () => {
      active = false;
    };
  }, [pageNumber, pdf]);

  useEffect(() => {
    if (!page || !canvasRef.current || !textLayerRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const textContainer = textLayerRef.current;
    const viewport = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    textContainer.replaceChildren();
    textContainer.style.width = `${viewport.width}px`;
    textContainer.style.height = `${viewport.height}px`;

    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
      const renderTask = page.render({
        canvas,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      const textLayer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent({ includeMarkedContent: true }),
        container: textContainer,
        viewport,
      });
      try {
        await Promise.all([renderTask.promise, textLayer.render()]);
        if (!cancelled) setRendering(false);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException"))
          setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      page.cleanup();
    };
  }, [page, scale, theme]);

  useEffect(() => {
    if (!activeQuiz || revealQuiz || rendering || !textLayerRef.current || !wrapperRef.current) {
      setBlotRects([]);
      return;
    }
    setBlotRects(findCandidateRects(textLayerRef.current, wrapperRef.current, activeQuiz.text));
  }, [activeQuiz, revealQuiz, rendering]);

  function captureSelection() {
    if (tool !== "highlight" || !wrapperRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!wrapperRef.current.contains(range.commonAncestorContainer)) return;
    const pageRect = wrapperRef.current.getBoundingClientRect();
    const rects = [...range.getClientRects()]
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .map((rect) => ({
        x: Math.max(0, (rect.left - pageRect.left) / pageRect.width),
        y: Math.max(0, (rect.top - pageRect.top) / pageRect.height),
        width: Math.min(1, rect.width / pageRect.width),
        height: Math.min(1, rect.height / pageRect.height),
      }));
    const selectedText = selection.toString().trim();
    if (rects.length && selectedText) void onHighlight(rects, selectedText, highlightColor);
    selection.removeAllRanges();
  }

  function beginNote(event: React.MouseEvent<HTMLDivElement>) {
    if (tool !== "note" || !wrapperRef.current) return;
    if ((event.target as HTMLElement).closest("button,textarea")) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setNoteDraft({
      x: Math.min(0.88, Math.max(0.02, (event.clientX - rect.left) / rect.width)),
      y: Math.min(0.88, Math.max(0.02, (event.clientY - rect.top) / rect.height)),
      text: "",
    });
  }

  return (
    <div
      ref={wrapperRef}
      className={`pdf-page relative mx-auto overflow-hidden shadow-[0_18px_50px_-25px_rgba(25,25,35,.45)] ${theme === "dark" ? "pdf-page-dark" : theme === "sepia" ? "pdf-page-sepia" : "bg-white"}`}
      style={{
        width: page ? page.getViewport({ scale }).width : 600,
        minHeight: page ? page.getViewport({ scale }).height : 760,
      }}
      onMouseUp={captureSelection}
      onClick={beginNote}
    >
      <canvas ref={canvasRef} className="block" aria-label={`Page ${pageNumber}`} />
      <div ref={textLayerRef} className="textLayer" />

      <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true">
        {annotations
          .filter((annotation) => annotation.type === "highlight")
          .flatMap((annotation) =>
            annotation.geometry.map((rect, index) => (
              <span
                key={`${annotation.id}-${index}`}
                className="absolute rounded-sm opacity-45 mix-blend-multiply"
                style={{ ...rectStyle(rect), backgroundColor: annotation.color ?? "#fde047" }}
              />
            )),
          )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden="true">
        {blotRects.map((rect, index) => (
          <span
            key={index}
            className="absolute rounded bg-slate-800/90 shadow-sm backdrop-blur-md"
            style={rectStyle(rect)}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-[5] pointer-events-none">
        {annotations
          .filter((annotation) => annotation.type === "note")
          .map((annotation) => {
            const position = annotation.geometry[0];
            if (!position) return null;
            return (
              <details
                key={annotation.id}
                className="group pointer-events-auto absolute"
                style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
              >
                <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg bg-[#fde68a] text-xs font-black shadow-md focus:outline-none focus:ring-2 focus:ring-[#7566b7]">
                  ✦
                </summary>
                <NoteCard
                  initialText={annotation.content ?? ""}
                  onSave={(text) => onUpdateNote(annotation, text)}
                  onDelete={() => onDeleteAnnotation(annotation)}
                />
              </details>
            );
          })}
        {noteDraft && (
          <div
            className="pointer-events-auto absolute"
            style={{ left: `${noteDraft.x * 100}%`, top: `${noteDraft.y * 100}%` }}
          >
            <div className="w-64 rounded-2xl bg-[#fff8c9] p-3 shadow-xl ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-[#7a6420]">New note</span>
                <button
                  type="button"
                  onClick={() => setNoteDraft(null)}
                  className="grid size-7 place-items-center rounded-full hover:bg-black/5"
                  aria-label="Cancel note"
                >
                  <X className="size-4" />
                </button>
              </div>
              <textarea
                autoFocus
                value={noteDraft.text}
                onChange={(event) => setNoteDraft({ ...noteDraft, text: event.target.value })}
                className="mt-2 min-h-24 w-full resize-none bg-transparent text-sm font-semibold outline-none"
                placeholder="Write a note…"
                maxLength={4000}
              />
              <button
                type="button"
                disabled={!noteDraft.text.trim()}
                onClick={() => {
                  const rect = { x: noteDraft.x, y: noteDraft.y, width: 0.04, height: 0.04 };
                  void onAddNote(rect, noteDraft.text.trim()).then(() => setNoteDraft(null));
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#7566b7] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
              >
                <Save className="size-3.5" /> Save note
              </button>
            </div>
          </div>
        )}
      </div>

      {rendering && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/80" role="status">
          <LoaderCircle className="size-7 animate-spin text-[#7566b7]" />
          <span className="sr-only">Rendering page {pageNumber}</span>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  initialText,
  onSave,
  onDelete,
}: {
  initialText: string;
  onSave: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [text, setText] = useState(initialText);
  return (
    <div className="absolute left-0 top-10 z-10 w-64 rounded-2xl bg-[#fff8c9] p-3 shadow-xl ring-1 ring-black/5">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-24 w-full resize-none bg-transparent text-sm font-semibold outline-none"
        maxLength={4000}
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void onDelete()}
          className="grid size-8 place-items-center rounded-full text-[#a14839] hover:bg-white/50"
          aria-label="Delete note"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void onSave(text.trim())}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#7566b7] px-3 py-1.5 text-xs font-black text-white"
        >
          <Save className="size-3.5" /> Save
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  LoaderCircle,
  Minus,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import {
  deleteAnnieAnnotation,
  evaluateRecallAnswer,
  explainSelection,
  finishAnnieSession,
  generatePageOverview,
  generateRecallChallenge,
  openAnnieDocument,
  saveAnnieAnnotation,
  saveReaderPreferences,
  saveReadingProgress,
  skipRecallChallenge,
} from "./annie.functions";
import { logProblem } from "@/lib/log-problem";
import { AnniePanel } from "./annie-panel";
import { assistantReducer, initialAssistantView } from "./assistant-state";
import { OVERVIEW_DISMISS_MS } from "./config";
import { PdfPage } from "./pdf-page";
import type {
  AnnieAnnotation,
  NormalizedRect,
  PageOverview,
  QuizResult,
  ReaderPayload,
  ReaderTheme,
  SelectionSnapshot,
  SessionSummary,
} from "./types";

type AnnotationTool = "select" | "highlight" | "note";
const highlightColors = ["#fde047", "#86efac", "#7dd3fc", "#f0abfc"];

export function AnnieReader({ documentId }: { documentId: string }) {
  const [payload, setPayload] = useState<ReaderPayload | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [highlightColor, setHighlightColor] = useState(highlightColors[0]!);
  const [annotations, setAnnotations] = useState<AnnieAnnotation[]>([]);
  const [preferences, setPreferences] = useState<ReaderPayload["preferences"] | null>(null);
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [assistant, dispatch] = useReducer(assistantReducer, initialAssistantView);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantEngaged, setAssistantEngaged] = useState(false);
  const [revealRecall, setRevealRecall] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [ending, setEnding] = useState(false);
  const requestVersion = useRef(0);
  const overviewCache = useRef(new Map<number, PageOverview>());
  const overviewRequests = useRef(new Map<number, Promise<PageOverview>>());
  const progressPage = useRef(1);
  const pagesVisited = useRef(new Set<number>());
  const sessionResults = useRef<Array<{ candidateId: string; result: QuizResult }>>([]);

  const showError = useCallback((title: string, detail: string) => {
    dispatch({ type: "show", message: { kind: "error", title, detail } });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void openAnnieDocument({ data: { documentId } })
      .then(async (readerPayload) => {
        if (cancelled) return;
        setPayload(readerPayload);
        setAnnotations(readerPayload.annotations);
        setPreferences(readerPayload.preferences);
        setCurrentPage(readerPayload.document.last_page);
        pagesVisited.current.add(readerPayload.document.last_page);
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
        const document = await pdfjs.getDocument({ url: readerPayload.fileUrl }).promise;
        if (cancelled) return void document.destroy();
        setPdf(document);
      })
      .catch((loadError) => {
        logProblem("Annie open document", loadError, { documentId });
        setError(
          loadError instanceof Error ? loadError.message : "The reader could not be opened.",
        );
      })
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
      requestVersion.current += 1;
    };
  }, [documentId]);

  useEffect(
    () => () => {
      void pdf?.destroy();
    },
    [pdf],
  );

  const requestOverview = useCallback(async () => {
    if (!payload) return;
    const page = currentPage;
    const version = ++requestVersion.current;
    dispatch({ type: "think" });
    setAssistantBusy(true);
    try {
      const cached = overviewCache.current.get(page);
      let request = overviewRequests.current.get(page);
      if (!cached && !request) {
        request = generatePageOverview({
          data: { documentId, page, sessionId: payload.sessionId },
        }).finally(() => overviewRequests.current.delete(page));
        overviewRequests.current.set(page, request);
      }
      const overview = cached ?? (await request!);
      if (version !== requestVersion.current || page !== currentPage) return;
      overviewCache.current.set(page, overview);
      dispatch({ type: "show", message: { kind: "overview", overview } });
    } catch (overviewError) {
      if (version !== requestVersion.current) return;
      logProblem("Annie page overview", overviewError, { documentId, page });
      showError(
        "Page overview unavailable",
        overviewError instanceof Error
          ? overviewError.message
          : "An accurate overview could not be generated.",
      );
    } finally {
      if (version === requestVersion.current) setAssistantBusy(false);
    }
  }, [currentPage, documentId, payload, showError]);

  useEffect(() => {
    if (!payload || !pdf) return;
    void requestOverview();
  }, [currentPage, payload, pdf, requestOverview]);

  useEffect(() => {
    if (assistant.message?.kind !== "overview" || assistant.expanded || assistantEngaged) return;
    const timer = window.setTimeout(() => dispatch({ type: "dismiss" }), OVERVIEW_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [assistant.expanded, assistant.message, assistantEngaged]);

  useEffect(() => {
    if (!payload) return;
    progressPage.current = currentPage;
    const timer = window.setTimeout(() => {
      void saveReadingProgress({ data: { documentId, page: currentPage } });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [currentPage, documentId, payload]);

  useEffect(() => {
    if (!payload) return;
    return () => {
      void saveReadingProgress({ data: { documentId, page: progressPage.current } });
    };
  }, [documentId, payload]);

  const cancelAssistant = useCallback(
    (recordSkip = false) => {
      requestVersion.current += 1;
      if (recordSkip && assistant.challenge) {
        void skipRecallChallenge({ data: { challengeId: assistant.challenge.id } });
        sessionResults.current.push({ candidateId: assistant.challenge.id, result: "skipped" });
      }
      setRevealRecall(true);
      setAssistantBusy(false);
      dispatch({ type: "dismiss" });
    },
    [assistant.challenge],
  );

  const goToPage = useCallback(
    (page: number) => {
      const maximum = payload?.document.page_count ?? pdf?.numPages ?? 1;
      const next = Math.max(1, Math.min(maximum, page));
      if (next === currentPage) return;
      cancelAssistant(Boolean(assistant.challenge));
      setSelection(null);
      setRevealRecall(false);
      setCurrentPage(next);
      pagesVisited.current.add(next);
    },
    [assistant.challenge, cancelAssistant, currentPage, payload, pdf],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelAssistant(Boolean(assistant.challenge));
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      event.preventDefault();
      goToPage(currentPage + (event.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistant.challenge, cancelAssistant, currentPage, goToPage]);

  async function changeTheme(theme: ReaderTheme) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ theme });
    try {
      setPreferences(await saveReaderPreferences({ data: { theme } }));
    } catch (preferenceError) {
      logProblem("Annie save reader preferences", preferenceError);
      setPreferences(previous);
    }
  }

  async function createAnnotation(values: {
    type: "highlight" | "note" | "bookmark";
    page: number;
    geometry: NormalizedRect[];
    color: string | null;
    content: string | null;
    selectedText: string | null;
  }) {
    const annotation = await saveAnnieAnnotation({ data: { documentId, ...values } });
    setAnnotations((current) => [...current, annotation]);
  }

  async function updateNote(annotation: AnnieAnnotation, content: string) {
    const saved = await saveAnnieAnnotation({
      data: {
        id: annotation.id,
        documentId,
        type: annotation.type,
        page: annotation.page,
        geometry: annotation.geometry,
        color: annotation.color,
        content,
        selectedText: annotation.selected_text,
      },
    });
    setAnnotations((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }

  async function removeAnnotation(annotation: AnnieAnnotation) {
    await deleteAnnieAnnotation({ data: { annotationId: annotation.id } });
    setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
  }

  async function toggleBookmark() {
    const existing = annotations.find(
      (annotation) => annotation.type === "bookmark" && annotation.page === currentPage,
    );
    if (existing) await removeAnnotation(existing);
    else
      await createAnnotation({
        type: "bookmark",
        page: currentPage,
        geometry: [],
        color: null,
        content: null,
        selectedText: null,
      });
  }

  const explainCurrentSelection = useCallback(
    async (followUpQuestion?: string) => {
      const sourceSelection =
        assistant.message?.kind === "explanation" ? assistant.message.selection : selection;
      if (!payload || !sourceSelection || sourceSelection.page !== currentPage) return;
      if (assistant.challenge) {
        void skipRecallChallenge({ data: { challengeId: assistant.challenge.id } });
        sessionResults.current.push({ candidateId: assistant.challenge.id, result: "skipped" });
        setRevealRecall(true);
        dispatch({ type: "dismiss" });
      }
      const version = ++requestVersion.current;
      dispatch({ type: "think" });
      setAssistantBusy(true);
      try {
        const explanation = await explainSelection({
          data: {
            documentId,
            page: sourceSelection.page,
            sessionId: payload.sessionId,
            selectedText: sourceSelection.text,
            followUpQuestion,
          },
        });
        if (version !== requestVersion.current) return;
        dispatch({
          type: "show",
          message: { kind: "explanation", explanation, selection: sourceSelection },
        });
      } catch (explanationError) {
        logProblem("Annie explain selection", explanationError, { documentId });
        if (version === requestVersion.current)
          showError(
            "Explanation unavailable",
            explanationError instanceof Error
              ? explanationError.message
              : "An accurate explanation could not be generated.",
          );
      } finally {
        if (version === requestVersion.current) setAssistantBusy(false);
      }
    },
    [
      assistant.challenge,
      assistant.message,
      currentPage,
      documentId,
      payload,
      selection,
      showError,
    ],
  );

  const startRecall = useCallback(async () => {
    if (!payload || assistant.challenge) return;
    const version = ++requestVersion.current;
    dispatch({ type: "think" });
    setAssistantBusy(true);
    setRevealRecall(false);
    try {
      const challenge = await generateRecallChallenge({
        data: {
          documentId,
          page: currentPage,
          sessionId: payload.sessionId,
          selectedText: selection?.page === currentPage ? selection.text : undefined,
        },
      });
      if (version !== requestVersion.current) return;
      dispatch({ type: "start_recall", challenge });
    } catch (recallError) {
      logProblem("Annie recall challenge", recallError, { documentId, page: currentPage });
      if (version === requestVersion.current)
        showError(
          "Recall activity unavailable",
          recallError instanceof Error
            ? recallError.message
            : "No suitable passage could be prepared.",
        );
    } finally {
      if (version === requestVersion.current) setAssistantBusy(false);
    }
  }, [assistant.challenge, currentPage, documentId, payload, selection, showError]);

  async function submitRecall(studentAnswer: string) {
    if (!assistant.challenge || !payload) return;
    const challenge = assistant.challenge;
    setAssistantBusy(true);
    try {
      const evaluation = await evaluateRecallAnswer({
        data: { challengeId: challenge.id, sessionId: payload.sessionId, studentAnswer },
      });
      setRevealRecall(true);
      sessionResults.current.push({ candidateId: challenge.id, result: evaluation.verdict });
      dispatch({ type: "feedback", message: { kind: "feedback", evaluation } });
    } catch (evaluationError) {
      logProblem("Annie evaluate recall answer", evaluationError, { documentId });
      setRevealRecall(true);
      showError(
        "Answer not evaluated",
        evaluationError instanceof Error
          ? evaluationError.message
          : "The original passage has been restored.",
      );
    } finally {
      setAssistantBusy(false);
    }
  }

  async function endSession() {
    if (!payload || ending) return;
    setEnding(true);
    try {
      setSummary(
        await finishAnnieSession({
          data: {
            sessionId: payload.sessionId,
            documentId,
            pages: [...pagesVisited.current],
            results: sessionResults.current,
          },
        }),
      );
    } finally {
      setEnding(false);
    }
  }

  if (loading) return <ReaderLoading />;
  if (error || !payload || !preferences)
    return <ReaderError message={error || "The reader could not be opened."} />;
  if (!pdf) return <ReaderLoading />;

  const pageAnnotations = annotations.filter((annotation) => annotation.page === currentPage);
  const bookmarked = pageAnnotations.some((annotation) => annotation.type === "bookmark");

  return (
    <div
      className={`annie-workspace annie-reader annie-theme-${preferences.theme} min-h-[calc(100dvh-65px)] sm:min-h-[calc(100dvh-73px)]`}
    >
      <div className="sticky top-[65px] z-30 border-b border-[var(--reader-border)] bg-[var(--reader-toolbar)]/95 px-3 py-2 backdrop-blur sm:top-[73px] sm:px-5">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void endSession()}
              className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7]"
              aria-label="End session and return to documents"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="max-w-44 truncate text-sm font-semibold sm:max-w-sm">
                {payload.document.title}
              </h1>
              <p className="text-[11px] text-[var(--reader-muted)]">
                Page {currentPage} of {pdf.numPages}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ControlGroup>
              <IconButton
                label="Previous page"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft />
              </IconButton>
              <input
                type="number"
                min={1}
                max={pdf.numPages}
                value={currentPage}
                onChange={(event) => goToPage(Number(event.target.value))}
                className="h-8 w-11 bg-transparent text-center text-xs font-semibold outline-none"
                aria-label="Page number"
              />
              <IconButton
                label="Next page"
                disabled={currentPage === pdf.numPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <ChevronRight />
              </IconButton>
            </ControlGroup>
            <ControlGroup>
              <IconButton
                label="Zoom out"
                disabled={scale <= 0.65}
                onClick={() => setScale((value) => Math.max(0.65, value - 0.15))}
              >
                <Minus />
              </IconButton>
              <span className="min-w-10 text-center text-[10px] font-semibold">
                {Math.round(scale * 100)}%
              </span>
              <IconButton
                label="Zoom in"
                disabled={scale >= 2}
                onClick={() => setScale((value) => Math.min(2, value + 0.15))}
              >
                <Plus />
              </IconButton>
            </ControlGroup>
            <ControlGroup>
              <IconButton
                label="Text selection"
                active={tool === "select"}
                onClick={() => setTool("select")}
              >
                <Check />
              </IconButton>
              <IconButton
                label="Highlight text"
                active={tool === "highlight"}
                onClick={() => setTool("highlight")}
              >
                <Highlighter />
              </IconButton>
              <IconButton
                label="Add sticky note"
                active={tool === "note"}
                onClick={() => setTool("note")}
              >
                <StickyNote />
              </IconButton>
              <IconButton
                label={bookmarked ? "Remove bookmark" : "Bookmark page"}
                active={bookmarked}
                onClick={() => void toggleBookmark()}
              >
                <Bookmark />
              </IconButton>
            </ControlGroup>
            {tool === "highlight" && (
              <div
                className="flex items-center gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-control)] px-2 py-1.5"
                aria-label="Highlight color"
              >
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setHighlightColor(color)}
                    className={`size-4 rounded-full ${highlightColor === color ? "ring-2 ring-[#7566b7] ring-offset-1" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color} highlight`}
                  />
                ))}
              </div>
            )}
            <select
              value={preferences.theme}
              onChange={(event) => void changeTheme(event.target.value as ReaderTheme)}
              className="h-9 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-control)] px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-[#7566b7]"
              aria-label="Reader theme"
            >
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
              <option value="dark">Dark</option>
            </select>
            <button
              type="button"
              onClick={() => void endSession()}
              disabled={ending}
              className="h-9 rounded-lg bg-[#6757a6] px-3 text-xs font-semibold text-white hover:bg-[#594a96] disabled:opacity-60"
            >
              {ending ? "Ending…" : "End session"}
            </button>
          </div>
        </div>
      </div>

      <main
        className="min-h-[calc(100dvh-130px)] overflow-auto bg-[var(--reader-bg)] px-3 py-5 sm:px-8 sm:py-7"
        aria-label="PDF reader"
      >
        <PdfPage
          pdf={pdf}
          pageNumber={currentPage}
          scale={scale}
          theme={preferences.theme}
          annotations={pageAnnotations}
          tool={tool}
          highlightColor={highlightColor}
          activeRecall={assistant.challenge}
          revealRecall={revealRecall}
          selection={selection}
          onSelectionChange={setSelection}
          onExplainSelection={() => void explainCurrentSelection()}
          onMaskFailure={() => {
            setRevealRecall(true);
            showError(
              "Recall activity unavailable",
              "The selected passage could not be aligned with the rendered page.",
            );
          }}
          onHighlight={(geometry, selectedText, color) =>
            createAnnotation({
              type: "highlight",
              page: currentPage,
              geometry,
              color,
              content: null,
              selectedText,
            })
          }
          onAddNote={(geometry, content) =>
            createAnnotation({
              type: "note",
              page: currentPage,
              geometry: [geometry],
              color: "#fde68a",
              content,
              selectedText: null,
            })
          }
          onUpdateNote={updateNote}
          onDeleteAnnotation={removeAnnotation}
        />
      </main>

      <AnniePanel
        status={assistantBusy ? "thinking" : assistant.status}
        expanded={assistant.expanded}
        message={assistant.message}
        selection={selection}
        busy={assistantBusy}
        onToggle={() => dispatch({ type: assistant.expanded ? "collapse" : "expand" })}
        onDismiss={() => cancelAssistant(Boolean(assistant.challenge))}
        onOverview={() => void requestOverview()}
        onExplain={() => void explainCurrentSelection()}
        onRecall={() => void startRecall()}
        onSubmitRecall={submitRecall}
        onClarify={(question) => explainCurrentSelection(question)}
        onEngagementChange={setAssistantEngaged}
      />

      {summary && <SessionSummaryDialog summary={summary} onClose={() => setSummary(null)} />}
    </div>
  );
}

function IconButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7] disabled:opacity-30 ${active ? "bg-[#6757a6] text-white" : "hover:bg-black/5"}`}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-lg border border-[var(--reader-border)] bg-[var(--reader-control)] p-0.5 [&_svg]:size-4">
      {children}
    </div>
  );
}

function SessionSummaryDialog({
  summary,
  onClose,
}: {
  summary: SessionSummary;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid size-9 place-items-center rounded-md hover:bg-slate-100"
          aria-label="Close summary"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6757a6]">
          Session complete
        </p>
        <h2 id="summary-title" className="mt-2 text-2xl font-semibold leading-8 text-slate-950">
          {summary.message}
        </h2>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <SummaryStat value={summary.attempted} label="attempted" />
          <SummaryStat value={summary.correct} label="correct" />
          <SummaryStat value={summary.pagesCovered} label="pages" />
        </div>
        {summary.revisit.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Passages to revisit</h3>
            <ol className="mt-3 space-y-2">
              {summary.revisit.map((text, index) => (
                <li
                  key={`${index}-${text}`}
                  className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600"
                >
                  <span className="mr-2 font-semibold text-[#6757a6]">{index + 1}.</span>
                  {text}
                </li>
              ))}
            </ol>
          </div>
        )}
        <Link
          to="/study-with-annie"
          className="mt-7 flex h-11 items-center justify-center rounded-lg bg-[#6757a6] text-sm font-semibold text-white"
        >
          Back to documents
        </Link>
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-[#f0edfa] p-3">
      <p className="text-2xl font-semibold text-[#574a98]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7566b7]">{label}</p>
    </div>
  );
}

function ReaderLoading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center" role="status">
      <LoaderCircle className="size-7 animate-spin text-[#7566b7]" />
      <span className="sr-only">Opening your document</span>
    </div>
  );
}

function ReaderError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-lg place-items-center p-5 text-center">
      <div>
        <h1 className="text-2xl font-semibold">This document couldn’t open</h1>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
        <Link
          to="/study-with-annie"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-[#6757a6] px-5 text-sm font-semibold text-white"
        >
          Back to documents
        </Link>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  askAnnie,
  deleteAnnieAnnotation,
  evaluateAnnieAnswer,
  finishAnnieSession,
  openAnnieDocument,
  saveAnnieAnnotation,
  saveAnnieSettings,
  skipAnnieQuiz,
} from "./annie.functions";
import { AnniePanel, type AnnieBubble } from "./annie-panel";
import { PdfPage } from "./pdf-page";
import { BehaviorScheduler, pickWeightedQuizCandidate } from "./behavior-scheduler";
import { fallbackLine, stateForResult } from "./config";
import type {
  AnnieAnnotation,
  AnnieSettings,
  AnnieState,
  NormalizedRect,
  QuizCandidate,
  QuizResult,
  ReaderPayload,
  ReaderTheme,
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
  const [settings, setSettings] = useState<AnnieSettings | null>(null);
  const [bubble, setBubble] = useState<AnnieBubble | null>(null);
  const [annieState, setAnnieState] = useState<AnnieState>("reading");
  const [activeQuiz, setActiveQuiz] = useState<QuizCandidate | null>(null);
  const [revealQuiz, setRevealQuiz] = useState(false);
  const [sessionSilenced, setSessionSilenced] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [ending, setEnding] = useState(false);
  const schedulerRef = useRef(new BehaviorScheduler());
  const pageEnteredAt = useRef(Date.now());
  const lastScrollAt = useRef(0);
  const bubbleId = useRef(0);
  const pagesVisited = useRef(new Set<number>([1]));
  const sessionResults = useRef<Array<{ candidateId: string; result: QuizResult }>>([]);

  const showBubble = useCallback((next: Omit<AnnieBubble, "id">) => {
    bubbleId.current += 1;
    setBubble({ ...next, id: bubbleId.current });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void openAnnieDocument({ data: { documentId } })
      .then(async (readerPayload) => {
        if (cancelled) return;
        setPayload(readerPayload);
        setAnnotations(readerPayload.annotations);
        setSettings(readerPayload.settings);
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
        const document = await pdfjs.getDocument({ url: readerPayload.fileUrl }).promise;
        if (cancelled) {
          await document.destroy();
          return;
        }
        setPdf(document);
        showBubble({
          type: "commentary",
          text: fallbackLine(readerPayload.settings.mood, "greeting"),
        });
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "The reader could not be opened.",
        ),
      )
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [documentId, showBubble]);

  useEffect(
    () => () => {
      void pdf?.destroy();
    },
    [pdf],
  );

  useEffect(() => {
    const onScroll = () => {
      lastScrollAt.current = Date.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const silenced = useMemo(() => {
    if (!settings) return false;
    if (sessionSilenced || settings.silenced_forever) return true;
    return settings.silenced_until
      ? new Date(settings.silenced_until).getTime() > Date.now()
      : false;
  }, [sessionSilenced, settings]);

  useEffect(() => {
    if (!bubble || bubble.type === "quiz") return;
    const timer = window.setTimeout(() => {
      schedulerRef.current.recordOutcome("ignored");
      setBubble(null);
      if (activeQuiz) {
        setActiveQuiz(null);
        setRevealQuiz(false);
      }
    }, 9_000);
    return () => window.clearTimeout(timer);
  }, [activeQuiz, bubble]);

  const recordLocalAttempt = useCallback((candidateId: string, result: QuizResult) => {
    sessionResults.current.push({ candidateId, result });
    setPayload((current) =>
      current
        ? {
            ...current,
            quizCandidates: current.quizCandidates.map((candidate) =>
              candidate.id === candidateId
                ? {
                    ...candidate,
                    attempts: [
                      { result, created_at: new Date().toISOString() },
                      ...(candidate.attempts ?? []),
                    ],
                  }
                : candidate,
            ),
          }
        : current,
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (bubble) schedulerRef.current.recordOutcome("dismissed");
      setBubble(null);
      if (bubble?.type !== "quiz") {
        setActiveQuiz(null);
        setRevealQuiz(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bubble]);

  const startQuiz = useCallback(() => {
    if (!payload || !settings || silenced || activeQuiz) return;
    const candidate = pickWeightedQuizCandidate(
      payload.quizCandidates.filter((item) => item.page === currentPage),
      currentPage,
    );
    if (!candidate) {
      showBubble({ type: "commentary", text: "I don’t have a useful blot-out for this page yet." });
      return;
    }
    setActiveQuiz(candidate);
    setRevealQuiz(false);
    setAnnieState("teasing");
    showBubble({ type: "quiz", text: candidate.prompt });
  }, [activeQuiz, currentPage, payload, settings, showBubble, silenced]);

  useEffect(() => {
    if (!payload || !settings) return;
    const timer = window.setInterval(() => {
      const behavior = schedulerRef.current.next({
        currentPage,
        pageEnteredAt: pageEnteredAt.current,
        lastScrollAt: lastScrollAt.current,
        typingNote: tool === "note",
        interactionOpen: Boolean(bubble || activeQuiz),
        silencedUntil: silenced ? "session" : null,
        chattiness: settings.chattiness,
        quizzesEnabled: settings.quizzes_enabled,
        commentaryEnabled: settings.commentary_enabled,
        availableQuizPages: payload.quizCandidates.map((candidate) => candidate.page),
        availableCommentaryPages: payload.commentaryCandidates.map((candidate) => candidate.page),
      });
      if (behavior === "quiz") startQuiz();
      if (behavior === "commentary") {
        const candidates = payload.commentaryCandidates.filter(
          (candidate) => candidate.page === currentPage,
        );
        const candidate = candidates[Math.floor(Math.random() * candidates.length)];
        if (candidate) {
          const moodLead =
            settings.mood === "stern"
              ? "Pay attention to this: "
              : settings.mood === "cheeky"
                ? "Tiny brain hook: "
                : "Here’s a useful anchor: ";
          setAnnieState("thinking");
          showBubble({
            type: "commentary",
            text: `${moodLead}${candidate.text}`,
            beyondNotes: candidate.beyond_notes,
          });
        }
      }
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [activeQuiz, bubble, currentPage, payload, settings, showBubble, silenced, startQuiz, tool]);

  function goToPage(page: number) {
    const maximum = payload?.document.page_count ?? pdf?.numPages ?? 1;
    const next = Math.max(1, Math.min(maximum, page));
    setCurrentPage(next);
    pagesVisited.current.add(next);
    pageEnteredAt.current = Date.now();
    setBubble(null);
    setActiveQuiz(null);
    setRevealQuiz(false);
  }

  async function changeSettings(next: AnnieSettings) {
    const moodChanged = settings?.mood !== next.mood;
    setSettings(next);
    if (moodChanged) showBubble({ type: "commentary", text: fallbackLine(next.mood, "greeting") });
    try {
      const saved = await saveAnnieSettings({ data: next });
      setSettings(saved);
    } catch {
      if (settings) setSettings(settings);
    }
  }

  function silence(choice: "ten_minutes" | "session" | "forever" | "off") {
    if (!settings) return;
    if (choice === "session") {
      setSessionSilenced(true);
      setBubble(null);
      return;
    }
    setSessionSilenced(false);
    const next = {
      ...settings,
      silenced_until:
        choice === "ten_minutes" ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
      silenced_forever: choice === "forever",
    };
    setBubble(null);
    void changeSettings(next);
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

  async function submitQuiz(answer: string) {
    if (!activeQuiz || !payload || !settings) return;
    setAnnieState("thinking");
    const result = await evaluateAnnieAnswer({
      data: {
        candidateId: activeQuiz.id,
        sessionId: payload.sessionId,
        answer,
        mood: settings.mood,
      },
    });
    setRevealQuiz(true);
    setAnnieState(stateForResult(result.result));
    showBubble({ type: "result", text: `${result.reaction} ${result.explanation}` });
    recordLocalAttempt(activeQuiz.id, result.result);
    schedulerRef.current.recordOutcome("engaged");
  }

  async function reveal(kind: "show" | "skip") {
    if (!activeQuiz || !settings) return;
    const result = await skipAnnieQuiz({
      data: { candidateId: activeQuiz.id, mood: settings.mood },
    });
    setRevealQuiz(true);
    setAnnieState("reading");
    showBubble({
      type: "result",
      text: kind === "show" ? `Here it is. ${result.reaction}` : result.reaction,
    });
    recordLocalAttempt(activeQuiz.id, "skipped");
    schedulerRef.current.recordOutcome(kind === "show" ? "engaged" : "dismissed");
  }

  async function ask(question: string) {
    if (!payload || !settings) return;
    setAnnieState("thinking");
    showBubble({ type: "answer", text: fallbackLine(settings.mood, "thinking") });
    const response = await askAnnie({
      data: {
        documentId,
        page: currentPage,
        sessionId: payload.sessionId,
        question,
        mood: settings.mood,
      },
    });
    setAnnieState("reading");
    showBubble({ type: "answer", text: response.answer });
    schedulerRef.current.recordOutcome("engaged");
  }

  async function endSession() {
    if (!payload || !settings || ending) return;
    setEnding(true);
    try {
      const result = await finishAnnieSession({
        data: {
          sessionId: payload.sessionId,
          documentId,
          mood: settings.mood,
          pages: [...pagesVisited.current],
          results: sessionResults.current,
        },
      });
      setSummary(result);
    } finally {
      setEnding(false);
    }
  }

  if (loading) return <ReaderLoading />;
  if (error || !payload || !settings)
    return <ReaderError message={error || "The reader could not be opened."} />;
  if (!pdf) return <ReaderLoading />;

  const pageAnnotations = annotations.filter((annotation) => annotation.page === currentPage);
  const bookmarked = pageAnnotations.some((annotation) => annotation.type === "bookmark");
  const theme = settings.theme;

  return (
    <div className={`annie-reader annie-theme-${theme} min-h-[calc(100dvh-73px)]`}>
      <AnniePanel
        settings={settings}
        state={annieState}
        bubble={bubble}
        activeQuiz={activeQuiz}
        silenced={silenced}
        onSettings={(next) => void changeSettings(next)}
        onDismiss={() => {
          schedulerRef.current.recordOutcome("dismissed");
          setBubble(null);
          if (activeQuiz && revealQuiz) {
            setActiveQuiz(null);
            setRevealQuiz(false);
          }
        }}
        onSilence={silence}
        onQuizNow={startQuiz}
        onSubmitQuiz={submitQuiz}
        onRevealQuiz={reveal}
        onAsk={ask}
      />

      <div className="z-20 border-b border-[var(--reader-border)] bg-[var(--reader-toolbar)] px-3 py-2 shadow-sm sm:px-5">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void endSession()}
              className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
              aria-label="End session and return to notes"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="max-w-48 truncate text-sm font-black sm:max-w-sm">
                {payload.document.title}
              </h1>
              <p className="text-[10px] font-bold text-[var(--reader-muted)]">
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
                className="h-8 w-12 bg-transparent text-center text-xs font-black outline-none"
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
              <span className="min-w-11 text-center text-[10px] font-black">
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
                className="flex items-center gap-1 rounded-full bg-[var(--reader-control)] px-2 py-1.5"
                aria-label="Highlight color"
              >
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setHighlightColor(color)}
                    className={`size-5 rounded-full ${highlightColor === color ? "ring-2 ring-[#7566b7] ring-offset-1" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color} highlight`}
                  />
                ))}
              </div>
            )}
            <select
              value={theme}
              onChange={(event) =>
                void changeSettings({ ...settings, theme: event.target.value as ReaderTheme })
              }
              className="h-9 rounded-full bg-[var(--reader-control)] px-3 text-xs font-black outline-none focus:ring-2 focus:ring-[#7566b7]"
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
              className="h-9 rounded-full bg-[#7566b7] px-4 text-xs font-black text-white disabled:opacity-60"
            >
              {ending ? "Ending…" : "End session"}
            </button>
          </div>
        </div>
      </div>

      <main
        className="overflow-auto bg-[var(--reader-bg)] px-4 py-8 sm:px-8"
        aria-label="PDF reader"
      >
        <PdfPage
          pdf={pdf}
          pageNumber={currentPage}
          scale={scale}
          theme={theme}
          annotations={pageAnnotations}
          tool={tool}
          highlightColor={highlightColor}
          activeQuiz={activeQuiz}
          revealQuiz={revealQuiz}
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

      {summary && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-title"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="ml-auto grid size-9 place-items-center rounded-full hover:bg-slate-100"
              aria-label="Close summary"
            >
              <X className="size-4" />
            </button>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5fb1]">
              Session complete
            </p>
            <h2 id="summary-title" className="mt-2 text-3xl font-black">
              {summary.message}
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <SummaryStat value={summary.attempted} label="attempted" />
              <SummaryStat value={summary.correct} label="correct" />
              <SummaryStat value={summary.pagesCovered} label="pages" />
            </div>
            {summary.revisit.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-black">Passages to revisit</h3>
                <ol className="mt-3 space-y-2">
                  {summary.revisit.map((text, index) => (
                    <li
                      key={text}
                      className="rounded-2xl bg-[#f7f5ef] p-3 text-sm font-semibold leading-relaxed text-slate-600"
                    >
                      <span className="mr-2 font-black text-[#7566b7]">{index + 1}.</span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <Link
              to="/study-with-annie"
              className="clay-button mt-7 flex h-12 items-center justify-center rounded-full bg-[#7566b7] text-sm font-black text-white"
            >
              Back to my notes
            </Link>
          </div>
        </div>
      )}
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
      className={`grid size-8 place-items-center rounded-full disabled:opacity-30 ${active ? "bg-[#7566b7] text-white" : "hover:bg-black/5"}`}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-full bg-[var(--reader-control)] p-0.5 [&_svg]:size-4">
      {children}
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-[#eeeafd] p-3">
      <p className="text-2xl font-black text-[#574a98]">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-[#7566b7]">{label}</p>
    </div>
  );
}

function ReaderLoading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center" role="status">
      <LoaderCircle className="size-8 animate-spin text-[#7566b7]" />
      <span className="sr-only">Opening your notes</span>
    </div>
  );
}

function ReaderError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-lg place-items-center p-5 text-center">
      <div>
        <h1 className="text-2xl font-black">These notes couldn’t open</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">{message}</p>
        <Link
          to="/study-with-annie"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-[#7566b7] px-5 text-sm font-black text-white"
        >
          Back to my notes
        </Link>
      </div>
    </div>
  );
}

// Exam Generator entry page (wireframe 1): hero + how-it-works + resumable
// saved-exams library.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layers3,
  Loader2,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProblem } from "@/lib/log-problem";
import { Chip, PageEyebrow } from "./ui";
import { deleteExam, listExams } from "./exam-generator.functions";
import type { ExamListItem } from "./types";

const STEP_CARDS = [
  {
    icon: BookOpen,
    color: "blue",
    title: "Upload your notes",
    body: "One file or many — PDFs and slide decks.",
  },
  {
    icon: Sparkles,
    color: "pink",
    title: "Test every topic",
    body: "Coverage-first, source-grounded questions.",
  },
  {
    icon: Layers3,
    color: "yellow",
    title: "Keep what matters",
    body: "Save tricky questions to flashcard decks.",
  },
];

export function ExamHome() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setExams(await listExams());
      setError("");
    } catch (err) {
      logProblem("Exam Generator library", err);
      setError(err instanceof Error ? err.message : "Your exams could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  // Keep the library fresh while an exam is still generating.
  useEffect(() => {
    if (!exams.some((e) => e.status === "generating")) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [exams, load]);

  const openExam = (exam: ExamListItem) => {
    if (exam.status === "generating")
      return navigate({ to: "/exams/$examId", params: { examId: exam.id } });
    if (exam.attempt?.status === "submitted")
      return navigate({
        to: "/exams/$examId",
        params: { examId: exam.id },
        search: { mode: "review" },
      });
    if (exam.attempt?.status === "in_progress")
      return navigate({
        to: "/exams/$examId",
        params: { examId: exam.id },
        search: { mode: "take" },
      });
    return navigate({ to: "/exams/$examId", params: { examId: exam.id } });
  };

  const remove = async (exam: ExamListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete “${exam.title}” and its questions? This can’t be undone.`)) return;
    setExams((cur) => cur.filter((x) => x.id !== exam.id));
    try {
      await deleteExam({ data: { examId: exam.id } });
    } catch (err) {
      logProblem("Delete exam", err);
      void load();
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="clay-card overflow-hidden bg-blue-soft p-6 md:p-9">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div>
            <PageEyebrow>Your notes. Your exam.</PageEyebrow>
            <h1 className="mt-3 font-display text-3xl font-black leading-tight md:text-5xl">
              Study smarter.
              <br />
              Remember more.
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-ink-soft">
              Turn PDFs and lecture slides into source-grounded exams that cover the whole topic —
              then save the tricky questions to flashcards as you go.
            </p>
            <Button variant="blue" className="mt-5" onClick={() => navigate({ to: "/exams/new" })}>
              <Sparkles /> Create an exam <ArrowRight />
            </Button>
          </div>
          <div className="hidden justify-center md:flex">
            <div className="relative">
              <div className="flex h-44 w-36 rotate-6 flex-col gap-2.5 rounded-3xl border-[6px] border-card bg-card p-5 shadow-[0_12px_20px_-10px_var(--border)]">
                <span className="h-2 w-full rounded-full bg-blue" />
                <span className="h-2 w-5/6 rounded-full bg-blue/60" />
                <span className="h-2 w-2/3 rounded-full bg-blue/40" />
                <span className="mt-auto h-2 w-3/4 rounded-full bg-blue/40" />
              </div>
              <span className="absolute -right-4 top-2 flex size-16 -rotate-6 items-center justify-center rounded-3xl bg-pink text-3xl shadow-md">
                ✎
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-4 sm:grid-cols-3">
        {STEP_CARDS.map((step) => (
          <div key={step.title} className={`clay-card bg-${step.color}-soft p-5`}>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-card/70 text-foreground">
              <step.icon size={22} />
            </span>
            <h3 className="mt-3 font-display text-base font-black">{step.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
          </div>
        ))}
      </section>

      {/* Saved exams */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-black md:text-2xl">
            Pick up where you left off
          </h2>
          <Button variant="blue" size="sm" onClick={() => navigate({ to: "/exams/new" })}>
            New exam
          </Button>
        </div>

        {error && (
          <div className="clay-card bg-pink-soft p-4 text-sm font-semibold text-[color:var(--case-pink-ink)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="clay-card grid min-h-40 place-items-center bg-card">
            <Loader2 className="size-6 animate-spin text-blue" />
          </div>
        ) : exams.length === 0 ? (
          <div className="clay-card bg-card p-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-soft text-blue">
              <FileText />
            </span>
            <h3 className="mt-4 font-display text-lg font-black">No exams yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a set of notes to generate your first comprehensive exam.
            </p>
            <Button variant="blue" className="mt-5" onClick={() => navigate({ to: "/exams/new" })}>
              <Sparkles /> Create an exam
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => openExam(exam)}
                className="clay-card flex w-full items-center gap-4 bg-card p-4 text-left"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-soft text-blue">
                  <FileText size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-black">{exam.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {exam.sourceDocuments.map((d) => d.name).join(" · ") || "Generated exam"}
                  </p>
                </div>
                {exam.focusAreas && (
                  <span className="hidden sm:block">
                    <Chip tone="lavender">
                      <Target className="size-3" /> Focused
                    </Chip>
                  </span>
                )}
                <StatusChip exam={exam} />
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${exam.title}`}
                  onClick={(e) => void remove(exam, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      void remove(exam, e as unknown as React.MouseEvent);
                  }}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-pink-soft hover:text-[color:var(--case-pink-ink)]"
                >
                  <Trash2 size={16} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusChip({ exam }: { exam: ExamListItem }) {
  if (exam.status === "generating")
    return (
      <Chip tone="lavender">
        <Loader2 className="size-3 animate-spin" /> Generating…
      </Chip>
    );
  if (exam.status === "failed") return <Chip tone="pink">Failed</Chip>;
  if (exam.attempt?.status === "submitted")
    return (
      <Chip tone="mint">
        Completed · {exam.attempt.answered} / {exam.attempt.total} answered
      </Chip>
    );
  if (exam.attempt?.status === "in_progress")
    return (
      <Chip tone="yellow">
        {exam.attempt.answered} / {exam.attempt.total} answered
      </Chip>
    );
  return <Chip tone="blue">{exam.questionCount} questions</Chip>;
}

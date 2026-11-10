// Results + review (wireframe 8). The summary is computed server-side with no
// AI. The per-question review reveals correct answers/explanations (only now
// that the exam is submitted) and offers optional on-demand AI grading for
// written answers.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProblem } from "@/lib/log-problem";
import { Bar, Chip } from "./ui";
import {
  getExamReview,
  gradeWrittenAnswer,
  resetAttempt,
  type ExamReview as ExamReviewData,
} from "./exam-generator.functions";
import type { ExamAnswer, ExamQuestion } from "./types";

export function ExamReview({ examId, onRetake }: { examId: string; onRetake: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ExamReviewData | null>(null);
  const [error, setError] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getExamReview({ data: { examId } }));
    } catch (err) {
      logProblem("Exam review", err);
      setError(err instanceof Error ? err.message : "Your results could not be loaded.");
    }
  }, [examId]);

  useEffect(() => void load(), [load]);

  // Re-read after a written answer is graded so the summary, topic performance
  // and weak areas pick up the new judgement. Kept separate from `load` so a
  // failed refresh never replaces results the student is already reading.
  const refresh = useCallback(async () => {
    try {
      setData(await getExamReview({ data: { examId } }));
    } catch (err) {
      logProblem("Exam review refresh", err);
    }
  }, [examId]);

  const retake = async () => {
    try {
      await resetAttempt({ data: { examId } });
      onRetake();
    } catch (err) {
      logProblem("Reset attempt", err);
    }
  };

  if (error) {
    return (
      <div className="clay-card bg-pink-soft p-6 text-sm font-semibold text-[color:var(--case-pink-ink)]">
        {error}
      </div>
    );
  }
  if (!data || !data.summary) {
    return (
      <div className="grid min-h-60 place-items-center">
        <Loader2 className="size-7 animate-spin text-blue" />
      </div>
    );
  }

  const s = data.summary;
  const answerByQ = new Map(data.answers.map((a) => [a.questionId, a]));
  // Only MCQs and graded written answers can be judged correct, so the tile
  // below reports against that subset rather than every question.
  const graded = s.correct + s.incorrect;

  // Weak areas for a focused retake: topics the student scored below 70% on
  // (topicPerformance is already sorted weakest-first). If they aced everything,
  // fall back to their three lowest topics so the button is still useful.
  const gradedTopics = s.topicPerformance.filter((t) => t.total > 0);
  const weakTopics = (
    gradedTopics.filter((t) => t.percent < 70).length
      ? gradedTopics.filter((t) => t.percent < 70)
      : gradedTopics.slice(0, 3)
  )
    .slice(0, 6)
    .map((t) => t.topic);
  const focusQuery = weakTopics.join(", ");

  return (
    <div>
      {/* Hero summary */}
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex size-28 shrink-0 flex-col items-center justify-center rounded-[36px] bg-mint shadow-[0_8px_0_#99d8b6]">
          <span className="font-display text-2xl font-black">
            {s.answered}/{s.total}
          </span>
          <span className="text-[11px] font-bold text-[color:var(--case-mint-ink)]">answered</span>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[color:var(--case-mint-ink)]">
            You did it! 🎉
          </p>
          <h1 className="mt-1 font-display text-3xl font-black md:text-4xl">Exam complete</h1>
          <p className="mt-1 max-w-md text-ink-soft">{s.message}</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="clay-card bg-blue-soft p-5 text-center">
          <p className="font-display text-2xl font-black">
            {s.correct} / {graded}
          </p>
          <p className="mt-1 text-xs font-bold text-ink-soft">Correct of graded</p>
        </div>
        <div className="clay-card bg-pink-soft p-5 text-center">
          <p className="font-display text-2xl font-black">{s.incorrect + s.unanswered}</p>
          <p className="mt-1 text-xs font-bold text-ink-soft">Missed / unanswered</p>
        </div>
        <div className="clay-card bg-yellow-soft p-5 text-center">
          <p className="font-display text-2xl font-black">{s.savedFlashcards}</p>
          <p className="mt-1 text-xs font-bold text-ink-soft">Saved flashcards</p>
        </div>
      </div>

      {/* Where to focus */}
      {s.topicPerformance.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-xl font-black">Where to focus next</h2>
          <div className="clay-card space-y-3 bg-card p-5">
            {s.topicPerformance.slice(0, 8).map((t) => (
              <div key={t.topic} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate font-bold md:w-56">{t.topic}</span>
                <div className="flex-1">
                  <Bar
                    percent={t.percent}
                    tone={t.percent >= 80 ? "mint" : t.percent >= 50 ? "blue" : "pink"}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-bold text-muted-foreground">
                  {t.percent}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.written > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {s.written} written answer{s.written === 1 ? "" : "s"} can’t be scored automatically.
          Grade {s.written === 1 ? "it" : "them"} below so your weak areas account for
          {s.written === 1 ? " it" : " them"} too.
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button variant="secondary" onClick={() => setShowAnswers((v) => !v)}>
          <BookOpen /> {showAnswers ? "Hide answers" : "View answers & explanations"}
        </Button>
        <Button variant="yellow" onClick={() => navigate({ to: "/flashcards" })}>
          Open my flashcards <ArrowRight />
        </Button>
        <Button variant="ghost" onClick={() => void retake()}>
          <RotateCcw /> Retake
        </Button>
        <Button
          variant="blue"
          onClick={() =>
            navigate({ to: "/exams/new", search: focusQuery ? { focus: focusQuery } : {} })
          }
        >
          <Sparkles /> {focusQuery ? "Target my weak areas" : "Generate another"}
        </Button>
      </div>

      {/* Answer review */}
      {showAnswers && (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-xl font-black">Answers &amp; explanations</h2>
          {data.questions.map((q, i) => (
            <QuestionReview
              key={q.id}
              examId={examId}
              index={i}
              question={q}
              answer={answerByQ.get(q.id) ?? null}
              onGraded={() => void refresh()}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function QuestionReview({
  examId,
  index,
  question,
  answer,
  onGraded,
}: {
  examId: string;
  index: number;
  question: ExamQuestion;
  answer: ExamAnswer | null;
  onGraded: () => void;
}) {
  const [grade, setGrade] = useState<{
    verdict: string;
    feedback: string;
    sufficientUnderstanding: boolean;
  } | null>(
    answer?.aiVerdict
      ? {
          verdict: answer.aiVerdict,
          feedback: answer.aiFeedback ?? "",
          sufficientUnderstanding: answer.isCorrect === true,
        }
      : null,
  );
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");

  const runGrade = async () => {
    setGrading(true);
    setGradeError("");
    try {
      const res = await gradeWrittenAnswer({ data: { examId, questionId: question.id } });
      setGrade({
        verdict: res.verdict,
        feedback: res.feedback,
        sufficientUnderstanding: res.sufficientUnderstanding,
      });
      onGraded();
    } catch (err) {
      logProblem("Grade written answer", err);
      setGradeError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setGrading(false);
    }
  };

  const isMcq = question.type === "mcq";
  const correct = answer?.isCorrect;

  return (
    <article className="clay-card bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Chip tone="blue">
          {question.topic} · {question.type.toUpperCase()}
        </Chip>
        {isMcq ? (
          correct ? (
            <Chip tone="mint">
              <CheckCircle2 className="size-3" /> Correct
            </Chip>
          ) : (
            <Chip tone="pink">
              <XCircle className="size-3" /> {answer?.selectedOption ? "Incorrect" : "Unanswered"}
            </Chip>
          )
        ) : grade ? (
          grade.sufficientUnderstanding ? (
            <Chip tone="mint">
              <CheckCircle2 className="size-3" /> Understood
            </Chip>
          ) : (
            <Chip tone="pink">
              <XCircle className="size-3" /> Needs review
            </Chip>
          )
        ) : null}
      </div>
      <h3 className="mt-3 whitespace-pre-line font-display font-black leading-relaxed">
        {index + 1}. {question.questionText}
      </h3>

      {isMcq && question.options && (
        <div className="mt-3 space-y-2">
          {question.options.map((opt) => {
            const isCorrectOpt = opt.id === question.correctOption;
            const isPicked = opt.id === answer?.selectedOption;
            return (
              <div
                key={opt.id}
                className={`rounded-xl p-3 text-sm ${
                  isCorrectOpt
                    ? "bg-mint-soft ring-1 ring-mint"
                    : isPicked
                      ? "bg-pink-soft ring-1 ring-pink"
                      : "bg-muted/40"
                }`}
              >
                <span className="font-bold">{opt.id}.</span> {opt.text}
                {isCorrectOpt && (
                  <span className="ml-2 text-xs font-bold text-[color:var(--case-mint-ink)]">
                    ✓ correct
                  </span>
                )}
                {isPicked && !isCorrectOpt && (
                  <span className="ml-2 text-xs font-bold text-[color:var(--case-pink-ink)]">
                    your answer
                  </span>
                )}
                {question.optionExplanations?.[opt.id] && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.optionExplanations[opt.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isMcq && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-xs font-extrabold uppercase text-muted-foreground">Your answer</p>
            <p className="mt-1 whitespace-pre-line rounded-xl bg-muted/40 p-3">
              {answer?.responseText?.trim() || "— (no answer)"}
            </p>
          </div>
          {question.modelAnswer && (
            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Expected answer
              </p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-mint-soft p-3">
                {question.modelAnswer}
              </p>
            </div>
          )}
          {question.rubric && question.rubric.length > 0 && (
            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Marking guide
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {question.rubric.map((r, i) => (
                  <li key={i}>
                    <span className="font-bold">({r.marks})</span> {r.point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {grade ? (
            <div
              className={`rounded-xl p-3 ${
                grade.sufficientUnderstanding ? "bg-mint-soft" : "bg-pink-soft"
              }`}
            >
              <p
                className={`text-xs font-extrabold uppercase ${
                  grade.sufficientUnderstanding
                    ? "text-[color:var(--case-mint-ink)]"
                    : "text-[color:var(--case-pink-ink)]"
                }`}
              >
                {grade.sufficientUnderstanding
                  ? "Sufficient understanding"
                  : "Not yet sufficient"}{" "}
                · {grade.verdict.replace("_", " ")}
              </p>
              <p className="mt-1">{grade.feedback}</p>
            </div>
          ) : answer?.responseText?.trim() ? (
            <Button variant="blue" size="sm" disabled={grading} onClick={() => void runGrade()}>
              {grading ? <Loader2 className="animate-spin" /> : <Sparkles />} Grade my answer
            </Button>
          ) : null}
          {gradeError && (
            <p className="text-xs font-semibold text-[color:var(--case-pink-ink)]">{gradeError}</p>
          )}
        </div>
      )}

      {question.explanation && (
        <div className="mt-3 rounded-xl bg-blue-soft/60 p-3 text-sm">
          <span className="font-bold">Why:</span> {question.explanation}
        </div>
      )}
      {(question.sourceRef || question.sourceDocument) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Source: {question.sourceRef || question.sourceDocument}
        </p>
      )}
    </article>
  );
}

import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { logProblem } from "@/lib/log-problem";
import { CoverageOverview, FailedExam } from "@/features/exam-generator/coverage-overview";
import { GenerationProgress } from "@/features/exam-generator/generation-progress";
import { ExamPlayer } from "@/features/exam-generator/player";
import { ExamReview } from "@/features/exam-generator/review";
import {
  getExamOverview,
  retryExam,
  deleteExam,
} from "@/features/exam-generator/exam-generator.functions";
import type { ExamOverview } from "@/features/exam-generator/types";

const search = z.object({
  mode: z.enum(["take", "review"]).optional().catch(undefined),
});

export const Route = createFileRoute("/exams/$examId")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Exam | Medley" }] }),
  component: ExamDetailPage,
});

function ExamDetailPage() {
  const { examId } = Route.useParams();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<ExamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    try {
      setOverview(await getExamOverview({ data: { examId } }));
      setError("");
    } catch (err) {
      logProblem("Exam overview", err);
      setError(err instanceof Error ? err.message : "This exam could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => void refetch(), [refetch]);

  const goTake = () =>
    navigate({ to: "/exams/$examId", params: { examId }, search: { mode: "take" } });
  const goReview = () =>
    navigate({ to: "/exams/$examId", params: { examId }, search: { mode: "review" } });

  const retry = async () => {
    try {
      await retryExam({ data: { examId } });
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "This exam can’t be retried.");
    }
  };
  const remove = async () => {
    if (!window.confirm("Delete this exam?")) return;
    try {
      await deleteExam({ data: { examId } });
      await navigate({ to: "/exams" });
    } catch (err) {
      logProblem("Delete exam", err);
    }
  };

  const BackLink = (
    <Link
      to="/exams"
      className="mb-5 inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={16} /> Exam Generator
    </Link>
  );

  if (loading) {
    return (
      <div className="grid min-h-60 place-items-center">
        <Loader2 className="size-7 animate-spin text-blue" />
      </div>
    );
  }
  if (error || !overview) {
    return (
      <div>
        {BackLink}
        <div className="clay-card bg-pink-soft p-6 text-sm font-semibold text-[color:var(--case-pink-ink)]">
          {error || "Exam not found."}
        </div>
      </div>
    );
  }

  if (overview.status === "generating") {
    return <GenerationProgress examId={examId} onComplete={() => void refetch()} />;
  }
  if (overview.status === "failed") {
    return (
      <div>
        {BackLink}
        <FailedExam
          overview={overview}
          canRetry
          onRetry={() => void retry()}
          onDelete={() => void remove()}
        />
      </div>
    );
  }

  // ready | partial
  if (mode === "take") {
    return (
      <div>
        {BackLink}
        <ExamPlayer examId={examId} onSubmitted={goReview} />
      </div>
    );
  }
  if (mode === "review") {
    return (
      <div>
        {BackLink}
        <ExamReview examId={examId} onRetake={goTake} />
      </div>
    );
  }
  return (
    <div>
      {BackLink}
      <CoverageOverview overview={overview} onStart={goTake} resuming={false} />
    </div>
  );
}

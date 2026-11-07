// Coverage review (wireframe 4): what was built, topic coverage, honest
// caveats, and the Start action. Also the failed-exam state.
import { useState } from "react";
import { ArrowRight, FileText, Layers3, ListChecks, RefreshCw, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, Chip, PageEyebrow, StatTile, Stepper } from "./ui";
import type { ExamOverview } from "./types";

export function CoverageOverview({
  overview,
  onStart,
  resuming,
}: {
  overview: ExamOverview;
  onStart: () => void;
  resuming: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const { coverage } = overview;
  const topics = showAll ? coverage.topics : coverage.topics.slice(0, 6);
  const dist = coverage.typeDistribution;

  return (
    <div>
      <Stepper current={2} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageEyebrow>Ready when you are</PageEyebrow>
          <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">
            Your exam is ready! <span className="text-[color:var(--case-orange)]">✦</span>
          </h1>
          <p className="mt-2 max-w-md text-ink-soft">
            Built topic by topic from {overview.sourceDocuments.length} source
            {overview.sourceDocuments.length === 1 ? "" : "s"}, grounded in your material.
          </p>
        </div>
        <span className="hidden size-20 shrink-0 place-items-center rounded-3xl bg-yellow text-4xl shadow-[0_8px_0_#edcf70] sm:grid">
          <Trophy className="size-9 text-[color:var(--case-yellow-ink)]" />
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatTile
          icon={<FileText />}
          value={overview.questionCount}
          label="Practice questions"
          color="blue"
        />
        <StatTile
          icon={<Layers3 />}
          value={coverage.topics.length}
          label="Topics covered"
          color="pink"
        />
        <StatTile
          icon={<ListChecks />}
          value={overview.sourceDocuments.length}
          label="Source files"
          color="mint"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="blue">{dist.mcq} multiple choice</Chip>
        <Chip tone="mint">{dist.short} short answer</Chip>
        <Chip tone="lavender">{dist.long} long answer</Chip>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-black">Coverage by topic</h2>
          {coverage.topics.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-extrabold text-blue"
            >
              {showAll ? "Show less" : `Open coverage map (${coverage.topics.length})`}
            </button>
          )}
        </div>
        <div className="clay-card space-y-3 bg-card p-5">
          {topics.map((t) => (
            <div key={t.topic} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate font-bold md:w-56">{t.topic}</span>
              <div className="flex-1">
                <Bar
                  percent={t.percent}
                  tone={t.percent >= 80 ? "mint" : t.percent >= 50 ? "blue" : "yellow"}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-bold text-muted-foreground">
                {t.percent}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {coverage.warnings.length > 0 && (
        <div className="mt-4 rounded-2xl bg-yellow-soft p-4 text-sm text-[color:var(--case-yellow-ink)]">
          <p className="font-bold">⚠️ Coverage is the goal, not a guarantee.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {coverage.warnings.slice(0, 4).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button variant="blue" size="lg" disabled={resuming} onClick={onStart}>
          {overview.status === "partial" ? "Start exam anyway" : "Start exam"} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

export function FailedExam({
  overview,
  canRetry,
  onRetry,
  onDelete,
}: {
  overview: ExamOverview;
  canRetry: boolean;
  onRetry: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-pink-soft text-4xl">
        ⚠️
      </span>
      <h1 className="mt-4 font-display text-2xl font-black">Generation didn’t finish</h1>
      <p className="mt-2 text-ink-soft">
        {overview.generationError ||
          "We couldn’t generate this exam from the uploaded material. Your notes were not stored, so you can upload them again."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {canRetry && (
          <Button variant="blue" onClick={onRetry}>
            <RefreshCw /> Retry
          </Button>
        )}
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  );
}

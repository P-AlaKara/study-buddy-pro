import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  CloudOff,
  ExternalLink,
  GitPullRequestDraft,
  Hammer,
  LoaderCircle,
  PencilLine,
  Play,
  Rocket,
  Stethoscope,
  XCircle,
} from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { blankAsset } from "../case-edits";
import { collectChecks, type StudioCheck } from "../issue-guide";
import type { UploadedImage } from "../image-upload";
import type { ReviewRecord, ReviewUpdate } from "../reviews";
import type { PublishOutcome, SaveState } from "../use-studio-cases";
import {
  BUILD_STEPS,
  BUILD_STEP_META,
  REVIEW_STAGES,
  REVIEW_STAGE_META,
  buildStepForStage,
  reviewStageForStep,
  type BuildStep,
  type ReviewStage,
} from "../vocabulary";
import { ActionFinder } from "./action-finder";
import { AssetDialog } from "./builder/image-library";
import { BuilderActionsStep } from "./builder/step-actions";
import { BuilderBasicsStep } from "./builder/step-basics";
import { BuilderFinishStep } from "./builder/step-finish";
import { BuilderPatientStep } from "./builder/step-patient";
import { BuilderProgressionStep } from "./builder/step-progression";
import { BuilderScoringStep } from "./builder/step-scoring";
import { ReviewActionsStage } from "./review/review-actions";
import { ReviewPatientStage } from "./review/review-patient";
import { ReviewScoringStage } from "./review/review-scoring";
import { ReviewSummaryStage } from "./review/review-summary";
import { ReviewTimelineStage } from "./review/review-timeline";
import { Button, Callout, FOCUS_RING, Tag, useConfirm } from "./studio-ui";
import {
  scrollToAnchor,
  WorkspaceProvider,
  type FocusRequest,
  type JumpTarget,
} from "./workspace-context";

export type StudioMode = "build" | "review";

function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* ---- Step rail ----------------------------------------------------------- */

interface RailItem {
  key: string;
  title: string;
  short: string;
  state: "done" | "attention" | "todo";
  detail: string;
}

function StepRail({
  items,
  current,
  onSelect,
  heading,
}: {
  items: RailItem[];
  current: string;
  onSelect: (key: string) => void;
  heading: string;
}) {
  const currentRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);
  const index = items.findIndex((item) => item.key === current);
  return (
    <nav aria-label={heading} className="min-w-0">
      {/* Phones and tablets: a scrollable strip. */}
      <div className="lg:hidden">
        <p className="mb-2 text-[13px] font-bold text-muted-foreground">
          {heading}: step {index + 1} of {items.length}
        </p>
        <ol className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {items.map((item, i) => {
            const active = item.key === current;
            return (
              <li key={item.key} className="snap-start">
                <button
                  ref={active ? currentRef : undefined}
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-extrabold",
                    FOCUS_RING,
                    active ? "bg-[#2b2540] text-white" : "bg-card ring-1 ring-border",
                  )}
                >
                  <RailIcon state={item.state} number={i + 1} active={active} />
                  {item.short}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Desktop: a vertical checklist. */}
      <div className="hidden rounded-[24px] bg-card p-3 shadow-[0_10px_22px_-14px_rgb(60_45_110/0.28)] ring-1 ring-border/60 lg:block">
        <p className="px-2 pb-2 pt-1 text-[12px] font-black uppercase tracking-[0.1em] text-ink-soft">
          {heading}
        </p>
        <ol className="space-y-0.5">
          {items.map((item, i) => {
            const active = item.key === current;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors",
                    FOCUS_RING,
                    active ? "bg-lavender-soft" : "hover:bg-muted",
                  )}
                >
                  <RailIcon state={item.state} number={i + 1} active={active} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm leading-snug",
                        active ? "font-black" : "font-bold",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.detail && (
                      <span
                        className={cn(
                          "mt-0.5 block text-xs font-bold",
                          item.state === "attention" ? "text-[#8f2424]" : "text-muted-foreground",
                        )}
                      >
                        {item.detail}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function RailIcon({
  state,
  number,
  active,
}: {
  state: RailItem["state"];
  number: number;
  active: boolean;
}) {
  if (state === "done") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0b5f5c] text-white">
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (state === "attention") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#b42323] text-white">
        <XCircle aria-hidden className="size-3.5" />
        <span className="sr-only">Needs attention</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black",
        active ? "bg-[#5a44b5] text-white" : "bg-muted text-ink-soft ring-1 ring-border",
      )}
    >
      {number}
    </span>
  );
}

/* ---- Workspace --------------------------------------------------------- */

export interface WorkspaceEntry {
  kind: "bank" | "draft";
  definition: MedicalCase;
  updatedAt?: string;
  /** For a revision draft: the published case it changes. */
  revisionOf?: MedicalCase | undefined;
}

/** Where to land after a published case has become a revision. */
export interface ResumeEdit {
  mode: StudioMode;
  step: string;
  focus: Omit<FocusRequest, "nonce">;
  returnTo?: ReviewStage | undefined;
}

export function CaseWorkspace({
  entry,
  mode,
  step,
  saveState,
  record,
  updateReview,
  resume,
  onNavigate,
  onBack,
  onChange,
  onUploadImage,
  onResolveConflict,
  onPublish,
  onDelete,
  onPlaytest,
  onStartRevision,
  onNotice,
}: {
  entry: WorkspaceEntry;
  mode: StudioMode;
  step: string | undefined;
  saveState: SaveState;
  record: ReviewRecord | undefined;
  updateReview: ReviewUpdate;
  /** Set once, right after a revision was started from an Edit button. */
  resume?: ResumeEdit | null | undefined;
  onNavigate: (next: { mode?: StudioMode; step?: string }, options?: { replace?: boolean }) => void;
  onBack: () => void;
  onChange: (next: MedicalCase) => void;
  onUploadImage: (file: File) => Promise<UploadedImage>;
  onResolveConflict: (keep: "mine" | "theirs") => void;
  onPublish: () => Promise<PublishOutcome>;
  onDelete: () => void;
  onPlaytest: () => void;
  onStartRevision: (resume: ResumeEdit) => void;
  onNotice: (message: string) => void;
}) {
  const { definition, revisionOf } = entry;
  // Drafts and revisions can be edited; a published case becomes a revision first.
  const editable = entry.kind === "draft";
  const confirm = useConfirm();
  const checks = useMemo(() => collectChecks(definition), [definition]);
  const errors = checks.filter((check) => check.severity === "error");
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [returnTo, setReturnTo] = useState<ReviewStage | null>(resume?.returnTo ?? null);
  const [assetIndex, setAssetIndex] = useState<number | null>(null);
  const nonce = useRef(0);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const effectiveMode: StudioMode = editable ? mode : "review";

  const buildStep: BuildStep = (BUILD_STEPS as readonly string[]).includes(step ?? "")
    ? (step as BuildStep)
    : "basics";
  const reviewStage: ReviewStage = (REVIEW_STAGES as readonly string[]).includes(step ?? "")
    ? (step as ReviewStage)
    : "patient";
  const current = effectiveMode === "build" ? buildStep : reviewStage;

  const requestFocus = useCallback((request: Omit<FocusRequest, "nonce">) => {
    nonce.current += 1;
    setFocus({ ...request, nonce: nonce.current });
  }, []);

  // Continue the edit that started the revision (open the card, or the field).
  useEffect(() => {
    if (resume) requestFocus(resume.focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (key: string, options?: { replace?: boolean }) => {
      onNavigate({ step: key }, { replace: options?.replace ?? true });
      requestAnimationFrame(() =>
        mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    [onNavigate],
  );

  const jump = useCallback(
    (target: JumpTarget) => {
      const key = effectiveMode === "build" ? target.step : reviewStageForStep(target.step);
      onNavigate({ step: key }, { replace: true });
      requestFocus({
        ...(target.actionId ? { actionId: target.actionId } : {}),
        ...(target.anchor ? { anchor: target.anchor } : {}),
      });
      if (!target.actionId && !target.anchor) {
        requestAnimationFrame(() =>
          mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    },
    [effectiveMode, onNavigate, requestFocus],
  );

  /*
   * Every "Edit" button lands here. Actions open their editor in place, in
   * whichever mode you are in; anything else opens the builder at that field,
   * with a way back to the review. A published case becomes a revision first.
   */
  const edit = useCallback(
    async (target: JumpTarget) => {
      const inPlace = Boolean(target.actionId) && effectiveMode === "review";
      const request = {
        ...(target.actionId ? { actionId: target.actionId } : {}),
        ...(target.anchor ? { anchor: target.anchor } : {}),
        edit: true,
      };
      const from = effectiveMode === "review" ? reviewStage : undefined;
      if (!editable) {
        const ok = await confirm({
          title: "Edit this published case?",
          tone: "primary",
          confirmLabel: "Start editing",
          description: (
            <p>
              Your changes are saved as unpublished changes to “{definition.title}”, which other
              content creators can see. Students keep the current version until the changes are
              published.
            </p>
          ),
        });
        if (!ok) return;
        onStartRevision({
          mode: inPlace ? "review" : "build",
          step: inPlace ? reviewStage : target.step,
          focus: request,
          ...(!inPlace && from ? { returnTo: from } : {}),
        });
        return;
      }
      if (inPlace) {
        requestFocus(request);
        return;
      }
      setReturnTo(from ?? null);
      onNavigate({ mode: "build", step: target.step }, { replace: false });
      requestFocus(request);
    },
    [
      confirm,
      definition.title,
      editable,
      effectiveMode,
      onNavigate,
      onStartRevision,
      requestFocus,
      reviewStage,
    ],
  );

  // Anchors (fields, events) are scrolled to once the step has rendered.
  useEffect(() => {
    if (!focus?.anchor) return;
    const anchor = focus.anchor;
    let tries = 0;
    const attempt = () => {
      if (scrollToAnchor(anchor) || tries > 8) return;
      tries += 1;
      window.setTimeout(attempt, 80);
    };
    const frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const railItems: RailItem[] =
    effectiveMode === "build"
      ? BUILD_STEPS.map((key) => {
          const stepErrors = checks.filter(
            (check) => check.step === key && check.severity === "error",
          ).length;
          const count = (category: "ask" | "examine" | "test" | "treat") =>
            definition.actions.filter((action) => action.category === category).length;
          const content: Record<BuildStep, boolean> = {
            basics: Boolean(definition.title && definition.differential.length),
            patient: Boolean(definition.patient.name && definition.intro),
            history: count("ask") > 0,
            examination: count("examine") > 0,
            tests: count("test") > 0,
            treatment: count("treat") > 0,
            progression: definition.deteriorationRules.length > 0,
            scoring:
              definition.solution.keyTreatment.length > 0 &&
              definition.hints.every((hint) => hint.text.trim()),
            finish: errors.length === 0,
          };
          const counts: Partial<Record<BuildStep, number>> = {
            history: count("ask"),
            examination: count("examine"),
            tests: count("test"),
            treatment: count("treat"),
            progression: definition.deteriorationRules.length,
          };
          return {
            key,
            title: BUILD_STEP_META[key].title,
            short: BUILD_STEP_META[key].short,
            state: stepErrors ? "attention" : content[key] ? "done" : "todo",
            detail: stepErrors
              ? `${stepErrors} to fix`
              : counts[key] !== undefined
                ? `${counts[key]} added`
                : "",
          };
        })
      : REVIEW_STAGES.map((key) => {
          const reviewed = record?.reviewedStages.includes(key);
          return {
            key,
            title: REVIEW_STAGE_META[key].title,
            short: REVIEW_STAGE_META[key].short,
            state: key !== "decision" && reviewed ? "done" : "todo",
            detail: key !== "decision" && reviewed ? "Reviewed" : "",
          };
        });

  const index = railItems.findIndex((item) => item.key === current);
  const previous = railItems[index - 1];
  const next = railItems[index + 1];
  const reviewed = effectiveMode === "review" && record?.reviewedStages.includes(reviewStage);

  const markReviewed = (value: boolean) =>
    updateReview((current) => ({
      ...current,
      reviewedStages: value
        ? [...new Set([...current.reviewedStages, reviewStage])]
        : current.reviewedStages.filter((stage) => stage !== reviewStage),
    }));

  const onAddImage = () => {
    const asset = blankAsset(definition);
    onChange({ ...definition, assets: [...definition.assets, asset] });
    setAssetIndex(definition.assets.length);
  };

  const switchMode = (item: StudioMode) => {
    setReturnTo(null);
    onNavigate(
      {
        mode: item,
        step: item === "review" ? reviewStageForStep(buildStep) : buildStepForStage(reviewStage),
      },
      { replace: false },
    );
  };

  const [publishing, setPublishing] = useState(false);
  const [publishProblems, setPublishProblems] = useState<string[]>([]);
  const canPublish = editable && errors.length === 0 && saveState.kind !== "conflict";
  const publishNow = async () => {
    const ok = await confirm({
      title: revisionOf ? "Publish these changes?" : "Publish this case?",
      tone: "primary",
      confirmLabel: "Publish",
      description: revisionOf
        ? "Students see the updated case straight away."
        : "It appears in the student case library straight away.",
    });
    if (!ok) return;
    setPublishing(true);
    setPublishProblems([]);
    const outcome = await onPublish();
    setPublishing(false);
    if (outcome.status === "invalid") {
      setPublishProblems(outcome.problems);
    } else if (outcome.status === "conflict") {
      onNotice("Someone else changed this case. Choose whose version to keep, then publish.");
    } else if (outcome.status === "error") {
      onNotice(outcome.message);
    }
  };

  return (
    <WorkspaceProvider
      value={{
        focus,
        jump,
        edit: (target) => void edit(target),
        editor: editable
          ? { definition, onChange, checks, onAddImage, uploadImage: onUploadImage }
          : undefined,
        publish: editable
          ? {
              run: () => void publishNow(),
              disabled: !canPublish,
              busy: publishing,
              isChange: Boolean(revisionOf),
            }
          : undefined,
      }}
    >
      <div className="space-y-5 pb-16">
        <header className="rounded-[26px] bg-gradient-to-br from-lavender-soft via-card to-blue-soft/50 p-4 shadow-[0_10px_22px_-14px_rgb(60_45_110/0.3)] ring-1 ring-border/60 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="ghost" size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden className="size-4" /> All cases
            </Button>
            <span className="text-[13px] font-bold text-muted-foreground">
              {!editable ? (
                "Published case · live for students"
              ) : saveState.kind === "saving" ? (
                <span className="inline-flex items-center gap-1">
                  <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> Saving…
                </span>
              ) : saveState.kind === "saved" ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 aria-hidden className="size-3.5 text-[#0b5f5c]" /> All changes saved
                  · {timeAgo(saveState.at)}
                </span>
              ) : saveState.kind === "error" ? (
                <span className="inline-flex items-center gap-1 text-[#8f2424]">
                  <CloudOff aria-hidden className="size-3.5" /> Not saved yet, retrying (
                  {saveState.message})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#8f2424]">
                  <CloudOff aria-hidden className="size-3.5" /> Not saved: someone else changed this
                  case
                </span>
              )}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <Tag
                  tone="accent"
                  icon={
                    effectiveMode === "build" ? (
                      <Hammer aria-hidden className="size-3.5" />
                    ) : (
                      <Stethoscope aria-hidden className="size-3.5" />
                    )
                  }
                >
                  {effectiveMode === "build" ? "Building" : "Reviewing"}
                </Tag>
                {editable && (
                  <Tag tone="info" icon={<GitPullRequestDraft aria-hidden className="size-3.5" />}>
                    {revisionOf
                      ? "Unpublished changes to a live case"
                      : "New case, not yet published"}
                  </Tag>
                )}
              </p>
              <h1 className="mt-2 font-display text-2xl font-black leading-tight md:text-3xl">
                {definition.title || "Untitled case"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[
                  definition.specialty.join(", "),
                  definition.patient.name &&
                    `${definition.patient.name}, ${definition.patient.age}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Start with the basics"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionFinder definition={definition} mode={effectiveMode} onJump={jump} />
              {editable ? (
                <div
                  role="group"
                  aria-label="Mode"
                  className="inline-flex rounded-full bg-card p-1 shadow-sm ring-1 ring-border"
                >
                  {(["build", "review"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={effectiveMode === item}
                      onClick={() => switchMode(item)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold transition-colors",
                        FOCUS_RING,
                        effectiveMode === item
                          ? "bg-[#2b2540] text-white"
                          : "text-ink-soft hover:bg-muted",
                      )}
                    >
                      {item === "build" ? (
                        <Hammer aria-hidden className="size-4" />
                      ) : (
                        <Stethoscope aria-hidden className="size-4" />
                      )}
                      {item === "build" ? "Build" : "Review"}
                    </button>
                  ))}
                </div>
              ) : (
                <Button
                  tone="primary"
                  onClick={() => void edit({ step: buildStepForStage(reviewStage) })}
                >
                  <PencilLine aria-hidden className="size-4" /> Edit this case
                </Button>
              )}
              {editable ? (
                <Button
                  tone="secondary"
                  disabled={errors.length > 0}
                  title={
                    errors.length
                      ? "Fix the problems flagged in the steps first"
                      : "Play this case in the simulator"
                  }
                  onClick={onPlaytest}
                >
                  <Play aria-hidden className="size-4" /> Playtest
                </Button>
              ) : (
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: definition.id }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2.5 text-sm font-extrabold shadow-sm ring-1 ring-border hover:bg-muted",
                    FOCUS_RING,
                  )}
                >
                  <ExternalLink aria-hidden className="size-4" /> Open in player
                </Link>
              )}
              {editable && (
                <Button
                  tone="primary"
                  disabled={!canPublish || publishing}
                  title={
                    errors.length
                      ? "Fix the problems flagged in the steps first"
                      : "Make this version live for students"
                  }
                  onClick={() => void publishNow()}
                >
                  <Rocket aria-hidden className="size-4" />
                  {publishing ? "Publishing…" : revisionOf ? "Publish changes" : "Publish"}
                </Button>
              )}
            </div>
          </div>
        </header>

        {saveState.kind === "conflict" && (
          <Callout
            tone="warn"
            title="Another content creator changed this case while you were editing"
            action={
              <span className="flex flex-wrap gap-2">
                <Button size="sm" tone="primary" onClick={() => onResolveConflict("mine")}>
                  Keep my version
                </Button>
                <Button size="sm" onClick={() => onResolveConflict("theirs")}>
                  Load their version
                </Button>
              </span>
            }
          >
            Your latest edits are kept on this screen but not saved. Keeping yours replaces their
            changes; loading theirs discards your unsaved edits.
          </Callout>
        )}
        {publishProblems.length > 0 && (
          <Callout tone="bad" title="This case couldn't be published">
            <ul className="list-disc pl-5">
              {publishProblems.map((problem, index) => (
                <li key={index}>{problem}</li>
              ))}
            </ul>
          </Callout>
        )}

        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <StepRail
              items={railItems}
              current={current}
              onSelect={(key) => goTo(key)}
              heading={effectiveMode === "build" ? "Authoring steps" : "Review checklist"}
            />
          </div>

          <main ref={mainRef} className="min-w-0 scroll-mt-24 space-y-5" aria-live="off">
            {effectiveMode === "build" && returnTo && (
              <div className="sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-[#2b2540] px-4 py-3 text-white shadow-lg">
                <PencilLine aria-hidden className="size-4 shrink-0" />
                <p className="min-w-0 flex-1 text-sm font-bold">
                  Editing from the review. Changes save as you type.
                </p>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => {
                    const stage = returnTo;
                    setReturnTo(null);
                    onNavigate({ mode: "review", step: stage }, { replace: false });
                  }}
                >
                  <ArrowLeft aria-hidden className="size-4" /> Back to{" "}
                  {REVIEW_STAGE_META[returnTo].short.toLowerCase()} review
                </Button>
              </div>
            )}
            {effectiveMode === "build" ? (
              <BuilderContent
                step={buildStep}
                definition={definition}
                checks={checks}
                revisionOf={revisionOf}
                onChange={onChange}
                onAddImage={onAddImage}
                onPlaytest={onPlaytest}
                onStartReview={() => switchMode("review")}
                onDelete={onDelete}
                onNotice={onNotice}
              />
            ) : (
              <ReviewContent
                stage={reviewStage}
                definition={definition}
                checks={checks}
                record={record}
                update={updateReview}
                editable={editable}
                revisionOf={revisionOf}
                onEditCase={() => void edit({ step: "basics" })}
                onNotice={onNotice}
              />
            )}

            <nav
              aria-label="Step navigation"
              className="flex flex-wrap items-center gap-3 rounded-[22px] bg-card p-3 ring-1 ring-border md:p-4"
            >
              {previous ? (
                <Button tone="ghost" onClick={() => goTo(previous.key)}>
                  <ArrowLeft aria-hidden className="size-4" />
                  <span className="hidden sm:inline">{previous.title}</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              ) : (
                <span />
              )}
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {effectiveMode === "review" && reviewStage !== "decision" && reviewed && (
                  <Button tone="ghost" size="sm" onClick={() => markReviewed(false)}>
                    <Circle aria-hidden className="size-4" /> Mark as not reviewed
                  </Button>
                )}
                {next &&
                  (effectiveMode === "review" && reviewStage !== "decision" && !reviewed ? (
                    <Button
                      tone="primary"
                      onClick={() => {
                        markReviewed(true);
                        goTo(next.key);
                      }}
                    >
                      <CheckCircle2 aria-hidden className="size-4" /> Mark reviewed & continue
                    </Button>
                  ) : (
                    <Button tone="primary" onClick={() => goTo(next.key)}>
                      <span className="hidden sm:inline">{next.title}</span>
                      <span className="sm:hidden">Next</span>
                      <ArrowRight aria-hidden className="size-4" />
                    </Button>
                  ))}
              </span>
            </nav>
          </main>
        </div>
      </div>
      {editable && (
        <AssetDialog
          definition={definition}
          assetIndex={assetIndex}
          onChange={onChange}
          onClose={() => {
            const asset = assetIndex === null ? undefined : definition.assets[assetIndex];
            // An image the creator never filled in is not worth keeping.
            if (asset && !asset.url && !asset.filename && !asset.altText && !asset.license) {
              onChange({
                ...definition,
                assets: definition.assets.filter((_, i) => i !== assetIndex),
              });
            }
            setAssetIndex(null);
          }}
        />
      )}
    </WorkspaceProvider>
  );
}

function BuilderContent({
  step,
  definition,
  checks,
  revisionOf,
  onChange,
  onAddImage,
  onPlaytest,
  onStartReview,
  onDelete,
  onNotice,
}: {
  step: BuildStep;
  definition: MedicalCase;
  checks: StudioCheck[];
  revisionOf: MedicalCase | undefined;
  onChange: (next: MedicalCase) => void;
  onAddImage: () => void;
  onPlaytest: () => void;
  onStartReview: () => void;
  onDelete: () => void;
  onNotice: (message: string) => void;
}) {
  switch (step) {
    case "basics":
      return <BuilderBasicsStep definition={definition} onChange={onChange} />;
    case "patient":
      return <BuilderPatientStep definition={definition} onChange={onChange} />;
    case "history":
    case "examination":
    case "tests":
    case "treatment": {
      const category = (
        { history: "ask", examination: "examine", tests: "test", treatment: "treat" } as const
      )[step];
      return (
        <BuilderActionsStep
          key={category}
          definition={definition}
          category={category}
          checks={checks}
          onChange={onChange}
          onAddImage={onAddImage}
        />
      );
    }
    case "progression":
      return <BuilderProgressionStep definition={definition} checks={checks} onChange={onChange} />;
    case "scoring":
      return <BuilderScoringStep definition={definition} onChange={onChange} />;
    case "finish":
      return (
        <BuilderFinishStep
          definition={definition}
          checks={checks}
          revisionOf={revisionOf}
          onChange={onChange}
          onPlaytest={onPlaytest}
          onStartReview={onStartReview}
          onDelete={onDelete}
          onNotice={onNotice}
        />
      );
  }
}

function ReviewContent({
  stage,
  definition,
  checks,
  record,
  update,
  editable,
  revisionOf,
  onEditCase,
  onNotice,
}: {
  stage: ReviewStage;
  definition: MedicalCase;
  checks: StudioCheck[];
  record: ReviewRecord | undefined;
  update: ReviewUpdate;
  editable: boolean;
  revisionOf: MedicalCase | undefined;
  onEditCase: () => void;
  onNotice: (message: string) => void;
}) {
  switch (stage) {
    case "patient":
      return <ReviewPatientStage definition={definition} />;
    case "history":
    case "examination":
    case "tests":
    case "treatment": {
      const category = (
        { history: "ask", examination: "examine", tests: "test", treatment: "treat" } as const
      )[stage];
      return <ReviewActionsStage key={category} definition={definition} category={category} />;
    }
    case "progression":
      return <ReviewTimelineStage definition={definition} />;
    case "scoring":
      return <ReviewScoringStage definition={definition} />;
    case "decision":
      return (
        <ReviewSummaryStage
          definition={definition}
          record={record}
          update={update}
          checks={checks}
          editable={editable}
          revisionOf={revisionOf}
          onEditCase={onEditCase}
          onNotice={onNotice}
        />
      );
  }
}

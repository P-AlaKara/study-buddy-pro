import { ArrowRight, CheckCircle2, Circle, PencilLine, RotateCcw } from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { countByCategory } from "../../case-analysis";
import type { StudioCheck } from "../../issue-guide";
import type { ReviewRecord, ReviewUpdate } from "../../reviews";
import {
  CATEGORY_META,
  REVIEW_STAGES,
  REVIEW_STAGE_META,
  buildStepForStage,
} from "../../vocabulary";
import { CheckList } from "../check-list";
import { PublishPanel } from "../hand-off";
import { Button, Callout, Panel, PanelHeading, SubHeading, Tag, useConfirm } from "../studio-ui";
import { useWorkspace } from "../workspace-context";

/*
 * The last review stage. Reviewers fix problems by editing the case, so this
 * is a recap rather than a verdict: what has been covered, what the automated
 * checks still flag, and how the edited case moves on.
 */
export function ReviewSummaryStage({
  definition,
  record,
  update,
  checks,
  editable,
  revisionOf,
  onEditCase,
  onNotice,
}: {
  definition: MedicalCase;
  record: ReviewRecord | undefined;
  update: ReviewUpdate;
  checks: StudioCheck[];
  /** A draft or revision: edits are already in this browser. */
  editable: boolean;
  revisionOf?: MedicalCase | undefined;
  /** Published case without a revision: start one. */
  onEditCase: () => void;
  onNotice: (message: string) => void;
}) {
  const confirm = useConfirm();
  const { jump } = useWorkspace();
  const errors = checks.filter((check) => check.severity === "error");
  const suggestions = checks.filter((check) => check.severity !== "error");
  const stages = REVIEW_STAGES.filter((stage) => stage !== "decision");
  const reviewed = stages.filter((stage) => record?.reviewedStages.includes(stage));
  const counts = countByCategory(definition);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={REVIEW_STAGE_META.decision.title}
          description={REVIEW_STAGE_META.decision.blurb}
        />
        <div className="rounded-2xl bg-lavender-soft/60 p-4">
          <p className="font-display text-xl font-black">{definition.title || "Untitled case"}</p>
          <p className="mt-1 text-sm">
            <span className="font-bold">Diagnosis:</span>{" "}
            {definition.solution.diagnosis || "not set"}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((category) => (
              <Tag key={category}>
                {counts[category]}{" "}
                {counts[category] === 1
                  ? CATEGORY_META[category].noun
                  : CATEGORY_META[category].plural}
              </Tag>
            ))}
            <Tag>{definition.deteriorationRules.length} timed events</Tag>
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SubHeading>
            Sections reviewed ({reviewed.length} of {stages.length})
          </SubHeading>
          <ul className="space-y-1">
            {stages.map((stage) => {
              const done = record?.reviewedStages.includes(stage);
              return (
                <li key={stage}>
                  <button
                    type="button"
                    onClick={() => jump({ step: buildStepForStage(stage) })}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                  >
                    {done ? (
                      <CheckCircle2 aria-hidden className="size-5 shrink-0 text-[#0b5f5c]" />
                    ) : (
                      <Circle aria-hidden className="size-5 shrink-0 text-[#a49bbd]" />
                    )}
                    <span className="min-w-0 flex-1 text-sm font-bold">
                      {REVIEW_STAGE_META[stage].title}
                      <span className="sr-only">{done ? " (reviewed)" : " (not reviewed)"}</span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button
            size="sm"
            tone="ghost"
            className="mt-2"
            disabled={!reviewed.length}
            onClick={async () => {
              if (
                await confirm({
                  title: "Start the review again?",
                  description:
                    "Clears which sections you've marked as reviewed. The case itself is not changed.",
                  confirmLabel: "Start again",
                  tone: "primary",
                })
              ) {
                update((current) => ({ ...current, reviewedStages: [] }));
              }
            }}
          >
            <RotateCcw aria-hidden className="size-4" /> Start the review again
          </Button>
        </Panel>
        <Panel>
          <SubHeading>Automated checks</SubHeading>
          <Callout tone="info" className="mb-3">
            These confirm the case is complete and will run. They can't tell whether it is
            clinically accurate — that is what your review is for.
          </Callout>
          {errors.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-bold text-[#0b5f5c]">
              <CheckCircle2 aria-hidden className="size-4" /> Nothing blocks this case from running.
            </p>
          ) : (
            <CheckList checks={errors} goLabel={editable ? "Fix" : "Show"} />
          )}
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[13px] font-bold text-muted-foreground">
                {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
              </p>
              <CheckList checks={suggestions} limit={5} goLabel={editable ? "Fix" : "Show"} />
            </div>
          )}
        </Panel>
      </div>

      {editable ? (
        <PublishPanel definition={definition} />
      ) : (
        <Panel>
          <PanelHeading
            level={3}
            title="No changes made"
            description="If you found something to fix, edit it directly: use Edit on any section, or start here. Students keep this version until the changes are published."
          />
          <Button tone="primary" onClick={onEditCase}>
            <PencilLine aria-hidden className="size-4" /> Edit this case
          </Button>
        </Panel>
      )}
    </div>
  );
}

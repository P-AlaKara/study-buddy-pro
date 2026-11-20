import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FileJson,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { parseCaseJson } from "../../drafts";
import type { StudioCheck } from "../../issue-guide";
import { BUILD_STEP_META, CATEGORY_STEP } from "../../vocabulary";
import { CheckList } from "../check-list";
import { ReviewActionsStage } from "../review/review-actions";
import { PublishPanel } from "../hand-off";
import { ReviewPatientStage } from "../review/review-patient";
import { ReviewScoringStage } from "../review/review-scoring";
import { ReviewTimelineStage } from "../review/review-timeline";
import {
  Button,
  Callout,
  Disclosure,
  Field,
  Panel,
  PanelHeading,
  TextArea,
  TextInput,
} from "../studio-ui";

function JsonSource({
  definition,
  onChange,
}: {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const serialized = useMemo(() => JSON.stringify(definition, null, 2), [definition]);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState("");
  useEffect(() => {
    setText(serialized);
    setError("");
  }, [serialized]);
  return (
    <div className="space-y-3">
      <Callout tone="warn">
        For developers and bulk edits. Everything here is also editable in the steps above; a
        mistake here can break the case, so the checks run again when you apply.
      </Callout>
      {error && (
        <pre className="whitespace-pre-wrap rounded-2xl bg-pink-soft p-3 font-mono text-xs text-[#7b1f1f]">
          {error}
        </pre>
      )}
      <TextArea
        value={text}
        onChange={setText}
        rows={22}
        className="font-mono text-xs"
        ariaLabel="Case source as JSON"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          tone="primary"
          disabled={text === serialized}
          onClick={() => {
            try {
              onChange(parseCaseJson(text));
              setError("");
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : "Invalid JSON");
            }
          }}
        >
          Apply changes
        </Button>
        <Button tone="ghost" disabled={text === serialized} onClick={() => setText(serialized)}>
          Discard edits
        </Button>
      </div>
    </div>
  );
}

export function BuilderFinishStep({
  definition,
  checks,
  revisionOf,
  onChange,
  onPlaytest,
  onStartReview,
  onDelete,
  onNotice,
}: {
  definition: MedicalCase;
  checks: StudioCheck[];
  revisionOf?: MedicalCase | undefined;
  onChange: (next: MedicalCase) => void;
  onPlaytest: () => void;
  onStartReview: () => void;
  onDelete: () => void;
  onNotice: (message: string) => void;
}) {
  const errors = checks.filter((check) => check.severity === "error");
  const suggestions = checks.filter((check) => check.severity !== "error");
  const ready = errors.length === 0;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META.finish.title}
          description={BUILD_STEP_META.finish.blurb}
        />
        <div className={ready ? "rounded-2xl bg-mint-soft p-4" : "rounded-2xl bg-pink-soft p-4"}>
          <p className="flex items-center gap-2 font-display text-lg font-black">
            {ready ? (
              <CheckCircle2 aria-hidden className="size-5 text-[#0b5f5c]" />
            ) : (
              <ClipboardCheck aria-hidden className="size-5 text-[#8f2424]" />
            )}
            {ready
              ? "Complete and ready to publish"
              : `${errors.length} thing${errors.length === 1 ? "" : "s"} to fix before publishing`}
          </p>
          <p className="mt-1 text-sm">
            {ready
              ? "The case is complete and will run. Make sure a clinician has reviewed the medicine before you publish."
              : "Each item below takes you to the field that needs attention."}
          </p>
        </div>
        {errors.length > 0 && (
          <div className="mt-4">
            <CheckList checks={errors} />
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-extrabold">
              {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"} (optional)
            </p>
            <CheckList checks={suggestions} limit={6} />
          </div>
        )}
        <Callout tone="info" className="mt-4" title="Checks are not a clinical review">
          They confirm the case is complete and consistent. Only a clinician can confirm the
          medicine is right.
        </Callout>
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Try it as a student"
          description="Play the case in the real simulator. Your progress in the playtest is not saved."
        />
        <Button
          tone="primary"
          disabled={!ready}
          onClick={onPlaytest}
          title={ready ? undefined : "Fix the problems above first"}
        >
          <Play aria-hidden className="size-4" /> Playtest this case
        </Button>
        {!ready && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Available once nothing needs fixing.
          </p>
        )}
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Read the whole case"
          description="Everything a reviewer will see, in the same order."
        />
        <div className="space-y-2">
          <Disclosure title="Patient & clinical context">
            <ReviewPatientStage definition={definition} readOnly />
          </Disclosure>
          {(["ask", "examine", "test", "treat"] as const).map((category) => (
            <Disclosure
              key={category}
              title={BUILD_STEP_META[CATEGORY_STEP[category]].title}
              summary={`${definition.actions.filter((action) => action.category === category).length} actions`}
            >
              <ReviewActionsStage definition={definition} category={category} readOnly />
            </Disclosure>
          ))}
          <Disclosure title="Patient timeline">
            <ReviewTimelineStage definition={definition} readOnly />
          </Disclosure>
          <Disclosure title="Scoring & patient safety">
            <ReviewScoringStage definition={definition} readOnly />
          </Disclosure>
        </div>
      </Panel>

      <PublishPanel definition={definition} onStartReview={ready ? onStartReview : undefined} />

      <Panel id="studio-technical">
        <PanelHeading
          level={3}
          title="Technical details"
          description="Assigned automatically. They identify the case in links and in students' saved progress, so they never change."
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-[13px] font-bold text-muted-foreground">Case reference code</dt>
            <dd className="mt-0.5 font-mono font-bold">{definition.slug}</dd>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-[13px] font-bold text-muted-foreground">Case ID</dt>
            <dd className="mt-0.5 break-all font-mono text-[13px] font-bold">{definition.id}</dd>
          </div>
        </dl>
      </Panel>

      <Disclosure title="Edit the raw case file (advanced)" summary="JSON source of the whole case">
        <JsonSource definition={definition} onChange={onChange} />
      </Disclosure>

      <Panel className="ring-[#f0c6c6]">
        <PanelHeading
          level={3}
          title={revisionOf ? "Discard the unpublished changes" : "Delete this case"}
          description={
            revisionOf
              ? "Removes the unpublished changes for everyone. Students keep the published version."
              : "It has never been published. Deleting removes it for everyone."
          }
        />
        <Button tone="danger" onClick={onDelete}>
          <Trash2 aria-hidden className="size-4" /> {revisionOf ? "Discard changes" : "Delete case"}
        </Button>
      </Panel>
    </div>
  );
}

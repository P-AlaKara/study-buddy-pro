import { FileJson, Rocket, Stethoscope } from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { downloadTextFile } from "../drafts";
import { Button, Panel, PanelHeading } from "./studio-ui";
import { useWorkspace } from "./workspace-context";

/**
 * Where a finished draft goes next: publishing makes it live for students
 * straight away. The case file download is a backup or a way to share a copy.
 */
export function PublishPanel({
  definition,
  onStartReview,
}: {
  definition: MedicalCase;
  onStartReview?: (() => void) | undefined;
}) {
  const { publish } = useWorkspace();
  if (!publish) return null;
  return (
    <Panel>
      <PanelHeading
        level={3}
        title={publish.isChange ? "Publish the changes" : "Publish the case"}
        description={
          publish.isChange
            ? "Students keep seeing the current version until you publish these changes."
            : "Publishing adds the case to the student case library straight away."
        }
      />
      <div className={`grid gap-3 ${onStartReview ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {onStartReview && (
          <div className="flex flex-col rounded-2xl bg-lavender-soft/60 p-4">
            <Stethoscope aria-hidden className="size-6 text-[#4a3799]" />
            <p className="mt-2 font-extrabold">Review it first</p>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Walk through the case as a clinician would, fixing anything you find as you go.
            </p>
            <Button tone="quiet" size="sm" className="mt-3 self-start" onClick={onStartReview}>
              Start the review
            </Button>
          </div>
        )}
        <div className="flex flex-col rounded-2xl bg-mint-soft/70 p-4">
          <Rocket aria-hidden className="size-6 text-[#0b5f5c]" />
          <p className="mt-2 font-extrabold">Make it live</p>
          <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            {publish.disabled
              ? "Available once nothing is flagged as needing a fix."
              : "Students see this version as soon as you publish."}
          </p>
          <Button
            tone="primary"
            size="sm"
            className="mt-3 self-start"
            disabled={publish.disabled || publish.busy}
            onClick={publish.run}
          >
            <Rocket aria-hidden className="size-4" />
            {publish.busy ? "Publishing…" : publish.isChange ? "Publish changes" : "Publish"}
          </Button>
        </div>
        <div className="flex flex-col rounded-2xl bg-blue-soft/60 p-4">
          <FileJson aria-hidden className="size-6 text-[#1d4a85]" />
          <p className="mt-2 font-extrabold">Keep a copy</p>
          <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            Download the case file as a backup, or to bring it into another Medley workspace with
            “Import a case file”.
          </p>
          <Button
            size="sm"
            className="mt-3 self-start"
            onClick={() =>
              downloadTextFile(
                `${definition.slug || "case"}.json`,
                JSON.stringify(definition, null, 2),
                "application/json",
              )
            }
          >
            <FileJson aria-hidden className="size-4" /> Download case file
          </Button>
        </div>
      </div>
    </Panel>
  );
}

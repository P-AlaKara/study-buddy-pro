import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, CloudUpload, RotateCw, X } from "lucide-react";
import { CaseChallengeScreen } from "@/features/case-challenge/components/case-challenge-screen";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { clearEncounter } from "@/features/case-challenge/use-case-persistence";
import {
  blankCase,
  clearLegacyDrafts,
  duplicateCase,
  inspectCase,
  loadLegacyDrafts,
  parseCaseJson,
  type LegacyDraft,
} from "../drafts";
import { useReviewStore } from "../reviews";
import { useStudioCases } from "../use-studio-cases";
import { CaseLibrary } from "./case-library";
import { CaseWorkspace, type ResumeEdit, type StudioMode } from "./case-workspace";
import { Button, Callout, ConfirmProvider, EmptyState, useConfirm } from "./studio-ui";

/*
 * The case studio: the shared case library (Supabase) and a workspace that
 * opens one case to build or review. `bank:<id>` shows what students play;
 * `draft:<id>` edits that case's unpublished changes (or a new case). Where
 * you are lives in the URL so refresh and the back button keep your place.
 */

export interface StudioLocation {
  case?: string | undefined;
  mode?: StudioMode | undefined;
  step?: string | undefined;
}

type Navigate = (next: StudioLocation, options?: { replace?: boolean }) => void;

function parseCaseParam(value: string | undefined): { kind: "bank" | "draft"; id: string } | null {
  if (!value) return null;
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((kind === "bank" || kind === "draft") && id) return { kind, id };
  return null;
}

export function CaseStudioScreen({
  location,
  onNavigate,
}: {
  location: StudioLocation;
  onNavigate: Navigate;
}) {
  return (
    <ConfirmProvider>
      <Studio location={location} onNavigate={onNavigate} />
    </ConfirmProvider>
  );
}

function Studio({ location, onNavigate }: { location: StudioLocation; onNavigate: Navigate }) {
  const confirm = useConfirm();
  const library = useStudioCases();
  const reviews = useReviewStore();
  const [playtest, setPlaytest] = useState<MedicalCase | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<LegacyDraft[]>([]);
  // Hand-off from an Edit button on a published case to its draft.
  const [resume, setResume] = useState<{ caseParam: string; edit: ResumeEdit } | null>(null);

  useEffect(() => setLegacy(loadLegacyDrafts()), []);
  useEffect(() => {
    if (resume && location.case !== resume.caseParam) setResume(null);
  }, [location.case, resume]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const cases = library.cases ?? [];

  const openCase = (kind: "bank" | "draft", id: string, mode: StudioMode, step?: string) =>
    onNavigate({
      case: `${kind}:${id}`,
      mode,
      step: step ?? (mode === "build" ? "basics" : "patient"),
    });

  /** Run a server action with a busy state and a readable failure message. */
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try {
      return await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function startNew(definition: MedicalCase, message?: string) {
    const row = await run(() => library.createCase(definition));
    if (!row) return;
    openCase("draft", row.id, "build");
    if (message) setNotice(message);
  }

  /** Begin (or continue) changing a published case, then carry on with the edit that asked. */
  async function startChanges(id: string, edit?: ResumeEdit) {
    const row = await run(() => library.reviseCase(id));
    if (!row) return;
    const caseParam = `draft:${row.id}`;
    if (edit) setResume({ caseParam, edit });
    onNavigate(
      edit
        ? { case: caseParam, mode: edit.mode, step: edit.step }
        : { case: caseParam, mode: "build", step: "basics" },
    );
  }

  async function discard(id: string) {
    const row = cases.find((item) => item.id === id);
    const isChange = Boolean(row?.published);
    const ok = await confirm(
      isChange
        ? {
            title: "Discard the unpublished changes?",
            description:
              "Everyone's unpublished changes to this case are removed. Students keep the published version.",
            confirmLabel: "Discard changes",
          }
        : {
            title: `Delete “${row?.draft?.title || "Untitled case"}”?`,
            description:
              "This case has never been published. Deleting it removes it for everyone and cannot be undone.",
            confirmLabel: "Delete case",
          },
    );
    if (!ok) return;
    const done = await run(() => library.discard(id));
    if (done === undefined) return;
    if (!isChange) reviews.remove(id);
    onNavigate({}, { replace: true });
    setNotice(isChange ? "Changes discarded." : "Case deleted.");
  }

  async function importFile(file: File) {
    let definition: MedicalCase;
    try {
      definition = parseCaseJson(await file.text());
    } catch (error) {
      setNotice(
        error instanceof Error
          ? (error.message.split("\n")[0] ?? "Import failed")
          : "Import failed",
      );
      return;
    }
    const ready = !inspectCase(definition).some((issue) => issue.severity === "error");
    const existing = cases.find((item) => item.id === definition.id);
    if (existing) {
      const ok = await confirm({
        title: `Use this file as changes to “${existing.published?.title ?? existing.draft?.title}”?`,
        tone: "primary",
        confirmLabel: "Use as changes",
        description:
          "The file is a version of a case already in the library. It replaces that case's unpublished changes; students keep the published version until you publish.",
      });
      if (!ok) return;
      const row = await run(() => library.reviseCase(existing.id));
      if (!row) return;
      library.editDraft(row.id, definition);
      openCase("draft", row.id, ready ? "review" : "build");
      setNotice(`Imported as changes to “${definition.title}”.`);
      return;
    }
    const row = await run(() => library.createCase(definition, true));
    if (!row) return;
    openCase("draft", row.id, ready ? "review" : "build");
    setNotice(`Imported “${definition.title || "the case"}”.`);
  }

  async function moveLegacyDrafts() {
    const moved: string[] = [];
    await run(async () => {
      for (const item of legacy) {
        const target = cases.find(
          (row) => row.id === (item.revisionOf ?? item.definition.id) && row.published,
        );
        if (target) {
          const row = await library.reviseCase(target.id);
          library.editDraft(row.id, { ...item.definition, id: row.id, slug: row.slug });
        } else {
          await library.createCase(item.definition, true);
        }
        moved.push(item.definition.id);
      }
    });
    clearLegacyDrafts(moved);
    setLegacy(loadLegacyDrafts());
    if (moved.length) {
      setNotice(
        `Moved ${moved.length} case${moved.length === 1 ? "" : "s"} into the shared library.`,
      );
    }
  }

  if (playtest) {
    return (
      <>
        <CaseChallengeScreen caseDefinition={playtest} />
        <button
          type="button"
          onClick={() => {
            clearEncounter(playtest.id);
            setPlaytest(null);
          }}
          className="fixed left-1/2 top-2 z-[100] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1b1b2f] px-4 py-2 text-xs font-black text-white shadow-xl hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="size-4" /> Exit playtest · {playtest.title || playtest.slug}
        </button>
      </>
    );
  }

  const selection = parseCaseParam(location.case);
  let body: ReactNode;

  if (library.loadError && !library.cases) {
    body = (
      <div className="mx-auto max-w-lg py-10">
        <EmptyState
          title="The case library couldn't be loaded"
          action={
            <Button tone="primary" onClick={() => void library.reload()}>
              <RotateCw aria-hidden className="size-4" /> Try again
            </Button>
          }
        >
          {library.loadError}
        </EmptyState>
      </div>
    );
  } else if (!library.cases) {
    body = (
      <div className="h-64 animate-pulse rounded-[26px] bg-muted" aria-label="Loading cases" />
    );
  } else if (!selection) {
    body = (
      <>
        {legacy.length > 0 && (
          <Callout
            tone="info"
            className="mb-5"
            title={`${legacy.length} case${legacy.length === 1 ? " is" : "s are"} saved only in this browser`}
            action={
              <Button
                tone="primary"
                size="sm"
                disabled={busy}
                onClick={() => void moveLegacyDrafts()}
              >
                <CloudUpload aria-hidden className="size-4" /> Move to the shared library
              </Button>
            }
          >
            Earlier drafts were kept on this device. Move them so other content creators can see and
            publish them.
          </Callout>
        )}
        <CaseLibrary
          cases={cases}
          busy={busy}
          onOpen={(kind, id, mode) => openCase(kind, id, mode)}
          onCreate={() => void startNew(blankCase("case_new"))}
          onImport={(file) => void importFile(file)}
          onEdit={(id) => void startChanges(id)}
          onTemplate={(source) =>
            void startNew(
              duplicateCase(source, "case_new"),
              `Started a new case from “${source.title}”.`,
            )
          }
          onDelete={(id) => void discard(id)}
        />
      </>
    );
  } else {
    const row = cases.find((item) => item.id === selection.id);
    const showDraft = selection.kind === "draft" && Boolean(row?.draft);
    const definition = showDraft ? row?.draft : row?.published;

    if (!row || !definition) {
      body = (
        <div className="mx-auto max-w-lg py-10">
          <EmptyState
            title={row ? "These changes are no longer here" : "Case not found"}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {row?.published && (
                  <Button tone="primary" onClick={() => openCase("bank", row.id, "review")}>
                    Open the published case
                  </Button>
                )}
                <Button onClick={() => onNavigate({}, { replace: true })}>
                  <ArrowLeft aria-hidden className="size-4" /> All cases
                </Button>
              </div>
            }
          >
            {row
              ? "They were published or discarded, possibly by another content creator."
              : "It may have been deleted by another content creator."}
          </EmptyState>
        </div>
      );
    } else {
      body = (
        <>
          {!showDraft && row.draft && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-blue-soft px-4 py-3 text-sm font-bold text-[#173f72]">
              This case has unpublished changes.
              <Button
                size="sm"
                tone="primary"
                className="ml-auto"
                onClick={() => openCase("draft", row.id, location.mode ?? "review", location.step)}
              >
                Open the changes
              </Button>
            </div>
          )}
          <CaseWorkspace
            key={location.case}
            entry={{
              kind: showDraft ? "draft" : "bank",
              definition,
              updatedAt: row.updatedAt,
              revisionOf: showDraft && row.published ? row.published : undefined,
            }}
            mode={location.mode ?? (showDraft ? "build" : "review")}
            step={location.step}
            saveState={library.saveStates[row.id] ?? { kind: "saved", at: row.updatedAt }}
            record={reviews.store[row.id]}
            updateReview={(change) => reviews.update(row.id, change)}
            resume={resume && resume.caseParam === location.case ? resume.edit : null}
            onNavigate={(next, options) => onNavigate({ ...location, ...next }, options)}
            onBack={() => onNavigate({})}
            onChange={(next) => showDraft && library.editDraft(row.id, next)}
            onUploadImage={(file) => library.uploadImage(row.id, file)}
            onResolveConflict={(keep) => void library.resolveConflict(row.id, keep)}
            onPublish={async () => {
              const outcome = await library.publish(row.id);
              if (outcome.status === "published") {
                setNotice("Published. Students now see this version.");
                onNavigate(
                  { ...location, case: `bank:${row.id}`, mode: "review" },
                  { replace: true },
                );
              }
              return outcome;
            }}
            onDelete={() => void discard(row.id)}
            onStartRevision={(edit) => void startChanges(row.id, edit)}
            onPlaytest={() => {
              // A separate id, so playtesting never touches real saved progress for this case.
              const run = { ...definition, id: `${definition.id}-playtest` };
              clearEncounter(run.id);
              setPlaytest(run);
            }}
            onNotice={setNotice}
          />
        </>
      );
    }
  }

  return (
    <>
      {body}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {notice && (
          <div
            role="status"
            className="rounded-full bg-[#1b1b2f] px-4 py-2.5 text-sm font-extrabold text-white shadow-xl"
          >
            {notice}
          </div>
        )}
      </div>
    </>
  );
}

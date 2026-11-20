import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  CopyPlus,
  FilePlus2,
  GitPullRequestDraft,
  Hammer,
  Library,
  PencilLine,
  Search,
  Stethoscope,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { countByCategory } from "../case-analysis";
import { inspectCase } from "../drafts";
import type { StudioCase } from "../studio.functions";
import { DIFFICULTY_META } from "../vocabulary";
import { Button, EmptyState, FOCUS_RING, IconButton, Tag } from "./studio-ui";

interface LibraryItem {
  kind: "bank" | "draft";
  /** What the card shows: the unpublished version when there is one. */
  definition: MedicalCase;
  updatedAt?: string;
  errors: number;
  /** A published case that also has unpublished changes. */
  hasChanges: boolean;
}

export function CaseLibrary({
  cases,
  busy,
  onOpen,
  onCreate,
  onImport,
  onEdit,
  onTemplate,
  onDelete,
}: {
  cases: readonly StudioCase[];
  busy: boolean;
  onOpen: (kind: "bank" | "draft", id: string, mode: "build" | "review") => void;
  onCreate: () => void;
  onImport: (file: File) => void;
  /** Start changing a published case. */
  onEdit: (id: string) => void;
  /** Start a new case from a published one. */
  onTemplate: (definition: MedicalCase) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const items = useMemo<LibraryItem[]>(() => {
    const errorsOf = (definition: MedicalCase) =>
      inspectCase(definition).filter((issue) => issue.severity === "error").length;
    return cases.flatMap((row): LibraryItem[] => {
      const shown = row.draft ?? row.published;
      if (!shown) return [];
      return [
        {
          kind: row.published ? "bank" : "draft",
          definition: shown,
          updatedAt: row.updatedAt,
          errors: errorsOf(shown),
          hasChanges: Boolean(row.published && row.draft),
        },
      ];
    });
  }, [cases]);

  const visible = items.filter((item) => {
    const text =
      `${item.definition.title} ${item.definition.specialty.join(" ")} ${item.definition.solution.diagnosis}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  });
  const draftItems = visible.filter((item) => item.kind === "draft");
  const bankItems = visible.filter((item) => item.kind === "bank");
  const newDrafts = items.filter((item) => item.kind === "draft");

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#5a44b5]">
            <ClipboardList aria-hidden className="size-4" /> Case studio
          </p>
          <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">Clinical cases</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Build patient scenarios step by step, and review them the way you would assess a
            patient, fixing anything you find as you go.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/cases"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold hover:bg-muted",
              FOCUS_RING,
            )}
          >
            <ArrowLeft aria-hidden className="size-4" /> Student case library
          </Link>
          <Button disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden className="size-4" /> Import a case file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = "";
            }}
          />
          <Button tone="primary" disabled={busy} onClick={onCreate}>
            <FilePlus2 aria-hidden className="size-4" /> New case
          </Button>
        </div>
      </header>

      <ol
        className="grid gap-2 rounded-[24px] bg-card p-3 ring-1 ring-border/60 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="How a case gets to students"
      >
        {[
          {
            icon: <Hammer className="size-4" />,
            title: "Build",
            text: "Nine guided steps, saved as you go.",
          },
          {
            icon: <TriangleAlert className="size-4" />,
            title: "Check",
            text: "Automatic checks point to anything missing.",
          },
          {
            icon: <Stethoscope className="size-4" />,
            title: "Review",
            text: "A clinician walks through it and fixes what they find.",
          },
          {
            icon: <Library className="size-4" />,
            title: "Publish",
            text: "One click makes the finished case live for students.",
          },
        ].map((item, index) => (
          <li key={item.title} className="flex items-start gap-3 rounded-2xl p-3">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-xl bg-lavender-soft text-[#4a3799]"
            >
              {item.icon}
            </span>
            <span>
              <span className="block text-sm font-extrabold">
                {index + 1}. {item.title}
              </span>
              <span className="block text-[13px] leading-snug text-muted-foreground">
                {item.text}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <label className="relative block min-w-0 sm:max-w-sm">
        <span className="sr-only">Search cases</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, specialty or diagnosis"
          className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#7c63e0] focus:ring-2 focus:ring-[#7c63e0]/25"
        />
      </label>

      <section aria-labelledby="drafts-heading" className="space-y-3">
        <h2 id="drafts-heading" className="flex items-center gap-2 font-display text-xl font-black">
          <PencilLine aria-hidden className="size-5" /> New cases, not yet published
        </h2>
        {draftItems.length === 0 ? (
          <EmptyState
            title={newDrafts.length ? "No drafts match" : "No new cases yet"}
            action={
              !newDrafts.length && (
                <Button tone="primary" onClick={onCreate}>
                  <FilePlus2 aria-hidden className="size-4" /> Start a new case
                </Button>
              )
            }
          >
            {newDrafts.length
              ? "Try another search."
              : "Start from scratch, import a case file, or use a published case as a template."}
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {draftItems.map((item) => (
              <CaseCard
                key={item.definition.id}
                item={item}
                onOpen={onOpen}
                onEdit={onEdit}
                onTemplate={onTemplate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="bank-heading" className="space-y-3">
        <h2 id="bank-heading" className="flex items-center gap-2 font-display text-xl font-black">
          <Library aria-hidden className="size-5" /> Published cases
        </h2>
        <p className="-mt-1 text-sm text-muted-foreground">
          Live for students. Review them and edit anything that needs fixing; students keep the
          current version until the changes are published.
        </p>
        {bankItems.length === 0 ? (
          <EmptyState title="No published cases match">Try another search.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bankItems.map((item) => (
              <CaseCard
                key={item.definition.id}
                item={item}
                onOpen={onOpen}
                onEdit={onEdit}
                onTemplate={onTemplate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CaseCard({
  item,
  onOpen,
  onEdit,
  onTemplate,
  onDelete,
}: {
  item: LibraryItem;
  onOpen: (kind: "bank" | "draft", id: string, mode: "build" | "review") => void;
  onEdit: (id: string) => void;
  onTemplate: (definition: MedicalCase) => void;
  onDelete: (id: string) => void;
}) {
  const { definition, updatedAt } = item;
  const counts = countByCategory(definition);
  const difficulty = DIFFICULTY_META[definition.difficulty] ?? DIFFICULTY_META[2];
  return (
    <article className="flex flex-col rounded-[24px] bg-card p-4 shadow-[0_10px_22px_-14px_rgb(60_45_110/0.28)] ring-1 ring-border/60 md:p-5">
      {(item.kind === "draft" || item.hasChanges) && (
        <div className="flex min-h-8 flex-wrap items-center gap-1.5">
          {item.hasChanges && (
            <Tag tone="info" icon={<GitPullRequestDraft aria-hidden className="size-3.5" />}>
              Unpublished changes
            </Tag>
          )}
          {(item.kind === "draft" || item.hasChanges) && (
            <IconButton
              label={
                item.hasChanges
                  ? `Discard changes to ${definition.title}`
                  : `Delete draft ${definition.title || "untitled"}`
              }
              className="ml-auto size-8"
              onClick={() => onDelete(definition.id)}
            >
              <Trash2 className="size-4" />
            </IconButton>
          )}
        </div>
      )}
      <h3 className="mt-2 font-display text-lg font-black leading-snug">
        {definition.title || "Untitled case"}
      </h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {[definition.specialty.join(", "), `Level ${definition.difficulty} · ${difficulty.label}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {definition.patient.chiefComplaint && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed">
          <span className="font-bold">
            {definition.patient.name || "Patient"}, {definition.patient.age}:
          </span>{" "}
          {definition.patient.chiefComplaint}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        {(
          [
            ["ask", "History"],
            ["examine", "Exam"],
            ["test", "Tests"],
            ["treat", "Treat"],
          ] as const
        ).map(([category, label]) => (
          <div key={category} className="rounded-xl bg-muted/70 px-1 py-1.5">
            <dt className="text-[11px] font-bold text-muted-foreground">{label}</dt>
            <dd className="font-display text-base font-black tabular-nums">{counts[category]}</dd>
          </div>
        ))}
      </dl>
      <p
        className={cn(
          "mt-3 text-[13px] font-bold",
          item.errors ? "text-[#8f2424]" : "text-[#0b5f5c]",
        )}
      >
        {item.errors
          ? `${item.errors} thing${item.errors === 1 ? "" : "s"} to fix`
          : "Passes the automated checks"}
        {updatedAt && (
          <span className="font-semibold text-muted-foreground">
            {" "}
            · edited{" "}
            {new Date(updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </span>
        )}
      </p>
      <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
        {item.kind === "draft" || item.hasChanges ? (
          <>
            <Button
              tone="primary"
              size="sm"
              onClick={() => onOpen("draft", definition.id, "build")}
            >
              <Hammer aria-hidden className="size-4" /> Continue editing
            </Button>
            <Button size="sm" onClick={() => onOpen("draft", definition.id, "review")}>
              <Stethoscope aria-hidden className="size-4" /> Review
            </Button>
          </>
        ) : (
          <>
            <Button
              tone="primary"
              size="sm"
              onClick={() => onOpen("bank", definition.id, "review")}
            >
              <Stethoscope aria-hidden className="size-4" /> Review
            </Button>
            <Button size="sm" onClick={() => onEdit(definition.id)}>
              <PencilLine aria-hidden className="size-4" /> Edit
            </Button>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => onTemplate(definition)}
              title="Start a new case based on this one"
            >
              <CopyPlus aria-hidden className="size-4" /> Use as template
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

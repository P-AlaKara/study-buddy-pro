import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FolderOpen,
  Library,
  PencilLine,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { CASE_BANK } from "@/features/case-challenge/cases";
import { CaseChallengeScreen } from "@/features/case-challenge/components/case-challenge-screen";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { clearEncounter } from "@/features/case-challenge/use-case-persistence";
import {
  blankCase,
  duplicateCase,
  inspectCase,
  loadDrafts,
  nextSlug,
  parseCaseJson,
  saveDrafts,
  type CaseDraft,
} from "../drafts";
import { CaseBuilder } from "./case-builder";
import { CaseInspector } from "./case-inspector";
import { Badge, StatTile } from "./studio-ui";

type Selection = { kind: "bank"; id: string } | { kind: "draft"; id: string };

const BANK_SLUGS = CASE_BANK.map((item) => item.slug);

export function CaseStudioScreen() {
  const [drafts, setDrafts] = useState<CaseDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selection, setSelection] = useState<Selection>({
    kind: "bank",
    id: CASE_BANK[0]?.id ?? "",
  });
  const [playtest, setPlaytest] = useState<MedicalCase | null>(null);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Drafts live in this browser; read them once on the client (never during SSR).
  useEffect(() => {
    setDrafts(loadDrafts());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveDrafts(drafts);
  }, [drafts, hydrated]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const bankIssues = useMemo(
    () => CASE_BANK.map((item) => ({ id: item.id, issues: inspectCase(item) })),
    [],
  );
  const bankErrorCount = bankIssues.reduce(
    (sum, entry) => sum + entry.issues.filter((issue) => issue.severity === "error").length,
    0,
  );
  const reviewedCount = CASE_BANK.filter(
    (item) => item.reviewStatus === "clinician_reviewed",
  ).length;
  const specialtyCount = new Set(CASE_BANK.flatMap((item) => item.specialty)).size;
  const takenSlugs = [...BANK_SLUGS, ...drafts.map((draft) => draft.definition.slug)];

  const upsertDraft = useCallback((definition: MedicalCase) => {
    setDrafts((current) => {
      const updatedAt = new Date().toISOString();
      const index = current.findIndex((draft) => draft.definition.id === definition.id);
      if (index === -1) return [{ definition, updatedAt }, ...current];
      return current.map((draft, i) => (i === index ? { definition, updatedAt } : draft));
    });
  }, []);

  function startDraft(definition: MedicalCase) {
    upsertDraft(definition);
    setSelection({ kind: "draft", id: definition.id });
  }

  function createBlank() {
    startDraft(blankCase(nextSlug(takenSlugs)));
  }

  function duplicateBank(source: MedicalCase) {
    startDraft(duplicateCase(source, nextSlug(takenSlugs)));
    setNotice(`Copied “${source.title}” into a new draft.`);
  }

  function deleteDraft(id: string) {
    const draft = drafts.find((item) => item.definition.id === id);
    if (
      !window.confirm(
        `Delete the draft “${draft?.definition.title || draft?.definition.slug || "untitled"}”? This cannot be undone.`,
      )
    ) {
      return;
    }
    clearEncounter(id);
    setDrafts((current) => current.filter((item) => item.definition.id !== id));
    setSelection({ kind: "bank", id: CASE_BANK[0]?.id ?? "" });
  }

  async function importFile(file: File) {
    try {
      const definition = parseCaseJson(await file.text());
      if (
        takenSlugs.includes(definition.slug) &&
        !drafts.some((d) => d.definition.id === definition.id)
      ) {
        definition.slug = nextSlug(takenSlugs);
      }
      startDraft(definition);
      setNotice(`Imported “${definition.title || definition.slug}”.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? (error.message.split("\n")[0] ?? "Import failed")
          : "Import failed",
      );
    }
  }

  const selectedBank =
    selection.kind === "bank" ? CASE_BANK.find((item) => item.id === selection.id) : undefined;
  const selectedDraft =
    selection.kind === "draft"
      ? drafts.find((item) => item.definition.id === selection.id)
      : undefined;

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
          className="fixed left-1/2 top-2 z-[100] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1b1b2f] px-4 py-2 text-xs font-black text-white shadow-xl hover:bg-black"
        >
          <X className="size-4" /> Exit playtest · {playtest.title || playtest.slug}
        </button>
      </>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#168d91]">
            <ClipboardList className="size-4" /> Content studio
          </p>
          <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">Manage cases</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Check the shipped case bank against the engine's rules, then build and playtest new
            cases before a developer commits them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-extrabold shadow-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" /> Case library
          </Link>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-extrabold shadow-sm hover:bg-muted"
          >
            <Upload className="size-4" /> Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={createBlank}
            className="clay-button inline-flex items-center gap-1.5 rounded-full bg-[#168d91] px-4 py-2 text-sm font-black text-white"
          >
            <FilePlus2 className="size-4" /> New case
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Cases in bank" value={CASE_BANK.length} />
        <StatTile
          label="Bank validation"
          value={bankErrorCount ? `${bankErrorCount} errors` : "Passing"}
          tone={bankErrorCount ? "bad" : "good"}
        />
        <StatTile
          label="Clinician reviewed"
          value={`${reviewedCount}/${CASE_BANK.length}`}
          tone={reviewedCount === CASE_BANK.length ? "good" : "warn"}
        />
        <StatTile label="Specialties · drafts" value={`${specialtyCount} · ${drafts.length}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="Cases and drafts" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="clay-card bg-card p-3">
            <h2 className="flex items-center gap-2 px-2 pb-2 pt-1 text-xs font-black uppercase tracking-wider text-ink-soft">
              <Library className="size-4" /> Case bank
            </h2>
            <ul className="space-y-1">
              {CASE_BANK.map((item) => {
                const entry = bankIssues.find((candidate) => candidate.id === item.id);
                const errorCount = entry?.issues.filter((i) => i.severity === "error").length ?? 0;
                const warningCount =
                  entry?.issues.filter((i) => i.severity === "warning").length ?? 0;
                const active = selection.kind === "bank" && selection.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setSelection({ kind: "bank", id: item.id })}
                      className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? "bg-lavender-soft" : "hover:bg-muted"}`}
                    >
                      {errorCount ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-[#9b2c2c]" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0d686d]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{item.title}</span>
                        <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                          {item.slug} · L{item.difficulty} · {item.specialty[0]}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {item.reviewStatus !== "clinician_reviewed" && (
                            <Badge tone="warn">review</Badge>
                          )}
                          {warningCount > 0 && <Badge tone="neutral">{warningCount} notes</Badge>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="clay-card bg-card p-3">
            <h2 className="flex items-center gap-2 px-2 pb-2 pt-1 text-xs font-black uppercase tracking-wider text-ink-soft">
              <PencilLine className="size-4" /> Drafts
            </h2>
            {drafts.length === 0 ? (
              <p className="px-2 pb-2 text-xs text-muted-foreground">
                No drafts yet. Start one from scratch, import JSON, or duplicate a shipped case.
              </p>
            ) : (
              <ul className="space-y-1">
                {drafts.map((draft) => {
                  const active = selection.kind === "draft" && selection.id === draft.definition.id;
                  const errorCount = inspectCase(draft.definition).filter(
                    (issue) => issue.severity === "error",
                  ).length;
                  return (
                    <li key={draft.definition.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setSelection({ kind: "draft", id: draft.definition.id })}
                        className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? "bg-yellow-soft" : "hover:bg-muted"}`}
                      >
                        <FolderOpen className="mt-0.5 size-4 shrink-0 text-ink-soft" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">
                            {draft.definition.title || "Untitled case"}
                          </span>
                          <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                            {draft.definition.slug} ·{" "}
                            {errorCount ? `${errorCount} to fix` : "ready to export"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>

        <div className="min-w-0">
          {selectedBank && (
            <CaseInspector
              key={selectedBank.id}
              definition={selectedBank}
              onDuplicate={() => duplicateBank(selectedBank)}
              onNotice={setNotice}
            />
          )}
          {selectedDraft && (
            <CaseBuilder
              key={selectedDraft.definition.id}
              draft={selectedDraft.definition}
              updatedAt={selectedDraft.updatedAt}
              takenSlugs={BANK_SLUGS}
              onChange={upsertDraft}
              onDelete={() => deleteDraft(selectedDraft.definition.id)}
              onPlaytest={() => {
                clearEncounter(selectedDraft.definition.id);
                setPlaytest(selectedDraft.definition);
              }}
              onNotice={setNotice}
            />
          )}
          {!selectedBank && !selectedDraft && (
            <div className="clay-card bg-card p-8 text-center text-sm text-muted-foreground">
              Pick a case from the list, or start a new draft.
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1b1b2f] px-4 py-2 text-xs font-black text-white shadow-xl"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

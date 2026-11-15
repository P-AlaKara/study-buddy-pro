// Upload screen (wireframe 2): multiple PDFs / PPTX, validation, removal, then
// kick off generation. Each file is read here in the browser as soon as it's
// added; only the extracted text is sent to the server, and nothing is stored.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  FileText,
  Loader2,
  Lock,
  Plus,
  Presentation,
  Sparkles,
  Target,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProblem } from "@/lib/log-problem";
import { Chip, PageEyebrow, Stepper } from "./ui";
import { createExamFromUploads } from "./exam-generator.functions";
import { extractInBrowser, isAbortError } from "./extract-browser";
import {
  ExtractionError,
  MAX_CONTENT_BYTES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  type DocumentExtraction,
} from "./extract-text";
import { buildUploadedContent } from "./upload-content";

const ACCEPT =
  ".pdf,.pptx,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

type Entry = {
  id: string;
  file: File;
  status: "reading" | "ready" | "failed";
  progress: { done: number; total: number } | null;
  extraction: DocumentExtraction | null;
  error: string | null;
};

function isSupported(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".pptx") || name.endsWith(".ppt");
}
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel({ initialFocus = null }: { initialFocus?: string | null }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Files are read one at a time so a stack of large PDFs doesn't swamp memory.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((c) => c.abort());
  }, []);

  // Exam focus. A general exam covers the whole upload; a specific exam steers
  // generation toward the named areas. `initialFocus` arrives pre-filled when a
  // student chooses to re-test their weak areas after completing an exam.
  const prefilledFocus = initialFocus?.trim() ?? "";
  const fromWeakAreas = prefilledFocus.length > 0;
  const [focusMode, setFocusMode] = useState<"general" | "specific">(
    fromWeakAreas ? "specific" : "general",
  );
  const [focusAreas, setFocusAreas] = useState(prefilledFocus);

  const updateEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const enqueue = (entry: Entry) => {
    const controller = new AbortController();
    controllers.current.set(entry.id, controller);
    queue.current = queue.current.then(async () => {
      if (controller.signal.aborted) return;
      try {
        const extraction = await extractInBrowser(entry.file, {
          signal: controller.signal,
          onProgress: (done, total) => updateEntry(entry.id, { progress: { done, total } }),
        });
        updateEntry(entry.id, { status: "ready", extraction, progress: null });
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        if (!(err instanceof ExtractionError)) logProblem("Read uploaded file", err);
        updateEntry(entry.id, {
          status: "failed",
          progress: null,
          error:
            err instanceof ExtractionError
              ? err.message
              : "We couldn’t read this file. Please try again, or upload a different one.",
        });
      } finally {
        controllers.current.delete(entry.id);
      }
    });
  };

  const addFiles = (incoming: FileList | File[]) => {
    setError("");
    const accepted: Entry[] = [];
    for (const file of Array.from(incoming)) {
      if (!isSupported(file)) {
        setError(`“${file.name}” isn’t a PDF or PowerPoint file.`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_FILE_BYTES) {
        setError(`“${file.name}” must be between 1 byte and ${MAX_FILE_MB} MB.`);
        continue;
      }
      const all = [...entries, ...accepted];
      if (all.some((e) => e.file.name === file.name && e.file.size === file.size)) continue;
      if (all.length >= MAX_FILES) {
        setError(`You can upload at most ${MAX_FILES} files at once.`);
        break;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        status: "reading",
        progress: null,
        extraction: null,
        error: null,
      });
    }
    if (accepted.length > 0) {
      setEntries((cur) => [...cur, ...accepted]);
      accepted.forEach(enqueue);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => {
    controllers.current.get(id)?.abort();
    setEntries((cur) => cur.filter((e) => e.id !== id));
  };

  const reading = entries.some((e) => e.status === "reading");

  const build = async () => {
    if (entries.length === 0) {
      setError("Add at least one PDF or PowerPoint file.");
      return;
    }
    if (reading) return;
    const ready = entries.flatMap((e) =>
      e.status === "ready" && e.extraction ? [e.extraction] : [],
    );
    if (ready.length === 0) {
      setError("None of these files have readable text. Add a text-based PDF or slide deck.");
      return;
    }
    const focus = focusMode === "specific" ? focusAreas.trim() : "";
    if (focusMode === "specific" && focus.length < 3) {
      setError("Tell us which areas to focus on, or switch to a general exam.");
      return;
    }
    const skipped = entries.flatMap((e) =>
      e.status === "failed" ? [{ name: e.file.name, reason: e.error ?? "Couldn’t be read." }] : [],
    );
    const content = new Blob([JSON.stringify(buildUploadedContent(ready, skipped))], {
      type: "application/json",
    });
    if (content.size > MAX_CONTENT_BYTES) {
      setError(
        `Together these files contain more text than one exam can cover (${formatSize(content.size)} of text; the limit is ${formatSize(MAX_CONTENT_BYTES)}). Remove a file or two and try again.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("idempotencyKey", crypto.randomUUID());
      form.append("focusMode", focusMode);
      form.append("focusAreas", focus);
      form.append("content", content, "content.json");
      const { examId } = await createExamFromUploads({ data: form });
      await navigate({ to: "/exams/$examId", params: { examId } });
    } catch (err) {
      logProblem("Create exam from uploads", err);
      setError(err instanceof Error ? err.message : "We couldn’t start generating your exam.");
      setBusy(false);
    }
  };

  return (
    <div>
      <Stepper current={1} />
      <PageEyebrow>Step 01 · Bring your material</PageEyebrow>
      <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">
        Upload your notes <span className="text-pink">✦</span>
      </h1>
      <p className="mt-2 max-w-xl text-ink-soft">
        Add one or more PDFs or slide decks. We combine the material into a single comprehensive
        exam.
      </p>

      {fromWeakAreas && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-lavender-soft p-4 text-sm">
          <Target className="mt-0.5 size-5 shrink-0 text-blue" />
          <p className="font-semibold">
            Focused on your weak areas. Re-upload the same notes — we never keep them — and we’ll
            build a fresh exam that drills these topics harder. Edit the list below or switch back
            to a general exam anytime.
          </p>
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`mt-6 grid min-h-44 cursor-pointer place-items-center rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-blue bg-blue-soft" : "border-blue/40 bg-blue-soft/40"
        }`}
      >
        <div>
          <UploadCloud className="mx-auto size-9 text-blue" />
          <p className="mt-2 font-display font-black">
            Drop files here, or <span className="text-blue underline">browse files</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF · PPTX &nbsp;•&nbsp; up to {MAX_FILE_MB} MB each &nbsp;•&nbsp; multiple files
            supported
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl bg-pink-soft p-4 text-sm font-semibold text-[color:var(--case-pink-ink)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}

      {entries.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-black">
              Uploaded material{" "}
              <Chip tone="blue">
                {entries.length} file{entries.length === 1 ? "" : "s"}
              </Chip>
            </h2>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-sm font-extrabold text-blue"
            >
              <Plus size={15} /> Add another
            </button>
          </div>
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <FileRow key={entry.id} entry={entry} onRemove={() => remove(entry.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Exam focus — general (whole upload) vs specific (student-directed) */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-black">Exam focus</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Test everything in your notes, or steer the exam toward the areas you want to work on.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FocusOption
            selected={focusMode === "general"}
            onSelect={() => setFocusMode("general")}
            icon={<Sparkles size={18} />}
            title="General"
            body="Comprehensive — covers every topic found in your notes."
          />
          <FocusOption
            selected={focusMode === "specific"}
            onSelect={() => setFocusMode("specific")}
            icon={<Target size={18} />}
            title="Specific"
            body="You choose the areas to concentrate on."
          />
        </div>
        {focusMode === "specific" && (
          <div className="mt-3">
            <label htmlFor="focus-areas" className="text-sm font-bold">
              Areas to focus on
            </label>
            <textarea
              id="focus-areas"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="e.g. Acid–base balance, the nephron, potassium handling"
              className="mt-1.5 w-full resize-y rounded-2xl border border-border bg-background p-3.5 text-sm leading-relaxed soft-inset focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              List topics, systems or keywords. We only build questions your material actually
              supports.
            </p>
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={13} /> Your files are read on your device and never uploaded — only their text
          is used.
        </p>
        <Button
          variant="blue"
          disabled={busy || reading || entries.length === 0}
          onClick={() => void build()}
        >
          {busy || reading ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Starting…" : reading ? "Reading files…" : "Build comprehensive exam"}
        </Button>
      </div>
    </div>
  );
}

function FileRow({ entry, onRemove }: { entry: Entry; onRemove: () => void }) {
  const { file, status, progress, extraction } = entry;
  const isPptx = /\.pptx?$/i.test(file.name);
  const unitWord = isPptx ? "slide" : "page";
  let detail = formatSize(file.size);
  if (status === "reading" && progress) {
    detail += ` · reading ${progress.done}/${progress.total} ${unitWord}s`;
  } else if (status === "reading") {
    detail += " · reading…";
  } else if (status === "ready" && extraction) {
    detail += ` · ${extraction.unitCount} ${unitWord}${extraction.unitCount === 1 ? "" : "s"}`;
  }
  return (
    <div className="clay-card bg-card p-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            isPptx
              ? "bg-peach text-[color:var(--case-orange)]"
              : "bg-pink-soft text-[color:var(--case-pink-ink)]"
          }`}
        >
          {isPptx ? <Presentation size={18} /> : <FileText size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{file.name}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        {status === "reading" && (
          <Chip tone="neutral">
            <Loader2 className="size-3 animate-spin" /> Reading
          </Chip>
        )}
        {status === "ready" && <Chip tone="mint">Ready</Chip>}
        {status === "failed" && <Chip tone="pink">Can’t read</Chip>}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>
      </div>
      {status === "failed" && entry.error && (
        <p className="mt-2 text-xs font-semibold text-[color:var(--case-pink-ink)]">
          {entry.error} This file will be skipped.
        </p>
      )}
      {status === "ready" && extraction?.warning && (
        <p className="mt-2 text-xs text-muted-foreground">{extraction.warning}</p>
      )}
    </div>
  );
}

function FocusOption({
  selected,
  onSelect,
  icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
        selected ? "border-blue bg-blue-soft" : "border-border bg-card hover:border-blue/40"
      }`}
    >
      <span
        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
          selected ? "bg-blue text-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display font-black">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{body}</span>
      </span>
    </button>
  );
}

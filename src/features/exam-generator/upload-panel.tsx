// Upload screen (wireframe 2): multiple PDFs / PPTX, validation, removal, then
// kick off generation. Files are sent straight to the server for in-memory
// extraction — nothing is stored.
import { type ReactNode, useRef, useState } from "react";
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

const MAX_FILES = 15;
const MAX_BYTES = 40 * 1024 * 1024;
const ACCEPT =
  ".pdf,.pptx,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

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
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Exam focus. A general exam covers the whole upload; a specific exam steers
  // generation toward the named areas. `initialFocus` arrives pre-filled when a
  // student chooses to re-test their weak areas after completing an exam.
  const prefilledFocus = initialFocus?.trim() ?? "";
  const fromWeakAreas = prefilledFocus.length > 0;
  const [focusMode, setFocusMode] = useState<"general" | "specific">(
    fromWeakAreas ? "specific" : "general",
  );
  const [focusAreas, setFocusAreas] = useState(prefilledFocus);

  const addFiles = (incoming: FileList | File[]) => {
    setError("");
    const next: File[] = [...files];
    for (const file of Array.from(incoming)) {
      if (!isSupported(file)) {
        setError(`“${file.name}” isn’t a PDF or PowerPoint file.`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_BYTES) {
        setError(`“${file.name}” must be between 1 byte and 40 MB.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    if (next.length > MAX_FILES) {
      setError(`You can upload at most ${MAX_FILES} files at once.`);
      setFiles(next.slice(0, MAX_FILES));
    } else {
      setFiles(next);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => setFiles((cur) => cur.filter((_, i) => i !== index));

  const build = async () => {
    if (files.length === 0) {
      setError("Add at least one PDF or PowerPoint file.");
      return;
    }
    const focus = focusMode === "specific" ? focusAreas.trim() : "";
    if (focusMode === "specific" && focus.length < 3) {
      setError("Tell us which areas to focus on, or switch to a general exam.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("idempotencyKey", crypto.randomUUID());
      form.append("focusMode", focusMode);
      form.append("focusAreas", focus);
      for (const file of files) form.append("files", file);
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
            PDF · PPTX &nbsp;•&nbsp; multiple files supported
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

      {files.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-black">
              Uploaded material{" "}
              <Chip tone="blue">
                {files.length} file{files.length === 1 ? "" : "s"}
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
            {files.map((file, index) => {
              const isPptx = /\.pptx?$/i.test(file.name);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="clay-card flex items-center gap-3 bg-card p-3.5"
                >
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
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <Chip tone="mint">Ready</Chip>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${file.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
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
          <Lock size={13} /> Your files are processed privately and never stored.
        </p>
        <Button variant="blue" disabled={busy || files.length === 0} onClick={() => void build()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Starting…" : "Build comprehensive exam"}
        </Button>
      </div>
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

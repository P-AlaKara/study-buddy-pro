import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  deleteAnnieDocument,
  listAnnieDocuments,
  processAnnieDocument,
  uploadAnnieDocument,
} from "./annie.functions";
import { AnnieAvatar } from "./annie-avatar";
import type { AnnieDocument } from "./types";

const MAX_BYTES = 25 * 1024 * 1024;

export function AnnieLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<AnnieDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const items = await listAnnieDocuments();
      setDocuments(items);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!documents.some((document) => document.status === "processing")) return;
    const timer = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(timer);
  }, [documents, load]);

  async function upload(file: File) {
    setError("");
    if (file.type !== "application/pdf") {
      setError("Choose a PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That PDF is larger than 25 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const document = await uploadAnnieDocument({ data: form });
      setDocuments((current) => [document, ...current]);
      void processAnnieDocument({ data: { documentId: document.id } }).finally(load);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function retry(documentId: string) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? { ...document, status: "processing", processing_error: null }
          : document,
      ),
    );
    await processAnnieDocument({ data: { documentId } });
    await load();
  }

  async function remove(documentId: string, title: string) {
    if (!window.confirm(`Delete “${title}” and all of its annotations?`)) return;
    await deleteAnnieDocument({ data: { documentId } });
    setDocuments((current) => current.filter((document) => document.id !== documentId));
  }

  return (
    <main className="mx-auto w-[min(100%-2rem,1180px)] pb-16 pt-8 sm:pt-12">
      <section className="grid items-center gap-6 overflow-hidden rounded-[32px] bg-[#eeeafd] p-6 shadow-[0_18px_40px_-28px_rgba(56,45,105,.45),inset_0_2px_1px_rgba(255,255,255,.8)] sm:p-9 lg:grid-cols-[1fr_240px]">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-[#6d5fb1]">
            <Sparkles className="size-4" /> Your notes, but more awake
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.05] sm:text-5xl">
            Study with Annie
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-slate-600 sm:text-lg">
            Open a PDF, annotate as you read, and let Annie turn the important parts into quick
            recall checks.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="clay-button inline-flex h-12 items-center gap-2 rounded-full bg-[#7566b7] px-6 text-sm font-black text-white disabled:opacity-60"
            >
              {uploading ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <UploadCloud className="size-5" />
              )}
              {uploading ? "Uploading…" : "Upload PDF"}
            </button>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
              <ShieldCheck className="size-4 text-[#2a9d79]" /> Private · PDF only · 25 MB max
            </span>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>
        </div>
        <AnnieAvatar mood="friendly" state="reading" className="mx-auto w-48 max-w-full" />
      </section>

      {error && (
        <div
          className="mt-6 flex items-start gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-bold text-[#8f3f31]"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" /> {error}
        </div>
      )}

      <section className="mt-10" aria-labelledby="notes-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#6d5fb1]">
              Your library
            </p>
            <h2 id="notes-heading" className="mt-1 text-2xl font-black sm:text-3xl">
              Pick up your notes
            </h2>
          </div>
          <span className="text-sm font-extrabold text-slate-400">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 grid place-items-center rounded-[26px] bg-white p-16" role="status">
            <LoaderCircle className="size-7 animate-spin text-[#7566b7]" />
            <span className="sr-only">Loading notes</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-6 rounded-[28px] bg-white p-10 text-center shadow-sm">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#f5f1e8] text-slate-400">
              <BookOpenText className="size-7" />
            </span>
            <h3 className="mt-5 text-xl font-black">No notes here yet</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Upload a text-based PDF and Annie will prepare it for study.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <article key={document.id} className="clay-card flex min-h-56 flex-col bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eeeafd] text-[#6d5fb1]">
                    <FileText className="size-5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(document.id, document.title)}
                    className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-[#fff0ec] hover:text-[#b24e3b]"
                    aria-label={`Delete ${document.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <h3 className="mt-4 line-clamp-2 text-lg font-black leading-snug">
                  {document.title}
                </h3>
                <p className="mt-2 text-xs font-bold text-slate-400">
                  {document.page_count ? `${document.page_count} pages · ` : ""}
                  {document.last_opened_at
                    ? `Opened ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(document.last_opened_at))}`
                    : `Added ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(document.created_at))}`}
                </p>
                <div className="mt-auto pt-5">
                  {document.status === "ready" ? (
                    <Link
                      to="/study-with-annie/$documentId"
                      params={{ documentId: document.id }}
                      className="clay-button flex h-11 items-center justify-between rounded-full bg-[#e3f7ef] px-4 text-sm font-black text-[#16785f]"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="size-4" /> Ready
                      </span>
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : document.status === "processing" ? (
                    <div
                      className="flex h-11 items-center gap-2 rounded-full bg-[#f5f1e8] px-4 text-sm font-black text-slate-500"
                      role="status"
                    >
                      <LoaderCircle className="size-4 animate-spin" /> Annie is preparing this…
                    </div>
                  ) : (
                    <div>
                      <p className="line-clamp-3 text-xs font-bold leading-relaxed text-[#9a4939]">
                        {document.processing_error ?? "Processing failed."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void retry(document.id)}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#6d5fb1]"
                      >
                        <RefreshCw className="size-4" /> Try again
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

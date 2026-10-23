import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
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
      setDocuments(await listAnnieDocuments());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Your documents could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!documents.some((document) => document.status === "processing")) return;
    const timer = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(timer);
  }, [documents, load]);

  async function upload(file: File) {
    setError("");
    if (file.type !== "application/pdf") return setError("Choose a PDF file.");
    if (file.size > MAX_BYTES) return setError("That PDF is larger than 25 MB.");
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

  async function remove(document: AnnieDocument) {
    if (!window.confirm(`Delete “${document.title}” and all of its annotations?`)) return;
    await deleteAnnieDocument({ data: { documentId: document.id } });
    setDocuments((current) => current.filter((item) => item.id !== document.id));
  }

  return (
    <main className="annie-workspace mx-auto w-[min(100%-2rem,1180px)] pb-16 pt-8 sm:pt-12">
      <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <AnnieAvatar className="hidden size-16 shrink-0 sm:block" />
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Study with Annie
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Read, understand, and recall what matters.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6757a6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#594a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {uploading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
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
      </header>

      {error && (
        <div
          className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}

      <section className="mt-8" aria-labelledby="documents-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="documents-heading" className="text-lg font-semibold text-slate-900">
            Documents
          </h2>
          {!loading && <span className="text-sm text-slate-500">{documents.length} total</span>}
        </div>

        {loading ? (
          <div
            className="mt-4 grid min-h-48 place-items-center rounded-xl border border-slate-200 bg-white"
            role="status"
          >
            <LoaderCircle className="size-6 animate-spin text-[#6757a6]" />
            <span className="sr-only">Loading documents</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <FileText className="size-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No documents yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload a text-based PDF to begin studying.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => {
              const pageCount = document.page_count ?? 0;
              const progress = pageCount
                ? Math.min(100, Math.round((document.last_page / pageCount) * 100))
                : 0;
              const hasProgress = document.status === "ready" && document.last_page > 1;
              return (
                <article
                  key={document.id}
                  className="group flex min-h-48 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f0edfa] text-[#6757a6]">
                      <FileText className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                        {document.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {pageCount ? `${pageCount} pages` : "Page count pending"}
                        {document.last_opened_at
                          ? ` · Opened ${formatDate(document.last_opened_at)}`
                          : ` · Added ${formatDate(document.created_at)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(document)}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7] group-hover:opacity-100"
                      aria-label={`Delete ${document.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-auto pt-5">
                    {document.status === "ready" ? (
                      <>
                        <div className="mb-3">
                          <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
                            <span>
                              {hasProgress ? `Page ${document.last_page}` : "Not started"}
                            </span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-[#7566b7]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <Link
                          to="/study-with-annie/$documentId"
                          params={{ documentId: document.id }}
                          className="flex h-10 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#a99ed6] hover:bg-[#f8f6ff] hover:text-[#574a98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7]"
                        >
                          {hasProgress ? "Continue reading" : "Open document"}
                          <ArrowRight className="size-4" />
                        </Link>
                      </>
                    ) : document.status === "processing" ? (
                      <div
                        className="flex h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-xs font-medium text-slate-600"
                        role="status"
                      >
                        <LoaderCircle className="size-4 animate-spin text-[#6757a6]" /> Preparing
                        document…
                      </div>
                    ) : (
                      <div>
                        <p className="line-clamp-2 text-xs leading-5 text-red-700">
                          {document.processing_error ?? "Processing failed."}
                        </p>
                        <button
                          type="button"
                          onClick={() => void retry(document.id)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6757a6] hover:underline"
                        >
                          <RefreshCw className="size-3.5" /> Try again
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

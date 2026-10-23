import { LoaderCircle, RotateCcw, Send, SquarePen } from "lucide-react";
import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

const MAX_INPUT_LENGTH = 1200;

export function FreeFormPanel({
  value,
  pending,
  error,
  onChange,
  onSubmit,
  onRetry,
  onEdit,
  compact = false,
}: {
  value: string;
  pending: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onEdit: () => void;
  compact?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [value]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!pending && value.trim()) onSubmit();
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? "space-y-3" : "clay-card space-y-3 bg-card p-4 md:p-5"}
    >
      <div className="rounded-[22px] border border-white/80 bg-pink-soft/55 p-3 shadow-inner">
        <Textarea
          ref={textareaRef}
          value={value}
          maxLength={MAX_INPUT_LENGTH}
          disabled={pending}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!pending && value.trim()) onSubmit();
            }
          }}
          placeholder="Ask the patient a question or explain what you would do..."
          aria-describedby="osce-free-form-help osce-free-form-count"
          className="max-h-44 min-h-28 resize-none border-0 bg-card/90 px-4 py-3 text-sm font-semibold leading-relaxed shadow-sm focus-visible:ring-2 focus-visible:ring-pink"
        />
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] font-bold text-muted-foreground">
          <span id="osce-free-form-help">Enter to send · Shift+Enter for a new line</span>
          <span id="osce-free-form-count" className="tabular-nums">
            {value.length}/{MAX_INPUT_LENGTH}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm font-bold text-red-900">{error}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-900 px-3 py-2 text-xs font-black text-white"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-black text-red-900"
            >
              <SquarePen className="size-3.5" /> Edit
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !value.trim() || Boolean(error)}
          className="clay-button inline-flex min-w-28 items-center justify-center gap-2 bg-pink px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Listening…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" /> Send
            </>
          )}
        </button>
      </div>
    </form>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  Lightbulb,
  LoaderCircle,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { AnnieAvatar } from "./annie-avatar";
import type { AssistantMessage, AssistantStatus, SelectionSnapshot } from "./types";

export function AnniePanel({
  status,
  expanded,
  message,
  selection,
  busy,
  onToggle,
  onDismiss,
  onOverview,
  onExplain,
  onRecall,
  onSubmitRecall,
  onClarify,
  onEngagementChange,
}: {
  status: AssistantStatus;
  expanded: boolean;
  message: AssistantMessage | null;
  selection: SelectionSnapshot | null;
  busy: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  onOverview: () => void;
  onExplain: () => void;
  onRecall: () => void;
  onSubmitRecall: (answer: string) => Promise<void>;
  onClarify: (question: string) => Promise<void>;
  onEngagementChange: (engaged: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (!expanded) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onToggle();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [expanded, onToggle]);

  const visible = Boolean(message || expanded || status === "thinking");

  return (
    <div
      ref={rootRef}
      className="annie-assistant fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] flex flex-col items-end sm:bottom-6 sm:right-6"
      onMouseEnter={() => onEngagementChange(true)}
      onMouseLeave={() => onEngagementChange(false)}
      onFocusCapture={() => onEngagementChange(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          onEngagementChange(false);
      }}
    >
      {visible && (
        <section
          className="annie-bubble mb-3 max-h-[min(68dvh,560px)] w-[min(calc(100vw-2rem),390px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,.35)]"
          aria-label="Annie learning assistant"
        >
          <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Annie</span>
              {status === "thinking" && (
                <span className="text-xs text-slate-500">Working from this page…</span>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7]"
              aria-label="Dismiss Annie"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            {status === "thinking" && !message ? (
              <div className="flex items-center gap-3 py-3 text-sm text-slate-600" role="status">
                <LoaderCircle className="size-4 animate-spin text-[#6757a6]" /> Annie is reviewing
                the page.
              </div>
            ) : message ? (
              <MessageContent message={message} />
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Choose a focused way to work with the current page.
              </p>
            )}

            {message?.kind === "recall" && (
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (answer.trim()) void onSubmitRecall(answer.trim()).then(() => setAnswer(""));
                }}
              >
                <label className="text-xs font-medium text-slate-700" htmlFor="annie-recall-answer">
                  Your explanation
                </label>
                <textarea
                  id="annie-recall-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  autoFocus
                  rows={3}
                  maxLength={1500}
                  placeholder="Explain it in your own words…"
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-5 outline-none focus:border-[#7566b7] focus:ring-2 focus:ring-[#7566b7]/20"
                />
                <button
                  type="submit"
                  disabled={busy || !answer.trim()}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-[#6757a6] px-3 text-xs font-semibold text-white hover:bg-[#594a96] disabled:opacity-50"
                >
                  <Send className="size-3.5" /> Check understanding
                </button>
              </form>
            )}

            {message?.kind === "explanation" && (
              <form
                className="mt-4 border-t border-slate-100 pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (question.trim()) void onClarify(question.trim()).then(() => setQuestion(""));
                }}
              >
                <label className="text-xs font-medium text-slate-700" htmlFor="annie-clarification">
                  Ask about this selection
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="annie-clarification"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={600}
                    placeholder="What is still unclear?"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#7566b7] focus:ring-2 focus:ring-[#7566b7]/20"
                  />
                  <button
                    type="submit"
                    disabled={busy || !question.trim()}
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#6757a6] text-white disabled:opacity-50"
                    aria-label="Ask for clarification"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </form>
            )}

            {expanded && !message?.kind.includes("recall") && (
              <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
                <Action
                  icon={<BookOpen />}
                  label="Page overview"
                  description="What to learn and remember"
                  onClick={onOverview}
                />
                <Action
                  icon={<Lightbulb />}
                  label="Explain selected text"
                  description={
                    selection
                      ? `Explain “${selection.text.slice(0, 45)}${selection.text.length > 45 ? "…" : "”"}`
                      : "Select text in the PDF first"
                  }
                  onClick={onExplain}
                  disabled={!selection}
                />
                <Action
                  icon={<Brain />}
                  label="Test my understanding"
                  description={
                    selection ? "Use the selected passage" : "Use an important idea on this page"
                  }
                  onClick={onRecall}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="relative grid size-14 place-items-center rounded-full border border-white/80 bg-white shadow-[0_10px_30px_-8px_rgba(44,35,83,.45)] outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#7566b7] focus-visible:ring-offset-2 sm:size-[60px]"
        aria-label={expanded ? "Collapse Annie" : "Open Annie learning assistant"}
        aria-expanded={expanded}
      >
        <AnnieAvatar state={status} className="size-full" />
        {status === "idle" && (
          <span
            className="absolute right-0 top-0 size-3 rounded-full border-2 border-white bg-[#7566b7]"
            aria-hidden="true"
          />
        )}
      </button>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {accessibleMessage(message, status)}
      </div>
    </div>
  );
}

function Action({
  icon,
  label,
  description,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#b6addc] hover:bg-[#faf9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7566b7] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f0edfa] text-[#6757a6] [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function MessageContent({ message }: { message: AssistantMessage }) {
  if (message.kind === "overview")
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6757a6]">
          Page {message.overview.page} overview
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message.overview.summary}</p>
        <h3 className="mt-4 text-xs font-semibold text-slate-900">What you’ll learn</h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-600">
          {message.overview.learningObjectives.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-[#7566b7]" />
              {item}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-xs font-semibold text-slate-900">Focus on remembering</h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-600">
          {message.overview.keyConcepts.map((item) => (
            <li key={item} className="flex gap-2">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#7566b7]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  if (message.kind === "explanation")
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6757a6]">
          Explanation
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message.explanation.explanation}</p>
        {message.explanation.terms.length > 0 && (
          <dl className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
            {message.explanation.terms.map((item) => (
              <div key={item.term}>
                <dt className="text-xs font-semibold text-slate-900">{item.term}</dt>
                <dd className="mt-0.5 text-xs leading-5 text-slate-600">{item.definition}</dd>
              </div>
            ))}
          </dl>
        )}
        {message.explanation.memoryAid && (
          <div className="mt-3 flex gap-2 rounded-lg border border-[#ddd7f3] bg-[#faf9ff] p-3 text-xs leading-5 text-slate-700">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#6757a6]" />
            <span>
              <strong>Memory aid:</strong> {message.explanation.memoryAid}
            </span>
          </div>
        )}
      </div>
    );
  if (message.kind === "recall")
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6757a6]">
          Active recall
        </p>
        <h3 className="mt-2 text-base font-semibold leading-6 text-slate-900">
          {message.challenge.prompt}
        </h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          The source passage is temporarily hidden. Explain the idea without looking.
        </p>
      </div>
    );
  if (message.kind === "feedback") {
    const correct = message.evaluation.verdict === "correct";
    return (
      <div>
        <div
          className={`flex items-center gap-2 text-sm font-semibold ${correct ? "text-emerald-700" : "text-amber-700"}`}
        >
          {correct ? <ThumbsUp className="size-4" /> : <Brain className="size-4" />}
          {correct
            ? "You understood the key idea"
            : message.evaluation.verdict === "partially_correct"
              ? "Partially correct"
              : "Review this distinction"}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message.evaluation.feedback}</p>
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-900">Correct explanation</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {message.evaluation.correctExplanation}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div role="alert">
      <p className="text-sm font-semibold text-red-800">{message.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{message.detail}</p>
    </div>
  );
}

function accessibleMessage(message: AssistantMessage | null, status: AssistantStatus) {
  if (status === "thinking") return "Annie is reviewing the current page.";
  if (!message) return "";
  if (message.kind === "overview") return `Page overview: ${message.overview.summary}`;
  if (message.kind === "explanation") return `Explanation: ${message.explanation.explanation}`;
  if (message.kind === "recall") return `Recall question: ${message.challenge.prompt}`;
  if (message.kind === "feedback") return `Recall feedback: ${message.evaluation.feedback}`;
  return `${message.title}: ${message.detail}`;
}

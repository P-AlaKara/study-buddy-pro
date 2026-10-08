import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquarePlus, Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

type Sentiment = "positive" | "neutral" | "negative" | null;
type Source = "button" | "prompt";

const SUBMITTED_KEY = "medley-feedback-submitted";
const PROMPT_SEEN_KEY = "medley-feedback-prompt-seen";
const STUDENT_KEY = "medley-demo-student";
// How long someone should be actively using the app before we gently ask.
const PROMPT_AFTER_SECONDS = 150;

const emptyForm = { liked: "", improve: "", wanted: "" };

export function FeedbackWidget() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sentiment, setSentiment] = useState<Sentiment>(null);
  const [source, setSource] = useState<Source>("button");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const activeSeconds = useRef(0);

  // Gentle, one-time nudge after a few minutes of active use.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SUBMITTED_KEY) || window.localStorage.getItem(PROMPT_SEEN_KEY)) {
      return;
    }
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      activeSeconds.current += 1;
      if (activeSeconds.current >= PROMPT_AFTER_SECONDS) {
        window.clearInterval(timer);
        window.localStorage.setItem(PROMPT_SEEN_KEY, "1");
        setPromptVisible(true);
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function openForm(nextSource: Source, nextSentiment: Sentiment = null) {
    setSource(nextSource);
    setSentiment(nextSentiment);
    setError("");
    setSubmitted(false);
    setForm(emptyForm);
    setPromptVisible(false);
    setOpen(true);
  }

  function dismissPrompt() {
    setPromptVisible(false);
  }

  const hasContent = Boolean(form.liked.trim() || form.improve.trim() || form.wanted.trim());

  async function submit() {
    if (!hasContent || submitting) return;
    setSubmitting(true);
    setError("");
    const studentId =
      typeof window !== "undefined" ? window.localStorage.getItem(STUDENT_KEY) : null;
    const payload = {
      sentiment,
      source,
      liked: form.liked.trim() || null,
      improve: form.improve.trim() || null,
      wanted: form.wanted.trim() || null,
      page: typeof window !== "undefined" ? window.location.pathname.slice(0, 300) : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    };
    let { error: insertError } = await supabase
      .from("feedback")
      .insert({ ...payload, student_id: studentId || null });
    // A stale/invalid demo student id would trip the foreign key — never lose
    // the feedback over it, just drop the association and retry once.
    if (insertError && studentId) {
      ({ error: insertError } = await supabase
        .from("feedback")
        .insert({ ...payload, student_id: null }));
    }
    if (insertError) {
      setError("We couldn't send your feedback just now. Please try again in a moment.");
      setSubmitting(false);
      return;
    }
    if (typeof window !== "undefined") window.localStorage.setItem(SUBMITTED_KEY, "1");
    setSubmitting(false);
    setSubmitted(true);
  }

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder: string,
  ) => (
    <label className="block">
      <span className="text-sm font-extrabold">{label}</span>
      <textarea
        value={form[key]}
        onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
        className="mt-2 block w-full resize-none rounded-2xl bg-muted px-4 py-3 text-base font-medium outline-none ring-primary focus:ring-2"
      />
    </label>
  );

  return (
    <>
      {/* Floating entry point. Hidden on the immersive case cockpit (mobile) via CSS. */}
      {!open && (
        <button
          type="button"
          onClick={() => openForm("button")}
          aria-label="Give feedback"
          className="feedback-fab clay-button fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 bg-lavender px-4 py-3 text-sm font-black text-white lg:bottom-6 lg:right-6"
        >
          <MessageSquarePlus size={18} strokeWidth={2.5} />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      {/* Timed, gentle nudge */}
      {promptVisible && !open && (
        <div
          role="dialog"
          aria-label="Quick check-in"
          className="mobile-sheet sheet-scrim fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 rounded-[22px] bg-card p-4 shadow-xl sm:inset-x-auto sm:right-6 sm:w-[22rem] lg:bottom-6"
        >
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Dismiss"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
          <div className="flex items-start gap-3 pr-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lavender-soft">
              <Sparkles size={20} className="text-lavender" />
            </span>
            <div>
              <p className="font-display text-base font-black leading-tight">
                Enjoying Medley so far?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We'd love to hear what's working and what we could do better.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="mint"
              className="flex-1"
              onClick={() => openForm("prompt", "positive")}
            >
              <ThumbsUp size={16} /> Love it
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => openForm("prompt", "negative")}
            >
              <ThumbsDown size={16} /> Could be better
            </Button>
          </div>
          <button
            type="button"
            onClick={dismissPrompt}
            className="mt-2 w-full py-1 text-center text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      )}

      {/* Feedback form: bottom sheet on mobile, centered modal on desktop */}
      {open && (
        <div
          className="sheet-scrim fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/30 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share feedback"
            className={`mobile-sheet w-full rounded-t-[28px] bg-card shadow-2xl sm:max-w-lg sm:rounded-[24px] ${isMobile ? "max-h-[90dvh] overflow-y-auto" : ""}`}
          >
            {submitted ? (
              <div className="p-7 text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint-soft">
                  <ThumbsUp className="text-mint" />
                </span>
                <h2 className="mt-4 font-display text-xl font-black">Thank you!</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your feedback helps us make Medley better for every student.
                </p>
                <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 p-5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lavender-soft">
                      <MessageSquarePlus size={20} className="text-lavender" />
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-black leading-tight">
                        Share your feedback
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        It's anonymous and takes a few seconds.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    <X />
                  </Button>
                </div>
                <div className="space-y-4 px-5 pb-2">
                  {field("What did you like?", "liked", "The part that worked well for you…")}
                  {field("What would you change?", "improve", "Anything confusing or frustrating…")}
                  {field("What would you like us to add?", "wanted", "A feature or content you wish existed…")}
                  {error && (
                    <p role="alert" className="text-sm font-bold text-pink">
                      {error}
                    </p>
                  )}
                </div>
                <div className="sticky bottom-0 mt-2 border-t border-border bg-card p-5 pt-4">
                  <Button
                    className="w-full"
                    disabled={!hasContent || submitting}
                    onClick={submit}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        <Send size={17} /> Send feedback
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

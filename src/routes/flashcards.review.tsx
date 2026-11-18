import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  Pause,
  Play,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { Flashcard, type EnterDir } from "@/components/flashcards/flashcard";
import { useFlashcardKeys } from "@/components/flashcards/use-flashcard-keys";
import {
  previewInterval,
  RATING_LABEL,
  type Card,
  type Rating,
  type Review,
  type ReviewDeckInfo,
} from "@/lib/flashcards";
import { getReviewQueue, recordReview } from "@/lib/flashcards.functions";
import { DEFAULT_DECK_COLOR, deckColorVars, getDeckColor } from "@/lib/deck-colors";
import { NoteButton } from "@/components/gamification";

export const Route = createFileRoute("/flashcards/review")({
  validateSearch: z.object({ deck: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Flashcard review | Medley" },
      {
        name: "description",
        content: "Spaced repetition review: rate each card Again, Hard, Good or Easy.",
      },
      { property: "og:title", content: "Flashcard review | Medley" },
      { property: "og:description", content: "Spaced repetition review session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewSession,
});

type Item = { card: Card; review: Review | null; deck: ReviewDeckInfo | null };
/** A card rated earlier in this session (kept so Previous can look back). */
type Done = { item: Item; rating: Rating; next: Review | null };

const RATINGS: { r: Rating; cls: string; key: 1 | 2 | 3 | 4 }[] = [
  { r: "again", cls: "bg-pink", key: 1 },
  { r: "hard", cls: "bg-peach", key: 2 },
  { r: "good", cls: "bg-mint", key: 3 },
  { r: "easy", cls: "bg-lavender", key: 4 },
];
const RATING_PILL: Record<Rating, string> = {
  again: "bg-pink-soft",
  hard: "bg-peach/40",
  good: "bg-mint-soft",
  easy: "bg-lavender-soft",
};

function dueIn(r: Review | null) {
  if (!r) return "";
  const days = (new Date(r.due_date).getTime() - Date.now()) / 86400000;
  if (days < 1.5) return "tomorrow";
  if (days < 30) return `in ${Math.round(days)} days`;
  return `in ${Math.round(days / 30)} mo`;
}

function ReviewSession() {
  const { deck } = Route.useSearch();
  const student = useActingStudent();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [history, setHistory] = useState<Done[]>([]);
  /** null = on the live card; otherwise an index into `history`. */
  const [cursor, setCursor] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enter, setEnter] = useState<EnterDir | null>(null);
  const [nav, setNav] = useState(0);
  const pauseKey = student ? `medley-review-paused-${student.id}-${deck ?? "all"}` : "";

  useEffect(() => {
    if (!student) return;
    try {
      setPaused(localStorage.getItem(pauseKey) === "1");
    } catch {
      /* storage blocked: start unpaused */
    }
    (async () => {
      try {
        const items = await getReviewQueue({ data: { deck: deck ?? undefined } });
        setQueue(items as Item[]);
      } catch {
        setError("Couldn't load your review queue. Refresh to try again.");
        setQueue([]);
      }
    })();
  }, [student?.id, deck]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePause() {
    const p = !paused;
    setPaused(p);
    try {
      if (p) localStorage.setItem(pauseKey, "1");
      else localStorage.removeItem(pauseKey);
    } catch {
      /* storage blocked: pause just won't persist */
    }
  }

  /** Swap to another card: replay the slide-in from `dir`, set the side. */
  function go(dir: EnterDir, showAnswer: boolean) {
    setShown(showAnswer);
    setEnter(dir);
    setNav((n) => n + 1);
  }

  const live = cursor === null;
  const viewing: { item: Item; done: Done | null } | null =
    cursor !== null && history[cursor]
      ? { item: history[cursor].item, done: history[cursor] }
      : queue?.[0]
        ? { item: queue[0], done: null }
        : null;

  const canPrev = !paused && history.length > 0 && (cursor === null || cursor > 0);
  // From the live card, Next skips it to the back of the queue.
  const canNext = !paused && (cursor !== null || (queue?.length ?? 0) > 1);

  function prev() {
    if (!canPrev) return;
    setCursor(cursor === null ? history.length - 1 : cursor - 1);
    go("prev", true);
  }
  function next() {
    if (!canNext || !queue) return;
    if (cursor !== null) {
      const to = cursor + 1;
      const backToLive = to >= history.length;
      setCursor(backToLive ? null : to);
      go("next", !backToLive);
      return;
    }
    const [cur, ...rest] = queue;
    setQueue([...rest, cur!]);
    go("next", false);
  }
  function backToCurrent() {
    setCursor(null);
    go("next", false);
  }

  async function rate(r: Rating) {
    if (!queue || !student || busy || !live || !shown || paused) return;
    const [cur, ...rest] = queue;
    if (!cur) return;
    setBusy(true);
    setError("");
    try {
      const data = ((await recordReview({ data: { flashcardId: cur.card.id, rating: r } })) ??
        null) as Review | null;
      setHistory((h) => [...h, { item: cur, rating: r, next: data }]);
      // "Again" puts the card back near the end of this session.
      setQueue(r === "again" ? [...rest, { ...cur, review: data ?? cur.review }] : rest);
      go("next", false);
    } catch {
      setError("Couldn't save that rating. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  useFlashcardKeys(
    {
      flip: viewing && !paused ? () => setShown((s) => !s) : undefined,
      prev: canPrev ? prev : undefined,
      next: canNext ? next : undefined,
      rate: live && shown && !paused && !busy ? (n) => rate(RATINGS[n - 1]!.r) : undefined,
    },
    !!queue,
  );

  const backLink = (
    <Link
      to={deck ? "/flashcards/$deckId" : "/flashcards"}
      params={{ deckId: deck ?? "" }}
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
  );

  if (!queue)
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
        {backLink}
        <div className="h-20 animate-pulse rounded-[22px] bg-card" />
        <div className="h-80 animate-pulse rounded-[28px] bg-yellow-soft" />
      </div>
    );

  const total = history.length + queue.length;
  const pct = total ? Math.round((history.length / total) * 100) : 0;
  const color = viewing
    ? getDeckColor(viewing.item.card.deck_id)
    : deck
      ? getDeckColor(deck)
      : DEFAULT_DECK_COLOR;
  const vars = deckColorVars(color) as CSSProperties;

  // ---------------- Session complete ----------------
  if (!viewing) {
    const tally = RATINGS.map((x) => ({ ...x, n: history.filter((h) => h.rating === x.r).length }));
    const uniqueCards = new Set(history.map((h) => h.item.card.id)).size;
    return (
      <div className="mx-auto max-w-2xl space-y-4" style={vars}>
        {backLink}
        <div className="fc-banner grid place-items-center rounded-[28px] px-6 py-14 text-center shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%),inset_0_2px_1px_oklch(1_0_0/85%)]">
          <span className="celebration flex size-20 items-center justify-center rounded-3xl bg-white/80 text-4xl shadow-[inset_0_2px_1px_white]">
            {history.length ? "🎉" : "✨"}
          </span>
          <h1 className="mt-5 font-display text-2xl font-black md:text-3xl">
            {history.length ? "Session complete!" : "All caught up!"}
          </h1>
          <p className="mt-2 max-w-sm text-ink-soft">
            {error ||
              (history.length
                ? `You reviewed ${uniqueCards} ${uniqueCards === 1 ? "card" : "cards"}. Come back when your next cards are due.`
                : "Nothing is due right now. Come back when your next cards are ready.")}
          </p>
          {history.length > 0 && (
            <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-extrabold">
              {tally.map((t) => (
                <li key={t.r} className={`rounded-full px-3 py-1.5 ${RATING_PILL[t.r]}`}>
                  {RATING_LABEL[t.r]} <span className="tabular-nums">{t.n}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {history.length > 0 && (
              <Button variant="secondary" className="bg-white/80 hover:bg-white" onClick={prev}>
                <History /> Look back
              </Button>
            )}
            {deck && (
              <Button variant="secondary" className="bg-white/80 hover:bg-white" asChild>
                <Link to="/flashcards/$deckId" params={{ deckId: deck }} hash="study-mode">
                  <Eye /> Practise all cards
                </Link>
              </Button>
            )}
            <Button variant="yellow" className="bg-[var(--fc-accent)]" asChild>
              <Link to="/flashcards">Back to your decks →</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { item, done } = viewing;
  const counts = {
    due: queue.filter((i) => i.review && i.review.repetitions >= 2).length,
    learning: queue.filter((i) => i.review && i.review.repetitions < 2).length,
    new: queue.filter((i) => !i.review).length,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4" style={vars}>
      <div className="flex items-center justify-between">
        {backLink}
        <Button size="sm" variant="secondary" onClick={togglePause}>
          {paused ? (
            <>
              <Play /> Resume
            </>
          ) : (
            <>
              <Pause /> Pause
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      <div className="rounded-[22px] bg-card px-4 py-3.5 shadow-[0_10px_22px_-14px_oklch(0.43_0.035_280/22%),inset_0_2px_1px_oklch(1_0_0/85%)]">
        <div className="flex items-baseline justify-between gap-3 text-xs font-black text-ink-soft">
          <span className="tabular-nums">
            {history.length} of {total} reviewed
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div
          className="fc-progress mt-2 h-2.5 overflow-hidden"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="fc-progress-fill h-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-extrabold">
          <span className="rounded-full bg-blue-soft px-2.5 py-1">{counts.new} new</span>
          <span className="rounded-full bg-yellow-soft px-2.5 py-1">
            {counts.learning} learning
          </span>
          <span className="rounded-full bg-mint-soft px-2.5 py-1">{counts.due} due</span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            ~{Math.max(1, Math.ceil(queue.length * 0.25))} min left
          </span>
        </div>
      </div>

      {paused ? (
        <div className="grid place-items-center rounded-[28px] bg-card px-6 py-14 text-center shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%)]">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-yellow-soft text-3xl shadow-[inset_0_2px_1px_var(--card)]">
            ⏸️
          </span>
          <p className="mt-4 font-display text-2xl font-black">Session paused</p>
          <p className="mt-1 text-ink-soft">
            Your progress is saved. Resume whenever you're ready.
          </p>
          <Button variant="yellow" className="mt-5" onClick={togglePause}>
            <Play /> Resume
          </Button>
        </div>
      ) : (
        <>
          {/* Context row: where the card is from, and notes once revealed */}
          <div className="flex min-h-9 items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs font-extrabold text-ink-soft">
              {done ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--fc-ink)]">
                  <History className="size-3.5" aria-hidden /> Looking back · card {cursor! + 1} of{" "}
                  {history.length} reviewed
                </span>
              ) : item.deck && !deck ? (
                <>From {item.deck.title}</>
              ) : item.review ? (
                <>Reviewed {item.review.repetitions}× before</>
              ) : (
                <>New card</>
              )}
            </p>
            {(shown || done) && (
              <NoteButton
                studentId={student?.id}
                contentType="flashcard"
                contentId={item.card.id}
              />
            )}
          </div>

          <Flashcard
            key={`${item.card.id}-${nav}`}
            card={item.card}
            color={color}
            subject={item.deck?.subject}
            flipped={shown}
            onFlip={() => setShown((s) => !s)}
            onSwipe={(dir) => (dir === "next" ? next() : prev())}
            enter={enter}
            stack={live ? (queue.length > 2 ? 2 : queue.length > 1 ? 1 : 0) : 0}
          />

          {/* Primary action: reveal, rate, or (looking back) what you chose */}
          <div className="pt-5">
            {done ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-card px-4 py-3 shadow-[0_10px_22px_-14px_oklch(0.43_0.035_280/22%)]">
                <p className="text-sm font-bold">
                  You rated{" "}
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-black ${RATING_PILL[done.rating]}`}
                  >
                    {RATING_LABEL[done.rating]}
                  </span>
                  {done.next && (
                    <span className="text-ink-soft"> · next review {dueIn(done.next)}</span>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="yellow"
                  className="bg-[var(--fc-accent)]"
                  onClick={backToCurrent}
                >
                  <Undo2 /> {queue.length ? "Back to current card" : "Finish session"}
                </Button>
              </div>
            ) : !shown ? (
              <Button
                variant="yellow"
                size="lg"
                className="w-full bg-[var(--fc-accent)]"
                onClick={() => setShown(true)}
              >
                <Eye /> Show answer
                <kbd className="fc-kbd ml-1 hidden md:inline-block" aria-hidden>
                  Space
                </kbd>
              </Button>
            ) : (
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="group"
                aria-label="How well did you recall it?"
              >
                {RATINGS.map((x) => (
                  <button
                    key={x.r}
                    type="button"
                    disabled={busy}
                    onClick={() => rate(x.r)}
                    className={`clay-button ${x.cls} relative flex flex-col items-center px-2 py-3 font-extrabold disabled:opacity-60`}
                  >
                    <kbd
                      className="absolute left-2.5 top-2 hidden rounded-md bg-white/60 px-1.5 text-[10px] font-black md:block"
                      aria-hidden
                    >
                      {x.key}
                    </kbd>
                    <span>{RATING_LABEL[x.r]}</span>
                    <span className="text-[11px] font-bold opacity-80">
                      {previewInterval(item.review, x.r)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-2xl bg-pink-soft px-4 py-2.5 text-sm font-bold"
              >
                {error}
              </p>
            )}
          </div>

          {/* Previous / Next */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Previous card"
              title="Look back at the cards you've rated"
            >
              <ChevronLeft /> Previous
            </Button>
            <p className="min-w-0 flex-1 text-center text-xs font-bold text-muted-foreground">
              <span className="hidden md:inline">
                <kbd className="fc-kbd">←</kbd> <kbd className="fc-kbd">→</kbd> move ·{" "}
                <kbd className="fc-kbd">Space</kbd> flip · <kbd className="fc-kbd">1</kbd>–
                <kbd className="fc-kbd">4</kbd> rate
              </span>
              <span className="md:hidden">
                {live ? "Swipe to skip or look back" : "Swipe to move"}
              </span>
            </p>
            <Button
              variant="secondary"
              onClick={next}
              disabled={!canNext}
              aria-label={live ? "Next card (skip this one for now)" : "Next card"}
              title={live ? "Skip for now. It comes back at the end of this session." : undefined}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

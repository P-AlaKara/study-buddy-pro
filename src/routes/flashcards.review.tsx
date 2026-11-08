import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import {
  clozeBack,
  clozeFront,
  previewInterval,
  CARD_TYPE_LABEL,
  type Card,
  type Rating,
  type Review,
} from "@/lib/flashcards";
import { getReviewQueue, recordReview } from "@/lib/flashcards.functions";
import { DEFAULT_DECK_COLOR, getDeckColor } from "@/lib/deck-colors";
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

type Item = { card: Card; review: Review | null };
const RATINGS: { r: Rating; label: string; cls: string }[] = [
  { r: "again", label: "Again", cls: "bg-pink" },
  { r: "hard", label: "Hard", cls: "bg-peach" },
  { r: "good", label: "Good", cls: "bg-yellow" },
  { r: "easy", label: "Easy", cls: "bg-lavender" },
];

function ReviewSession() {
  const { deck } = Route.useSearch();
  const student = useActingStudent();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  // Card colour follows the deck's chosen colour (browser preference). When the
  // session spans every deck, fall back to the default.
  const [cardColor, setCardColor] = useState(DEFAULT_DECK_COLOR);
  const pauseKey = student ? `medley-review-paused-${student.id}-${deck ?? "all"}` : "";

  useEffect(() => {
    setCardColor(deck ? getDeckColor(deck) : DEFAULT_DECK_COLOR);
  }, [deck]);

  useEffect(() => {
    if (!student) return;
    setPaused(localStorage.getItem(pauseKey) === "1");
    (async () => {
      const items = await getReviewQueue({ data: { deck: deck ?? undefined } });
      setQueue(items as Item[]);
    })();
  }, [student?.id, deck]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePause() {
    const p = !paused;
    setPaused(p);
    if (p) localStorage.setItem(pauseKey, "1");
    else localStorage.removeItem(pauseKey);
  }

  async function rate(r: Rating) {
    if (!queue || !student) return;
    const [cur, ...rest] = queue;
    if (!cur) return;
    const data = await recordReview({ data: { flashcardId: cur.card.id, rating: r } });
    setShown(false);
    setDoneCount((c) => c + 1);
    // "Again" puts the card back near the end of this session.
    setQueue(
      r === "again"
        ? [...rest, { card: cur.card, review: (data as unknown as Review) ?? null }]
        : rest,
    );
  }

  const back = (
    <Link
      to={deck ? "/flashcards/$deckId" : "/flashcards"}
      params={{ deckId: deck ?? "" }}
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
  );
  if (!queue)
    return (
      <div className="max-w-2xl space-y-4">
        {back}
        <div className="clay-card h-72 animate-pulse bg-yellow-soft" />
      </div>
    );

  const counts = {
    due: queue.filter((i) => i.review && i.review.repetitions >= 2).length,
    learning: queue.filter((i) => i.review && i.review.repetitions < 2).length,
    new: queue.filter((i) => !i.review).length,
  };

  if (!queue.length)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {back}
        <div className="clay-card grid place-items-center bg-card px-6 py-16 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-yellow-soft text-4xl shadow-[inset_0_2px_1px_var(--card)]">
            ✨
          </span>
          <p className="mt-5 font-display text-2xl font-black">All caught up!</p>
          <p className="mt-2 max-w-sm text-ink-soft">
            {doneCount ? `You reviewed ${doneCount} cards.` : "Nothing is due right now."} Come back
            when your next cards are ready.
          </p>
          <Button variant="yellow" className="mt-6" asChild>
            <Link to="/flashcards">Back to your decks →</Link>
          </Button>
        </div>
      </div>
    );

  const { card, review } = queue[0]!;
  const isCloze = card.type === "cloze" && card.cloze_text;

  const total = doneCount + queue.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        {back}
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
      <div className="clay-card flex items-center gap-3 bg-card px-4 py-3">
        <span className="whitespace-nowrap text-xs font-black text-ink-soft">
          {doneCount} / {total}
        </span>
        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted soft-inset">
          <span className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
        </span>
        <span className="whitespace-nowrap text-xs font-black text-ink-soft">{pct}%</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-extrabold">
        <span className="rounded-full bg-blue-soft px-3 py-1">{counts.new} new</span>
        <span className="rounded-full bg-pink-soft px-3 py-1">{counts.learning} learning</span>
        <span className="rounded-full bg-mint-soft px-3 py-1">{counts.due} due</span>
        <span className="rounded-full bg-muted px-3 py-1">
          ~{Math.max(1, Math.ceil(queue.length * 0.25))} min left
        </span>
      </div>

      {paused ? (
        <div className="clay-card grid place-items-center bg-card px-6 py-14 text-center">
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
          <div
            className="clay-card flex min-h-72 flex-col p-6 md:min-h-80 md:p-8"
            style={{ background: cardColor }}
          >
            <span className="self-start rounded-full bg-card/70 px-3 py-1 text-xs font-extrabold">
              {CARD_TYPE_LABEL[card.type]}
            </span>
            {card.image_url && (
              <img
                src={card.image_url}
                alt="Card image"
                className="mt-4 max-h-56 w-full rounded-2xl bg-card/60 object-contain p-2"
              />
            )}
            <p className="mt-5 font-display text-xl font-black leading-snug md:text-2xl">
              {isCloze ? clozeFront(card.cloze_text!) : card.front}
            </p>
            {shown ? (
              <>
                <div className="mt-5 rounded-2xl bg-card/75 p-4 leading-relaxed">
                  {isCloze ? clozeBack(card.cloze_text!) : card.back}
                </div>
                <div className="mt-4">
                  <NoteButton studentId={student?.id} contentType="flashcard" contentId={card.id} />
                </div>
              </>
            ) : (
              <div className="mt-auto pt-6 text-xs font-bold text-ink-soft">
                Rate your recall after revealing the answer.
              </div>
            )}
          </div>
          {!shown ? (
            <Button variant="yellow" size="lg" className="w-full" onClick={() => setShown(true)}>
              Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((x) => (
                <button
                  key={x.r}
                  onClick={() => rate(x.r)}
                  className={`clay-button ${x.cls} flex flex-col items-center px-2 py-3 font-extrabold`}
                >
                  <span>{x.label}</span>
                  <span className="text-[11px] font-bold opacity-80">
                    {previewInterval(review, x.r)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Card colour follows the deck's chosen colour.
          </p>
        </>
      )}
    </div>
  );
}

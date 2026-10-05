import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Pause, Play, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { supabase } from "@/integrations/supabase/client";
import {
  clozeBack,
  clozeFront,
  previewInterval,
  schedule,
  CARD_TYPE_LABEL,
  type Card,
  type Rating,
  type Review,
} from "@/lib/flashcards";
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
  { r: "good", label: "Good", cls: "bg-mint" },
  { r: "easy", label: "Easy", cls: "bg-blue" },
];

function ReviewSession() {
  const { deck } = Route.useSearch();
  const student = useActingStudent();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const pauseKey = student ? `medley-review-paused-${student.id}-${deck ?? "all"}` : "";

  useEffect(() => {
    if (!student) return;
    setPaused(localStorage.getItem(pauseKey) === "1");
    (async () => {
      let deckIds: string[];
      if (deck) deckIds = [deck];
      else {
        const [{ data: d }, { data: s }] = await Promise.all([
          supabase.from("flashcard_decks").select("id,is_official,owner_student_id"),
          supabase.from("saved_decks").select("deck_id").eq("student_id", student.id),
        ]);
        const saved = new Set((s ?? []).map((x) => x.deck_id));
        deckIds = (d ?? [])
          .filter((x) => x.is_official || x.owner_student_id === student.id || saved.has(x.id))
          .map((x) => x.id);
      }
      const [{ data: cards }, { data: reviews }] = await Promise.all([
        supabase.from("flashcards").select("*").in("deck_id", deckIds).order("position"),
        supabase.from("flashcard_reviews").select("*").eq("student_id", student.id),
      ]);
      const byCard = new Map((reviews ?? []).map((r) => [r.flashcard_id, r as unknown as Review]));
      const now = Date.now();
      const items = ((cards ?? []) as unknown as Card[]).map((card) => ({
        card,
        review: byCard.get(card.id) ?? null,
      }));
      const dueItems = items.filter(
        (i) => i.review && new Date(i.review.due_date).getTime() <= now,
      );
      const newItems = items.filter((i) => !i.review).slice(0, 10);
      setQueue([...dueItems, ...newItems]);
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
    const next = schedule(cur.review, r);
    const row = {
      student_id: student.id,
      flashcard_id: cur.card.id,
      ...next,
      last_rating: r,
      last_reviewed_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("flashcard_reviews")
      .upsert(row, { onConflict: "student_id,flashcard_id" })
      .select("*")
      .single();
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
      <div className="max-w-2xl space-y-4">
        {back}
        <div className="clay-card bg-yellow-soft p-8 text-center">
          <PartyPopper className="mx-auto h-10 w-10" />
          <p className="mt-3 font-display text-2xl font-black">All caught up!</p>
          <p className="mt-1 text-ink-soft">
            {doneCount ? `You reviewed ${doneCount} cards.` : "Nothing is due right now."} Come back
            tomorrow.
          </p>
          <Button variant="yellow" className="mt-5" asChild>
            <Link to="/flashcards">Back to decks</Link>
          </Button>
        </div>
      </div>
    );

  const { card, review } = queue[0]!;
  const isCloze = card.type === "cloze" && card.cloze_text;

  return (
    <div className="max-w-2xl space-y-4">
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
      <div className="flex flex-wrap gap-2 text-xs font-extrabold">
        <span className="rounded-full bg-blue-soft px-3 py-1">{counts.new} new</span>
        <span className="rounded-full bg-pink-soft px-3 py-1">{counts.learning} learning</span>
        <span className="rounded-full bg-mint-soft px-3 py-1">{counts.due} due</span>
        <span className="rounded-full bg-muted px-3 py-1">
          ~{Math.max(1, Math.ceil(queue.length * 0.25))} min left
        </span>
      </div>

      {paused ? (
        <div className="clay-card bg-yellow-soft p-10 text-center">
          <Pause className="mx-auto h-10 w-10" />
          <p className="mt-3 font-display text-2xl font-black">Session paused</p>
          <p className="mt-1 text-ink-soft">
            Your progress is saved. Resume whenever you're ready.
          </p>
          <Button variant="yellow" className="mt-5" onClick={togglePause}>
            <Play /> Resume
          </Button>
        </div>
      ) : (
        <>
          <div className="clay-card min-h-72 bg-card p-6 md:p-8">
            <span className="rounded-full bg-yellow-soft px-3 py-1 text-xs font-extrabold">
              {CARD_TYPE_LABEL[card.type]}
            </span>
            {card.image_url && (
              <img
                src={card.image_url}
                alt="Card image"
                className="mt-4 max-h-56 w-full rounded-2xl bg-muted object-contain p-2"
              />
            )}
            <p className="mt-5 font-display text-xl font-black leading-snug md:text-2xl">
              {isCloze ? clozeFront(card.cloze_text!) : card.front}
            </p>
            {shown && (
              <>
                <div className="mt-5 rounded-2xl bg-yellow-soft p-4 leading-relaxed">
                  {isCloze ? clozeBack(card.cloze_text!) : card.back}
                </div>
                <div className="mt-4">
                  <NoteButton studentId={student?.id} contentType="flashcard" contentId={card.id} />
                </div>
              </>
            )}
          </div>
          {!shown ? (
            <Button variant="yellow" size="lg" className="w-full" onClick={() => setShown(true)}>
              Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
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
        </>
      )}
    </div>
  );
}

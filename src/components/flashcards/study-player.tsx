import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Eye, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deckColorVars } from "@/lib/deck-colors";
import { Flashcard } from "./flashcard";
import type { StudyDeck } from "./use-study-deck";
import { useFlashcardKeys } from "./use-flashcard-keys";

export function StudyPlayer({
  study,
  color,
  subject,
  id,
}: {
  study: StudyDeck;
  color: string;
  subject?: string | null | undefined;
  id?: string | undefined;
}) {
  const { current, index, total } = study;
  useFlashcardKeys(
    {
      flip: study.flip,
      prev: study.atStart ? undefined : study.prev,
      next: study.atEnd ? undefined : study.next,
    },
    !!current,
  );
  if (!current) return null;

  const remaining = total - index - 1;
  const pct = total ? ((index + 1) / total) * 100 : 0;
  const finished = study.atEnd && study.flipped;

  return (
    <section
      id={id}
      aria-label="Study mode"
      className="scroll-mt-24 rounded-[28px] bg-card p-4 shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%),inset_0_2px_1px_oklch(1_0_0/85%)] md:p-6"
      style={deckColorVars(color) as CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 font-display text-xl font-black md:text-2xl">
            <span className="fc-dot size-2.5" aria-hidden /> Study mode
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Flip through every card at your own pace. This won't change your review schedule.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={study.isShuffled}
          onClick={study.toggleShuffle}
          className={study.isShuffled ? "bg-[var(--fc-accent)] hover:bg-[var(--fc-accent)]" : ""}
          disabled={total < 2}
        >
          <Shuffle /> {study.isShuffled ? "Shuffled" : "Shuffle"}
        </Button>
      </div>

      <div className="mx-auto mt-5 max-w-2xl">
        <Flashcard
          key={study.navKey}
          card={current}
          color={color}
          subject={subject}
          flipped={study.flipped}
          onFlip={study.flip}
          onSwipe={(dir) => (dir === "next" ? study.next() : study.prev())}
          enter={study.enter}
          stack={remaining >= 2 ? 2 : remaining === 1 ? 1 : 0}
          position={{ index, total }}
        />

        <div className="mt-9 flex items-center gap-2 sm:gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="px-4 sm:px-6"
            onClick={study.prev}
            disabled={study.atStart}
            aria-label="Previous card"
          >
            <ChevronLeft /> <span className="sm:hidden">Prev</span>
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-black text-ink-soft">
              <span className="tabular-nums" aria-live="polite">
                Card {index + 1} of {total}
              </span>
              <span className="hidden tabular-nums sm:inline">{study.revealedCount} revealed</span>
            </div>
            <div
              className="fc-progress h-2.5 overflow-hidden"
              role="progressbar"
              aria-label="Position in deck"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={index + 1}
            >
              <div className="fc-progress-fill h-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {study.atEnd ? (
            <Button
              variant="yellow"
              size="lg"
              className="bg-[var(--fc-accent)] px-4 sm:px-6"
              onClick={study.restart}
              disabled={total < 2}
              aria-label="Start over from the first card"
            >
              <RotateCcw /> <span className="sm:hidden">Restart</span>
              <span className="hidden sm:inline">Start over</span>
            </Button>
          ) : (
            <Button
              variant="yellow"
              size="lg"
              className="bg-[var(--fc-accent)] px-4 sm:px-6"
              onClick={study.next}
              aria-label="Next card"
            >
              Next <ChevronRight />
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Button variant="ghost" size="sm" onClick={study.flip}>
            <Eye /> {study.flipped ? "Show question" : "Show answer"}
          </Button>
          <p className="hidden items-center gap-1.5 text-xs font-bold text-muted-foreground md:flex">
            <kbd className="fc-kbd">←</kbd>
            <kbd className="fc-kbd">→</kbd> move
            <span aria-hidden>·</span>
            <kbd className="fc-kbd">Space</kbd> flip
          </p>
        </div>

        {finished && (
          <p className="celebration mt-3 text-center text-sm font-bold text-[var(--fc-ink)]">
            🎉 That's the whole deck. You revealed {study.revealedCount} of {total} cards.
          </p>
        )}
      </div>
    </section>
  );
}

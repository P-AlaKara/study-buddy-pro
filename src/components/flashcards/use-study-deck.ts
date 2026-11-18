import { useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/flashcards";
import type { EnterDir } from "./flashcard";

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Free-browse state for a deck: an ordered list of card ids, a cursor, flip
 * state and the slide direction. It never touches the review schedule.
 */
export function useStudyDeck(cards: Card[]) {
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [enter, setEnter] = useState<EnterDir | null>(null);
  const [nav, setNav] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());

  // Keep the order in step with edits: drop deleted cards, append new ones.
  useEffect(() => {
    setOrder((prev) => {
      const ids = new Set(cards.map((c) => c.id));
      const kept = prev.filter((id) => ids.has(id));
      const keptSet = new Set(kept);
      return [...kept, ...cards.filter((c) => !keptSet.has(c.id)).map((c) => c.id)];
    });
  }, [cards]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const total = order.length;
  const index = Math.min(pos, Math.max(0, total - 1));
  const current = total ? (byId.get(order[index]!) ?? null) : null;

  function show(i: number, dir: EnterDir) {
    setPos(i);
    setFlipped(false);
    setEnter(dir);
    setNav((n) => n + 1);
  }

  return {
    current,
    index,
    total,
    flipped,
    enter,
    /** Remount key: replays the slide-in and starts each card question-side up. */
    navKey: `${current?.id ?? "none"}-${nav}`,
    isShuffled,
    revealedCount: revealed.size,
    atStart: index === 0,
    atEnd: index >= total - 1,
    flip() {
      if (!current) return;
      setFlipped((f) => !f);
      setRevealed((s) => (s.has(current.id) ? s : new Set(s).add(current.id)));
    },
    prev() {
      if (index > 0) show(index - 1, "prev");
    },
    next() {
      if (index < total - 1) show(index + 1, "next");
    },
    restart() {
      show(0, "next");
    },
    jumpTo(id: string) {
      const i = order.indexOf(id);
      if (i >= 0) show(i, i >= index ? "next" : "prev");
    },
    toggleShuffle() {
      if (isShuffled) {
        // Back to deck order, staying on the same card.
        const natural = cards.map((c) => c.id);
        setOrder(natural);
        setIsShuffled(false);
        show(Math.max(0, natural.indexOf(order[index] ?? "")), "next");
      } else {
        setOrder(shuffled(order));
        setIsShuffled(true);
        show(0, "next");
      }
    },
  };
}

export type StudyDeck = ReturnType<typeof useStudyDeck>;

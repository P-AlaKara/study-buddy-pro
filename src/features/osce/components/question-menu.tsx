import { Check, Clock3, MessageCircleMore } from "lucide-react";
import type { OsceState } from "../engine.js";
import { getAvailableCards } from "../engine.js";
import {
  OSCE_CATEGORIES,
  type OsceCard,
  type OsceCategory,
  type OsceMode,
  type OsceStation,
} from "../schema.js";

const CATEGORY_LABELS: Record<OsceCategory, string> = {
  opening: "Opening",
  presenting_complaint: "Presenting complaint",
  history_of_symptom: "History of pain / symptom",
  past_and_drug_history: "Past & drug history",
  family_and_social: "Family & social",
  communicate: "Communicate",
  closing: "Closing",
};

export function QuestionMenu({
  game,
  station,
  mode,
  category,
  onCategoryChange,
  onChoose,
  pendingCardId,
  compact = false,
}: {
  game: OsceState;
  station: OsceStation;
  mode: OsceMode;
  category: OsceCategory;
  onCategoryChange: (category: OsceCategory) => void;
  onChoose: (card: OsceCard) => void;
  pendingCardId: string | null;
  compact?: boolean;
}) {
  const availableCards = getAvailableCards(game, station);
  const availableIds = new Set(availableCards.map((card) => card.id));
  const usedIds = new Set(game.completedActions.map((action) => action.cardId));
  const curveballPending = game.curveball.status === "pending";
  const visibleCategories = curveballPending ? (["communicate"] as const) : OSCE_CATEGORIES;

  const cards = curveballPending
    ? availableCards
    : game.cardOrder[category]
        .map((id) => station.cards.find((card) => card.id === id))
        .filter((card): card is OsceCard => Boolean(card))
        .filter((card) => availableIds.has(card.id) || usedIds.has(card.id));

  return (
    <section className={compact ? "" : "clay-card bg-card p-4 md:p-5"} aria-label="Question menu">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-pink">
            <MessageCircleMore className="size-4" aria-hidden="true" /> What will you say or do?
          </p>
          {curveballPending && (
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              The patient is waiting for your answer.
            </p>
          )}
        </div>
      </div>

      {!curveballPending && (
        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Question categories"
        >
          {visibleCategories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              onClick={() => onCategoryChange(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${
                category === item
                  ? "bg-foreground text-background shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-pink-soft hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>
      )}

      <div
        className={`mt-3 grid gap-2.5 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}
      >
        {cards.map((card) => {
          const used = usedIds.has(card.id) && !card.repeatable;
          const available = availableIds.has(card.id);
          const busy = pendingCardId !== null;
          return (
            <button
              key={card.id}
              type="button"
              disabled={!available || busy}
              onClick={() => onChoose(card)}
              className={`osce-question-card relative min-h-24 rounded-[20px] border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${
                used
                  ? "osce-card-used border-transparent bg-muted text-muted-foreground"
                  : "border-white/80 bg-pink-soft text-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
              } disabled:cursor-not-allowed disabled:hover:translate-y-0`}
            >
              <span className="block pr-12 text-sm font-black leading-snug">{card.label}</span>
              <span className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3" aria-hidden="true" /> ~{card.timeCostSec}s
                </span>
                {mode === "learn" && card.qualityTag && (
                  <span className="rounded-full bg-card px-2 py-1 text-foreground">
                    {card.qualityTag}
                  </span>
                )}
                {used && (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden="true" /> Used
                  </span>
                )}
              </span>
              {pendingCardId === card.id && (
                <span
                  className="absolute right-3 top-3 flex gap-1"
                  aria-label="Patient is answering"
                >
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="case-typing-dot size-1.5 rounded-full bg-pink"
                      style={{ animationDelay: `${index * 140}ms` }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!cards.length && (
        <div className="mt-3 rounded-2xl bg-muted p-5 text-center text-sm font-bold text-muted-foreground">
          No options are currently available in this category.
        </div>
      )}
    </section>
  );
}

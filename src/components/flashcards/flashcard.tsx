import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  Bone,
  Brackets,
  Check,
  Image as ImageIcon,
  Microscope,
  RotateCcw,
  ScanSearch,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import {
  CARD_TYPE_LABEL,
  clozeFront,
  clozeSegments,
  type Card,
  type CardType,
} from "@/lib/flashcards";
import { deckColorVars } from "@/lib/deck-colors";
import { answerLines, isClozeCard, promptText } from "./card-text";

export type EnterDir = "next" | "prev";

const TYPE_ICON: Record<CardType, LucideIcon> = {
  basic: StickyNote,
  cloze: Brackets,
  image: ImageIcon,
  image_identification: ScanSearch,
  anatomy_labeling: Bone,
  ecg: Activity,
  histology: Microscope,
};

export function CardTypeIcon({ type, className }: { type: CardType; className?: string }) {
  const Icon = TYPE_ICON[type] ?? StickyNote;
  return <Icon className={className} aria-hidden />;
}

/** Cloze sentence with styled blanks (front) or highlighted reveals (back). */
export function ClozeText({ text, revealed }: { text: string; revealed: boolean }) {
  return (
    <>
      {clozeSegments(text).map((s, i) =>
        !s.hidden ? (
          <span key={i}>{s.text}</span>
        ) : revealed ? (
          <mark key={i} className="fc-reveal">
            {s.text}
          </mark>
        ) : (
          <span key={i} className="fc-blank">
            <span aria-hidden>…</span>
            <span className="sr-only">blank</span>
          </span>
        ),
      )}
    </>
  );
}

function questionSize(len: number, compact: boolean) {
  if (compact) return len > 120 ? "text-base" : "text-lg";
  if (len > 170) return "text-lg md:text-xl";
  if (len > 90) return "text-xl md:text-2xl";
  return "text-2xl md:text-[2rem] md:leading-[1.15]";
}

type FlashcardProps = {
  card: Card;
  /** Stored deck pastel (see lib/deck-colors); drives tint, accent and ink. */
  color: string;
  subject?: string | null | undefined;
  flipped: boolean;
  onFlip: () => void;
  /** Horizontal swipe on the card (touch or mouse drag). */
  onSwipe?: ((dir: EnterDir) => void) | undefined;
  /** Slide-in direction; parents remount via `key` to replay it. */
  enter?: EnterDir | null | undefined;
  /** Number of sheets to draw underneath (0 hides the stack). */
  stack?: 0 | 1 | 2;
  /** Small preview variant (editor panel). */
  compact?: boolean;
  position?: { index: number; total: number } | undefined;
  className?: string | undefined;
};

/**
 * A deck-tinted flashcard that flips in 3D. Both faces are real buttons, so
 * the card is keyboard- and screen-reader-operable; the hidden face is `inert`.
 * Keep other interactive controls (notes, ratings) outside the card.
 */
export function Flashcard({
  card,
  color,
  subject,
  flipped,
  onFlip,
  onSwipe,
  enter,
  stack = 0,
  compact = false,
  position,
  className = "",
}: FlashcardProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // When the student flips from the card itself, keep focus on the visible
  // face (the face they activated has just become inert).
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (flipped ? backRef : frontRef).current?.focus({ preventScroll: true });
  }, [flipped]);

  function handleClick() {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    moveFocus.current = !!sceneRef.current?.contains(document.activeElement);
    onFlip();
  }

  const cloze = isClozeCard(card);
  const prompt = promptText(card);
  const TypeIcon = TYPE_ICON[card.type] ?? StickyNote;
  const lines = answerLines(card.back);
  const showClozeNotes = cloze && card.back.trim() && card.back.trim() !== prompt.trim();
  const style = {
    ...deckColorVars(color),
    ...(compact ? { "--fc-min-h": "13.5rem", "--fc-radius": "22px" } : null),
  } as CSSProperties;

  const typeChip = (
    <span className="fc-badge inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold">
      <TypeIcon className="size-3.5" aria-hidden /> {CARD_TYPE_LABEL[card.type]}
    </span>
  );
  const counter = position && (
    <span className="text-xs font-black tabular-nums text-[var(--fc-ink)]">
      {position.index + 1} / {position.total}
    </span>
  );

  return (
    <div
      className={`fc-deck ${className}`}
      style={style}
      data-stack={stack ? String(stack) : undefined}
      data-size={compact ? "sm" : undefined}
    >
      <div
        ref={sceneRef}
        className="fc-scene"
        data-flipped={flipped ? "true" : "false"}
        data-enter={enter ?? undefined}
        onPointerDown={(e) => {
          swiped.current = false;
          pointer.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start || !onSwipe) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            swiped.current = true;
            onSwipe(dx < 0 ? "next" : "prev");
          }
        }}
        onPointerCancel={() => (pointer.current = null)}
      >
        <div className="fc-inner">
          {/* ---- Front: the question ---- */}
          <button
            ref={frontRef}
            type="button"
            className="fc-face fc-front flex flex-col"
            data-side="Q"
            inert={flipped}
            onClick={handleClick}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="fc-badge inline-flex min-w-0 items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                <span className="fc-dot size-2 shrink-0" aria-hidden />
                <span className="truncate">{subject || "Flashcard"}</span>
              </span>
              {typeChip}
            </span>

            {cloze && card.front.trim() && (
              <span className="mt-4 block text-xs font-black uppercase tracking-wider text-[var(--fc-ink)]">
                {card.front}
              </span>
            )}

            <span
              className={`${cloze && card.front.trim() ? "mt-2" : compact ? "mt-4" : "mt-6"} flex gap-3.5`}
            >
              <span className="fc-accent-bar" aria-hidden />
              <span
                className={`min-w-0 font-display font-black leading-snug tracking-tight text-foreground ${questionSize(prompt.length, compact)}`}
              >
                {cloze ? <ClozeText text={card.cloze_text!} revealed={false} /> : card.front}
              </span>
            </span>

            {card.image_url && (
              <img
                src={card.image_url}
                alt="Card image"
                className={`mt-5 w-full rounded-2xl bg-white/70 object-contain p-2 ring-1 ring-white ${compact ? "max-h-28" : "max-h-56"}`}
              />
            )}

            <span className="mt-auto flex items-center justify-between gap-3 pt-6">
              <span className="fc-hint inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold">
                <RotateCcw className="size-3.5" aria-hidden /> Reveal answer
                {!compact && (
                  <kbd className="fc-kbd ml-1 hidden md:inline-block" aria-hidden>
                    Space
                  </kbd>
                )}
              </span>
              {counter}
            </span>
            <span className="sr-only">. Activate to reveal the answer.</span>
          </button>

          {/* ---- Back: the answer ---- */}
          <button
            ref={backRef}
            type="button"
            className="fc-face fc-back flex flex-col"
            data-side="A"
            inert={!flipped}
            onClick={handleClick}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="fc-badge-solid inline-flex items-center gap-1 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                <Check className="size-3.5" aria-hidden strokeWidth={3} /> Answer
              </span>
              {typeChip}
            </span>

            <span className="mt-4 flex gap-2.5">
              <span className="fc-accent-bar" data-thin aria-hidden />
              <span
                className={`min-w-0 text-sm font-bold leading-snug text-ink-soft ${compact ? "line-clamp-2" : "line-clamp-3"}`}
              >
                {cloze && card.front.trim() ? card.front : prompt}
              </span>
            </span>

            <span className="mt-4 flex flex-col gap-2">
              {cloze ? (
                <>
                  <span
                    className={`fc-answer block px-4 py-3.5 leading-relaxed ${compact ? "text-sm" : "text-base md:text-lg"}`}
                  >
                    <ClozeText text={card.cloze_text!} revealed />
                  </span>
                  {showClozeNotes && (
                    <AnswerBlock compact={compact} label="Notes">
                      {card.back}
                    </AnswerBlock>
                  )}
                </>
              ) : lines.length > 1 ? (
                lines.map((line, i) => (
                  <span
                    key={i}
                    className={`fc-answer flex items-start gap-3 px-3.5 py-2.5 leading-snug ${compact ? "text-sm" : "text-[15px] md:text-base"}`}
                  >
                    <span className="fc-answer-num mt-0.5 flex size-5 shrink-0 items-center justify-center text-[11px] font-black">
                      {i + 1}
                    </span>
                    <span className="min-w-0 font-semibold">{line}</span>
                  </span>
                ))
              ) : (
                <span
                  className={`fc-answer block px-4 py-4 font-bold leading-relaxed ${
                    compact
                      ? "text-sm"
                      : card.back.length < 80
                        ? "text-lg md:text-xl"
                        : "text-base md:text-lg"
                  }`}
                >
                  {card.back}
                </span>
              )}
            </span>

            <span className="mt-auto flex items-center justify-between gap-3 pt-5">
              <span className="fc-hint inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold">
                <RotateCcw className="size-3.5" aria-hidden /> Back to question
              </span>
              {counter}
            </span>
            <span className="sr-only">. Activate to show the question again.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AnswerBlock({
  label,
  children,
  compact,
}: {
  label: string;
  children: ReactNode;
  compact: boolean;
}) {
  return (
    <span
      className={`fc-answer block px-4 py-3 leading-relaxed ${compact ? "text-sm" : "text-[15px]"}`}
    >
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-[var(--fc-ink)]">
        {label}
      </span>
      {children}
    </span>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { DrAmbrose } from "./dr-ambrose.js";
import {
  CASE_TOUR_STEPS,
  type TourContext,
  type TourControls,
  type TourStep,
} from "./case-tour-steps.js";
import { markCaseTourSeen } from "./case-tour-storage.js";

/** Breathing room between the spotlit element and the ring. */
const SPOT_PADDING = 8;
/** Gap between the ring and the card, and the card's minimum screen margin. */
const CARD_GAP = 16;
const SCREEN_MARGIN = 12;
const CARD_MAX_WIDTH = 368;
/** Below this width the card docks to the top or bottom edge instead of floating. */
const PHONE_BREAKPOINT = 640;

type Rect = { top: number; left: number; width: number; height: number };

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** The first element for any of `ids` that is actually rendered on screen. */
function findTarget(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }
  }
  return null;
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** `**bold**` → <strong>; everything else is plain text. */
function renderCopy(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-black text-[var(--hud-navy)]">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    );
}

/**
 * Where the card goes: beside the spotlight on the side with the most room,
 * clamped to the screen. Phones dock it to whichever edge is further from the
 * spotlight. No spotlight → centred.
 */
function placeCard(
  spot: Rect | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number; width: number } {
  const { width: vw, height: vh } = viewport;
  const clampX = (x: number, w: number) =>
    Math.min(Math.max(x, SCREEN_MARGIN), vw - SCREEN_MARGIN - w);
  const clampY = (y: number) =>
    Math.min(Math.max(y, SCREEN_MARGIN), Math.max(SCREEN_MARGIN, vh - SCREEN_MARGIN - card.height));

  if (vw < PHONE_BREAKPOINT) {
    const width = vw - SCREEN_MARGIN * 2;
    if (!spot) return { top: clampY((vh - card.height) / 2), left: SCREEN_MARGIN, width };
    const spotCentre = spot.top + spot.height / 2;
    return {
      top: spotCentre > vh / 2 ? SCREEN_MARGIN : clampY(vh - SCREEN_MARGIN - card.height),
      left: SCREEN_MARGIN,
      width,
    };
  }

  const width = Math.min(CARD_MAX_WIDTH, vw - SCREEN_MARGIN * 2);
  if (!spot) {
    return { top: clampY((vh - card.height) / 2), left: (vw - width) / 2, width };
  }

  const room = {
    right: vw - (spot.left + spot.width) - CARD_GAP - SCREEN_MARGIN,
    left: spot.left - CARD_GAP - SCREEN_MARGIN,
    below: vh - (spot.top + spot.height) - CARD_GAP - SCREEN_MARGIN,
    above: spot.top - CARD_GAP - SCREEN_MARGIN,
  };
  const fits = {
    right: room.right >= width,
    left: room.left >= width,
    below: room.below >= card.height,
    above: room.above >= card.height,
  };
  // Prefer the side that leaves the most spare room once the card is in it.
  const options = (Object.keys(fits) as Array<keyof typeof fits>)
    .filter((side) => fits[side])
    .sort((a, b) => {
      const spare = (side: keyof typeof room) =>
        side === "left" || side === "right" ? room[side] - width : room[side] - card.height;
      return spare(b) - spare(a);
    });
  const side = options[0];

  const centreX = spot.left + spot.width / 2;
  const centreY = spot.top + spot.height / 2;
  switch (side) {
    case "right":
      return {
        top: clampY(centreY - card.height / 2),
        left: spot.left + spot.width + CARD_GAP,
        width,
      };
    case "left":
      return { top: clampY(centreY - card.height / 2), left: spot.left - CARD_GAP - width, width };
    case "below":
      return {
        top: spot.top + spot.height + CARD_GAP,
        left: clampX(centreX - width / 2, width),
        width,
      };
    case "above":
      return {
        top: spot.top - CARD_GAP - card.height,
        left: clampX(centreX - width / 2, width),
        width,
      };
    default:
      // Nothing fits beside it (huge target, small screen): sit at the bottom.
      return { top: clampY(vh - SCREEN_MARGIN - card.height), left: (vw - width) / 2, width };
  }
}

/**
 * A guided walkthrough of the encounter screen. It dims the ward, rings the
 * part of the HUD being described and narrates it from Dr. Ambrose in a card
 * beside it. The tour blocks clicks on the HUD (so nothing is triggered by
 * accident); the only state it changes is through `controls` — taking over the
 * case on the handover step and showing an action tray as an example.
 */
export function CaseTour({
  open,
  context,
  controls,
  onClose,
}: {
  open: boolean;
  context: Omit<TourContext, "compact">;
  controls: TourControls;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ width: CARD_MAX_WIDTH, height: 260 });
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const desktop = useIsDesktop();

  const ctx: TourContext = { ...context, compact: !desktop };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const steps = CASE_TOUR_STEPS;
  const step: TourStep = steps[Math.min(index, steps.length - 1)]!;
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Every opening starts from the beginning.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Step side effects (e.g. showing an action tray), undone on leaving.
  useEffect(() => {
    if (!open) return;
    step.onEnter?.(controlsRef.current);
    return () => step.onLeave?.(controlsRef.current);
  }, [open, step]);

  // Track the spotlit element every frame: trays animate in, panels scroll and
  // the layout reflows with the viewport, and the ring should follow all of it.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    // `undefined` = nothing published yet for this step, so the first frame
    // always replaces the previous step's spotlight (even with "no target").
    let last: Rect | null | undefined;
    let scrolledFor: HTMLElement | null = null;
    const tick = () => {
      const ids = step.targets?.(ctxRef.current) ?? [];
      const element = ids.length ? findTarget(ids) : null;
      if (element && scrolledFor !== element) {
        // Bring targets inside scrolling panels (e.g. the case tools on a short
        // screen) into view once per step.
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
        scrolledFor = element;
      }
      let next: Rect | null = null;
      if (element) {
        const box = element.getBoundingClientRect();
        // Keep the ring on screen for panels that hug the viewport edges.
        const inset = 8;
        const top = Math.max(inset, box.top - SPOT_PADDING);
        const left = Math.max(inset, box.left - SPOT_PADDING);
        const bottom = Math.min(window.innerHeight - inset, box.bottom + SPOT_PADDING);
        const right = Math.min(window.innerWidth - inset, box.right + SPOT_PADDING);
        next = { top, left, width: right - left, height: bottom - top };
      }
      if (last === undefined || !sameRect(last, next)) {
        last = next;
        setSpot(next);
      }
      setViewport((current) =>
        current.width === window.innerWidth && current.height === window.innerHeight
          ? current
          : { width: window.innerWidth, height: window.innerHeight },
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [open, step]);

  // Measure the card so it can be placed without overlapping the spotlight.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = card;
      setCardSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [open, index]);

  // Keyboard users land on the main button of each step.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, index]);

  const finish = useCallback(
    (how: "done" | "skipped") => {
      markCaseTourSeen(how);
      onClose();
    },
    [onClose],
  );

  const primary = step.primary?.(ctx) ?? null;
  const goNext = useCallback(() => {
    if (primary) primary.run(controlsRef.current);
    if (isLast) finish("done");
    else setIndex((current) => current + 1);
  }, [primary, isLast, finish]);
  const goBack = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish("skipped");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.key === "Tab") {
        // Keep focus inside the card while the tour is up.
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
        if (!focusable?.length) return;
        const first = focusable[0]!;
        const lastButton = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !cardRef.current?.contains(active))) {
          event.preventDefault();
          lastButton.focus();
        } else if (
          !event.shiftKey &&
          (active === lastButton || !cardRef.current?.contains(active))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, goNext, goBack, finish]);

  if (!open) return null;

  const placement = placeCard(spot, cardSize, viewport);
  const progress = ((index + 1) / steps.length) * 100;
  const nextLabel = primary?.label ?? (isFirst ? "Show me around" : isLast ? "Got it" : "Next");
  const titleId = `case-tour-title-${step.id}`;
  const bodyId = `case-tour-body-${step.id}`;

  return (
    <div className="case-tour">
      {/* Swallows clicks so nothing on the HUD is triggered mid-tour. */}
      <div className="case-tour-blocker" data-dim={spot ? "false" : "true"} aria-hidden="true" />
      {spot && (
        <div
          className="case-tour-spotlight"
          aria-hidden="true"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="case-tour-card"
        style={{ top: placement.top, left: placement.left, width: placement.width }}
      >
        <div className="flex items-center gap-3">
          <DrAmbrose
            expression={step.expression ?? "neutral"}
            variant="logo"
            className="-my-1 w-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--hud-brand)]">
              {isFirst ? "Case tour" : `Step ${index} of ${steps.length - 1}`}
            </p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--hud-lavender)]"
              role="progressbar"
              aria-label="Tour progress"
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={index + 1}
            >
              <div
                className="case-tour-progress h-full rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => finish("skipped")}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--hud-muted)] transition-colors hover:bg-[var(--hud-lavender)] hover:text-[var(--hud-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hud-brand)]"
            aria-label="Close the tour"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2
          id={titleId}
          className="mt-3 font-display text-lg font-black leading-tight text-[var(--hud-navy)]"
        >
          {step.title}
        </h2>
        <div id={bodyId} className="mt-2 space-y-2">
          {step.body(ctx).map((paragraph) => (
            <p key={paragraph} className="text-[13px] font-semibold leading-relaxed text-slate-600">
              {renderCopy(paragraph)}
            </p>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {isFirst ? (
            <button
              type="button"
              onClick={() => finish("skipped")}
              className="rounded-full px-2 py-2 text-xs font-black text-[var(--hud-muted)] hover:text-[var(--hud-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hud-brand)]"
            >
              Skip tour
            </button>
          ) : (
            <BackButton onClick={goBack} />
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={goNext}
            className="case-primary-button px-4 py-2.5 text-sm"
          >
            {nextLabel}
            {!isLast && <ArrowRight className="size-4" />}
          </button>
        </div>
        {isFirst && (
          <p className="mt-3 text-[11px] font-bold leading-snug text-[var(--hud-muted)]">
            {desktop ? "Tip: the ← and → keys move through the tour. " : ""}You can replay it any
            time from the Tour button at the top of the screen.
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {step.title}
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-xs font-black text-[var(--hud-muted)] hover:text-[var(--hud-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hud-brand)]"
    >
      <ArrowLeft className="size-3.5" /> Back
    </button>
  );
}

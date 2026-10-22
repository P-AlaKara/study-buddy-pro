import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Flag,
  HeartPulse,
  Lightbulb,
  ListChecks,
  Maximize2,
  Minimize2,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import type { GameState, TimelineEvent, TimelineEventType } from "../engine.js";
import type { CaseAction, MedicalCase } from "../schema.js";
import { actionCategoryLabel, categoryMeta } from "./case-constants.js";
import { ActionResultEntry, TypingDots } from "./case-ui.js";

/**
 * Visual treatment for each system (non-action, non-hook) event in the unified
 * timeline. `detail: false` keeps an entry compact when its text is already
 * shown by the adjacent action card (clues), avoiding duplication while still
 * surfacing the event. Action and hook events get bespoke rendering below.
 */
const systemEventStyle: Partial<
  Record<
    TimelineEventType,
    { icon: ComponentType<{ className?: string }>; rail: string; tint: string; detail: boolean }
  >
> = {
  clue: { icon: Sparkles, rail: "var(--case-mint)", tint: "var(--case-mint-soft)", detail: false },
  deterioration: {
    icon: AlertTriangle,
    rail: "var(--case-critical)",
    tint: "var(--case-critical-soft)",
    detail: true,
  },
  warning: {
    icon: AlertTriangle,
    rail: "var(--case-orange)",
    tint: "var(--case-orange-soft)",
    detail: true,
  },
  hint: {
    icon: Lightbulb,
    rail: "var(--case-yellow)",
    tint: "var(--case-yellow-soft)",
    detail: true,
  },
  differential: {
    icon: ListChecks,
    rail: "var(--case-blue)",
    tint: "var(--case-blue-soft)",
    detail: true,
  },
  commit: { icon: Flag, rail: "var(--case-accent)", tint: "var(--case-accent-soft)", detail: true },
  outcome: {
    icon: CheckCircle2,
    rail: "var(--case-accent)",
    tint: "var(--case-accent-soft)",
    detail: true,
  },
};

export function InteractionHistory({
  caseDefinition,
  game,
  actionById,
  typingAction,
  onStart,
  expanded,
  onToggleExpand,
  className = "",
}: {
  caseDefinition: MedicalCase;
  game: GameState;
  actionById: Map<string, CaseAction>;
  typingAction: CaseAction | undefined;
  onStart: () => void;
  expanded?: boolean | undefined;
  onToggleExpand?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [followingLatest, setFollowingLatest] = useState(true);

  // The complete, chronological encounter log — every event the engine records,
  // never filtered by clinical stage.
  const events = game.timeline;

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior });
    setFollowingLatest(true);
  }

  // Auto-scroll only when the reader is already near the bottom; otherwise their
  // position is preserved and a "jump to latest" affordance appears.
  useEffect(() => {
    if (!followingLatest) return;
    const frame = requestAnimationFrame(() => scrollToLatest("smooth"));
    return () => cancelAnimationFrame(frame);
  }, [game.timeline.length, typingAction?.id, followingLatest]);

  return (
    <section
      className={`case-panel case-history-panel ${className}`}
      aria-label="Patient interaction history"
    >
      <header className="flex items-center gap-3 border-b border-[var(--case-border)] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]">
          <HeartPulse className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black leading-tight text-slate-900">Interaction history</h2>
          <p className="text-[10px] font-bold text-slate-500">
            {game.phase === "hook" ? "Handover" : "Complete encounter log"} · {events.length} events
          </p>
        </div>
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="hidden size-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] xl:grid"
            aria-label={expanded ? "Retract history panel" : "Enlarge history panel"}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="case-history-scroll h-full overflow-y-auto px-3 py-4 sm:px-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chronological clinical interaction"
          onScroll={(event) => {
            const target = event.currentTarget;
            const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
            setFollowingLatest(distanceFromBottom < 56);
          }}
        >
          <ol className="space-y-3">
            {events.map((event) => (
              <HistoryEntry
                key={event.id}
                event={event}
                caseDefinition={caseDefinition}
                game={game}
                actionById={actionById}
                onStart={onStart}
              />
            ))}

            {game.phase === "investigate" &&
              game.completedActions.length === 0 &&
              !typingAction && (
                <li className="py-3 text-center text-sm font-bold text-slate-500">
                  Choose an action to begin your assessment.
                </li>
              )}

            {typingAction && (
              <li className="case-history-entry space-y-2.5">
                <StudentBubble action={typingAction} />
                <article className="mr-auto flex max-w-[92%] items-center gap-3 rounded-[18px] rounded-bl-md bg-[var(--case-blue-soft)] px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[var(--case-blue-ink)] shadow-sm">
                    <UserRound className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--case-blue-ink)]">
                      Patient · {caseDefinition.patient.name}
                    </p>
                    <TypingDots className="mt-2" />
                  </div>
                </article>
              </li>
            )}
          </ol>
        </div>

        {!followingLatest && (
          <button
            type="button"
            onClick={() => scrollToLatest()}
            className="absolute bottom-3 right-3 rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)]"
          >
            Jump to latest <ChevronDown className="ml-1 inline size-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}

function StudentBubble({ action }: { action: CaseAction }) {
  const MetaIcon = categoryMeta[action.category].icon;
  return (
    <article className="ml-auto max-w-[92%] rounded-[18px] rounded-br-md bg-slate-900 px-4 py-3 text-white">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
        <MetaIcon className="size-3.5" /> You · {actionCategoryLabel(action.category)}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-relaxed">{action.label}</p>
    </article>
  );
}

function HistoryEntry({
  event,
  caseDefinition,
  game,
  actionById,
  onStart,
}: {
  event: TimelineEvent;
  caseDefinition: MedicalCase;
  game: GameState;
  actionById: Map<string, CaseAction>;
  onStart: () => void;
}) {
  if (event.type === "hook") {
    return (
      <li className="case-history-entry">
        <article className="rounded-[20px] border border-[var(--case-border)] bg-[var(--case-accent-soft)]/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--case-accent-ink)]">
              <HeartPulse className="size-4" /> Opening presentation
            </span>
            <time className="font-mono text-[10px] font-bold text-slate-400">
              +{event.timeMinute}m
            </time>
          </div>
          <p className="mt-2.5 text-sm font-bold leading-relaxed text-slate-800">{event.detail}</p>
          {game.phase === "hook" && (
            <button
              type="button"
              onClick={onStart}
              className="case-primary-button mt-4 px-5 py-2.5 text-sm"
            >
              Take over the case <ArrowRight className="size-4" />
            </button>
          )}
        </article>
      </li>
    );
  }

  if (event.type === "case_started") {
    return (
      <li className="case-history-entry flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-[var(--case-border)]" />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Encounter started · +{event.timeMinute}m
        </span>
        <span className="h-px flex-1 bg-[var(--case-border)]" />
      </li>
    );
  }

  if (event.type === "action" && event.actionId) {
    const action = actionById.get(event.actionId);
    if (!action) return null;
    return (
      <li className="case-history-entry space-y-2.5">
        <StudentBubble action={action} />
        <ActionResultEntry action={action} caseDefinition={caseDefinition} />
      </li>
    );
  }

  const style = systemEventStyle[event.type];
  if (!style) return null;
  const Icon = style.icon;
  const isLost = event.type === "outcome" && /lost|missed/i.test(event.title);
  const OutcomeIcon = event.type === "outcome" ? (isLost ? XCircle : CheckCircle2) : Icon;
  const rail = event.type === "outcome" && isLost ? "var(--case-critical)" : style.rail;
  const tint = event.type === "outcome" && isLost ? "var(--case-critical-soft)" : style.tint;

  return (
    <li className="case-history-entry">
      <article
        className="case-event-rail flex gap-2.5 rounded-r-[14px] rounded-l-md py-2 pl-3 pr-3"
        style={{ "--rail": rail, backgroundColor: tint } as CSSProperties}
      >
        <span
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-white/70"
          style={{ color: rail }}
        >
          <OutcomeIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-800">{event.title}</p>
            <time className="shrink-0 font-mono text-[10px] text-slate-400">
              +{event.timeMinute}m
            </time>
          </div>
          {style.detail && event.detail && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{event.detail}</p>
          )}
          {event.type === "clue" && (
            <p className="mt-0.5 text-[10px] font-bold text-[var(--case-mint-ink)]">
              Logged to patient chart
            </p>
          )}
        </div>
      </article>
    </li>
  );
}

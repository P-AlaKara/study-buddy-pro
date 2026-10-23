import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Flag,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Maximize2,
  MessageCircleMore,
  Minimize2,
  Sparkles,
  Stethoscope,
  Syringe,
  XCircle,
} from "lucide-react";
import type { GameState, TimelineEvent } from "../engine.js";
import type { ActionCategory, CaseAction, MedicalCase } from "../schema.js";
import { CaseImageViewer } from "./case-image-viewer.js";
import { TypingDots } from "./case-ui.js";
import { formatEncounterClock } from "./patient-media.js";

/** One node on the vertical encounter timeline. */
function TimelineNode({
  color,
  icon: Icon,
  label,
  time,
  children,
}: {
  color: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  time: string;
  children: ReactNode;
}) {
  return (
    <li className="case-tl-node" style={{ "--dot": color } as CSSProperties}>
      <span className="case-tl-dot" aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="truncate text-[10px] font-black uppercase tracking-[0.12em]"
            style={{ color }}
          >
            {label}
          </p>
          <time className="shrink-0 font-mono text-[10px] font-bold text-slate-400">{time}</time>
        </div>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

const YOU_META: Record<
  ActionCategory,
  { label: string; color: string; icon: ComponentType<{ className?: string }> }
> = {
  ask: { label: "You – history question", color: "var(--case-blue)", icon: HelpCircle },
  examine: { label: "You – examination", color: "var(--case-mint)", icon: Stethoscope },
  test: { label: "You – investigation", color: "var(--case-blue)", icon: FlaskConical },
  treat: { label: "You – management", color: "var(--case-pink)", icon: Syringe },
};

/** Soft-tinted bubble for a patient utterance. */
function PatientBubble({ text }: { text: string }) {
  return (
    <p className="rounded-2xl rounded-tl-md bg-[var(--case-accent-soft)] px-3.5 py-2.5 text-[13px] font-bold leading-relaxed text-slate-700">
      “{text}”
    </p>
  );
}

/** Neutral card body for an examination / investigation / treatment result. */
function ResultBody({
  action,
  caseDefinition,
}: {
  action: CaseAction;
  caseDefinition: MedicalCase;
}) {
  const asset = action.result.assetId
    ? caseDefinition.assets.find((candidate) => candidate.id === action.result.assetId)
    : undefined;
  const leadLabel =
    action.category === "examine" ? "Findings" : action.category === "test" ? "Result" : "Response";

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold leading-relaxed text-slate-700">
        <span className="font-black text-slate-900">{leadLabel}:</span> {action.result.content}
      </p>

      {action.result.type === "lab_table" && action.result.labs && (
        <div className="overflow-x-auto rounded-xl border border-[var(--case-border)]">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {action.result.labs.map((lab) => (
                <tr key={lab.test} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">{lab.test}</td>
                  <td
                    className={`px-3 py-2 font-mono font-black ${
                      lab.flag && lab.flag !== "normal"
                        ? "text-[var(--case-critical)]"
                        : "text-slate-700"
                    }`}
                  >
                    {lab.result}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{lab.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {asset && (action.result.type === "image" || action.result.type === "ecg") && (
        <div className="overflow-hidden rounded-xl">
          <CaseImageViewer
            asset={asset}
            assetPath={`/cases/${caseDefinition.slug}/${asset.filename}`}
            result={action.result}
          />
        </div>
      )}
    </div>
  );
}

const SYSTEM_META: Partial<
  Record<
    TimelineEvent["type"],
    { label: string; color: string; icon: ComponentType<{ className?: string }> }
  >
> = {
  clue: { label: "Finding logged", color: "var(--case-mint)", icon: Sparkles },
  deterioration: { label: "Deterioration", color: "var(--case-critical)", icon: AlertTriangle },
  warning: { label: "Warning", color: "var(--case-orange)", icon: AlertTriangle },
  hint: { label: "Hint", color: "var(--case-yellow)", icon: Lightbulb },
  differential: { label: "Differential", color: "var(--case-blue)", icon: ListChecks },
  commit: { label: "Diagnosis committed", color: "var(--case-accent)", icon: Flag },
  outcome: { label: "Outcome", color: "var(--case-accent)", icon: CheckCircle2 },
};

/** Expand a single engine event into one or more timeline nodes. */
function nodesForEvent(
  event: TimelineEvent,
  caseDefinition: MedicalCase,
  game: GameState,
  actionById: Map<string, CaseAction>,
  onStart: () => void,
): ReactNode[] {
  const time = formatEncounterClock(caseDefinition.setting, event.timeMinute);

  if (event.type === "hook") {
    return [
      <TimelineNode
        key={event.id}
        color="var(--case-accent)"
        icon={HeartPulse}
        label="Opening presentation"
        time={time}
      >
        <p className="rounded-2xl rounded-tl-md bg-[var(--case-accent-soft)] px-3.5 py-2.5 text-[13px] font-bold leading-relaxed text-slate-800">
          {event.detail}
        </p>
      </TimelineNode>,
    ];
  }

  if (event.type === "case_started") {
    return [
      <li key={event.id} className="case-tl-divider">
        <span>Encounter started · {time}</span>
      </li>,
    ];
  }

  if (event.type === "action" && event.actionId) {
    const action = actionById.get(event.actionId);
    if (!action) return [];
    const you = YOU_META[action.category];
    const isReply = action.result.type === "patient_reply";
    const resultColor = isReply
      ? "var(--case-accent)"
      : action.category === "examine"
        ? "var(--case-mint)"
        : action.category === "test"
          ? "var(--case-blue)"
          : "var(--case-pink)";
    const resultLabel = isReply
      ? "Patient response"
      : action.category === "examine"
        ? "Examination findings"
        : action.category === "test"
          ? "Investigation result"
          : "Treatment response";
    const resultIcon = isReply
      ? MessageCircleMore
      : action.category === "examine"
        ? Stethoscope
        : action.category === "test"
          ? FlaskConical
          : Syringe;

    return [
      <TimelineNode key={`${event.id}-you`} color={you.color} icon={you.icon} label={you.label} time={time}>
        <p className="text-[13px] font-bold leading-relaxed text-slate-700">{action.label}</p>
      </TimelineNode>,
      <TimelineNode
        key={`${event.id}-result`}
        color={resultColor}
        icon={resultIcon}
        label={resultLabel}
        time={time}
      >
        {isReply ? (
          <PatientBubble text={action.result.content} />
        ) : (
          <ResultBody action={action} caseDefinition={caseDefinition} />
        )}
      </TimelineNode>,
    ];
  }

  const meta = SYSTEM_META[event.type];
  if (!meta) return [];
  const isLost = event.type === "outcome" && /lost|missed/i.test(event.title);
  const color = isLost ? "var(--case-critical)" : meta.color;
  const Icon = isLost ? XCircle : meta.icon;

  return [
    <TimelineNode key={event.id} color={color} icon={Icon} label={meta.label} time={time}>
      <p className="text-[13px] font-black leading-snug text-slate-800">{event.title}</p>
      {event.detail && (
        <p className="mt-0.5 text-[12px] font-bold leading-relaxed text-slate-600">{event.detail}</p>
      )}
      {event.type === "clue" && (
        <p className="mt-0.5 text-[10px] font-black text-[var(--case-mint-ink)]">
          Logged to patient chart
        </p>
      )}
    </TimelineNode>,
  ];
}

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
  const nodes = events.flatMap((event) =>
    nodesForEvent(event, caseDefinition, game, actionById, onStart),
  );

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
          className="case-history-scroll h-full overflow-y-auto px-4 py-4"
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
          <ol className="case-tl">
            {nodes}

            {game.phase === "investigate" &&
              game.completedActions.length === 0 &&
              !typingAction && (
                <li className="py-3 text-center text-sm font-bold text-slate-500">
                  Choose an action to begin your assessment.
                </li>
              )}

            {typingAction && (
              <TimelineNode
                color="var(--case-accent)"
                icon={MessageCircleMore}
                label="Patient response"
                time={formatEncounterClock(caseDefinition.setting, game.timeMinute)}
              >
                <span className="inline-flex rounded-2xl rounded-tl-md bg-[var(--case-accent-soft)] px-3.5 py-3">
                  <TypingDots />
                </span>
              </TimelineNode>
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

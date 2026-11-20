import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Clock3,
  GitBranch,
  HeartCrack,
  MousePointerClick,
  OctagonX,
  Play,
  Plus,
  RotateCcw,
  Siren,
  Trash2,
  TrendingDown,
  Trophy,
  X,
} from "lucide-react";
import type { RuntimeVitals } from "@/features/case-challenge/engine";
import type { DeteriorationRule, MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import {
  actionLabel,
  compareSnapshots,
  describeCondition,
  initialVitals,
  listText,
  ruleTitle,
  simulateSequence,
  untreatedCourse,
  type SequenceStep,
} from "../../case-analysis";
import { ALERT_SOURCE_META, CATEGORY_META, VITAL_META } from "../../vocabulary";
import { DeltaChips, VitalsGrid } from "../clinical-display";
import {
  Button,
  Callout,
  NumberInput,
  Panel,
  PanelHeading,
  SubHeading,
  Tag,
  VisibilityTag,
} from "../studio-ui";
import { VitalsSmallMultiples, type ChartMarker, type ChartPoint } from "../vitals-chart";
import { useWorkspace } from "../workspace-context";
import { EditButton } from "../edit-button";

const KIND = {
  time: {
    label: "Time-triggered",
    icon: <Clock3 aria-hidden className="size-3.5" />,
    tone: "warn" as const,
  },
  action: {
    label: "Student action",
    icon: <MousePointerClick aria-hidden className="size-3.5" />,
    tone: "info" as const,
  },
  state: {
    label: "Depends on patient state",
    icon: <GitBranch aria-hidden className="size-3.5" />,
    tone: "accent" as const,
  },
  end: {
    label: "Case ends",
    icon: <OctagonX aria-hidden className="size-3.5" />,
    tone: "dark" as const,
  },
};

function KindTag({ kind }: { kind: keyof typeof KIND }) {
  return (
    <Tag tone={KIND[kind].tone} icon={KIND[kind].icon}>
      {KIND[kind].label}
    </Tag>
  );
}

function RailItem({
  minute,
  tone = "default",
  children,
  id,
}: {
  minute: string;
  tone?: "default" | "danger" | "start";
  children: ReactNode;
  id?: string;
}) {
  return (
    <li id={id} className="studio-anchor relative scroll-mt-28 pl-16 sm:pl-20">
      <span
        className={cn(
          "absolute left-0 top-1 inline-flex min-w-12 items-center justify-center rounded-full px-2 py-1 text-xs font-black tabular-nums sm:min-w-14",
          tone === "danger"
            ? "bg-[#b42323] text-white"
            : tone === "start"
              ? "bg-[#5a44b5] text-white"
              : "bg-[#2b2540] text-white",
        )}
      >
        {minute}
      </span>
      {children}
    </li>
  );
}

export function ReviewTimelineStage({
  definition,
  readOnly = false,
}: {
  definition: MedicalCase;
  readOnly?: boolean;
}) {
  const { jump } = useWorkspace();
  const start = initialVitals(definition);
  const course = useMemo(() => untreatedCourse(definition), [definition]);
  const comparisons = useMemo(() => compareSnapshots(definition, course), [definition, course]);
  const rules = [...definition.deteriorationRules].sort((a, b) => a.ifNotDoneBy - b.ifNotDoneBy);
  const lossRules = rules
    .filter((rule) => rule.lossAtMinute !== undefined)
    .sort((a, b) => (a.lossAtMinute ?? 0) - (b.lossAtMinute ?? 0));
  const minutes = [...new Set(rules.map((rule) => rule.ifNotDoneBy))].sort((a, b) => a - b);
  const effectActions = definition.actions.filter(
    (action) => action.vitalsEffect || action.variants?.some((variant) => variant.vitalsEffect),
  );
  const fatalActions = definition.actions.filter((action) => action.immediateFailure);
  const stateActions = definition.actions.filter((action) => action.variants?.length);

  const chartPoints: ChartPoint[] =
    course?.points.map(({ minute, vitals }) => ({ minute, vitals })) ?? [];
  const markers: ChartMarker[] = [
    ...minutes.map((minute) => ({ minute, label: "Deterioration", kind: "event" as const })),
    ...(course?.lostAt != null
      ? [{ minute: course.lostAt, label: "Patient lost", kind: "lost" as const }]
      : []),
  ];
  const endMinute = Math.max(
    course?.lostAt ?? 0,
    ...rules.map((rule) => rule.lossAtMinute ?? rule.ifNotDoneBy),
    10,
  );

  const vitalsBefore = (minute: number): RuntimeVitals | null => {
    if (!course) return null;
    let previous: RuntimeVitals | null = null;
    for (const point of course.points) if (point.minute < minute) previous = point.vitals;
    return previous;
  };
  const vitalsAt = (minute: number) =>
    course?.points.find((point) => point.minute === minute)?.vitals ?? null;

  const changedAfter = (rule: DeteriorationRule) =>
    definition.actions.filter((action) =>
      action.variants?.some((variant) => variant.when.afterDeterioration?.includes(rule.id)),
    );

  const goToAction = (id: string) => {
    const action = definition.actions.find((item) => item.id === id);
    if (!action) return;
    const step =
      action.category === "ask"
        ? "history"
        : action.category === "examine"
          ? "examination"
          : action.category === "test"
            ? "tests"
            : "treatment";
    jump({ step, actionId: id });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel>
          <PanelHeading
            title="Patient timeline"
            description="How this patient changes over simulated time. The simulator only changes observations at the moments below; between them the patient is stable."
          />
          <div className="flex flex-wrap gap-2">
            <KindTag kind="time" />
            <KindTag kind="action" />
            <KindTag kind="state" />
            <KindTag kind="end" />
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeading
          level={3}
          title="If the student does nothing"
          description={
            course?.lostAt != null
              ? `Without the time-critical actions the patient deteriorates ${minutes.length === 1 ? `at minute ${minutes[0]}` : `at minutes ${minutes.join(", ")}`} and is lost at minute ${course.lostAt}.`
              : rules.length
                ? `Without the time-critical actions the patient deteriorates at minute${minutes.length === 1 ? "" : "s"} ${minutes.join(", ")} but is never lost from delay alone.`
                : "No deterioration events are defined, so the patient stays as they arrived."
          }
          aside={<Tag tone="neutral">Calculated by the simulator</Tag>}
        />
        {course ? (
          <VitalsSmallMultiples points={chartPoints} markers={markers} endMinute={endMinute} />
        ) : (
          <Callout tone="warn" title="The course can't be calculated yet">
            Check the arrival observations (blood pressure must look like 120/80).
          </Callout>
        )}
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Timeline of events"
          description="Each event fires only if its preventing action has not been completed by that minute."
          aside={
            readOnly ? undefined : (
              <EditButton
                target={{ step: "progression", anchor: "studio-rules" }}
                label="Add or change events"
              />
            )
          }
        />
        <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-6 before:top-2 before:w-0.5 before:bg-[#ddd6ee] sm:before:left-7">
          <RailItem minute="0 min" tone="start">
            <div className="rounded-2xl bg-lavender-soft/60 p-4">
              <p className="font-extrabold">Arrival</p>
              <p className="mb-3 text-sm text-muted-foreground">{definition.setting}</p>
              {start && <VitalsGrid vitals={start} compact />}
            </div>
          </RailItem>
          {minutes.map((minute) => {
            const atMinute = rules.filter((rule) => rule.ifNotDoneBy === minute);
            const before = vitalsBefore(minute);
            const after = vitalsAt(minute);
            return (
              <RailItem key={`m-${minute}`} minute={`${minute} min`}>
                <div className="space-y-3">
                  {atMinute.map((rule) => (
                    <article
                      key={rule.id}
                      id={`studio-rule-${rule.id}`}
                      className="studio-anchor scroll-mt-28 rounded-2xl bg-card p-4 ring-1 ring-[#ead79a]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <KindTag kind="time" />
                        {!readOnly && (
                          <span className="ml-auto">
                            <EditButton
                              target={{ step: "progression", anchor: `studio-rule-${rule.id}` }}
                              label="Edit this event"
                            />
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-[15px] font-extrabold leading-snug">
                        If “{actionLabel(definition, rule.action)}” has not been done by minute{" "}
                        {minute}
                      </p>
                      <blockquote className="mt-2 flex items-start gap-2 rounded-xl bg-yellow-soft px-3 py-2 text-sm">
                        <Siren aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <span>
                          <span className="font-extrabold">
                            {ALERT_SOURCE_META[rule.source].label}:
                          </span>{" "}
                          {rule.alertLine || <em>no alert written</em>}
                        </span>
                      </blockquote>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-bold">Observations change by</span>
                        <DeltaChips delta={rule.effect} empty="nothing" />
                      </div>
                      {rule.lossAtMinute !== undefined && (
                        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-extrabold text-[#8f2424]">
                          <HeartCrack aria-hidden className="size-4" /> If still not done by minute{" "}
                          {rule.lossAtMinute}, the patient is lost.
                        </p>
                      )}
                      {changedAfter(rule).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-bold">
                            <GitBranch aria-hidden className="size-4 text-[#5a44b5]" /> After this,
                            these responses change:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {changedAfter(rule).map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                onClick={() => goToAction(action.id)}
                                className="rounded-full bg-lavender-soft px-2.5 py-1 text-xs font-extrabold text-[#4a3799] hover:bg-[#e3dbf7]"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                  {before && after && (
                    <div>
                      <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">
                        Untreated patient at minute {minute}, compared with before:
                      </p>
                      <VitalsGrid vitals={after} before={before} compact />
                    </div>
                  )}
                </div>
              </RailItem>
            );
          })}
          {lossRules.map((rule) => (
            <RailItem key={`loss-${rule.id}`} minute={`${rule.lossAtMinute} min`} tone="danger">
              <div className="rounded-2xl bg-[#2b2540] p-4 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag
                    tone="dark"
                    className="bg-white/15"
                    icon={<OctagonX aria-hidden className="size-3.5" />}
                  >
                    Patient lost
                  </Tag>
                </div>
                <p className="mt-2 text-[15px] font-extrabold">
                  “{actionLabel(definition, rule.action)}” still not done
                </p>
                <p className="mt-1 text-sm text-white/75">
                  The case ends with the patient lost. Students see: “The critical action “
                  {actionLabel(definition, rule.action)}” was not completed in time.”
                </p>
              </div>
            </RailItem>
          ))}
        </ol>
        {!rules.length && (
          <Callout tone="info" className="mt-4">
            This case has no time-critical events.
          </Callout>
        )}
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Changes caused by student actions"
          description="Applied the moment the action is completed. Alternatives replace the usual effect when their condition holds."
        />
        {effectActions.length === 0 && fatalActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No action changes the observations or ends the case.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {effectActions.map((action) => (
              <li key={action.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex flex-wrap items-center gap-2">
                  <KindTag kind="action" />
                  <Tag>{CATEGORY_META[action.category].noun}</Tag>
                </div>
                <button
                  type="button"
                  onClick={() => goToAction(action.id)}
                  className="mt-2 block text-left text-[15px] font-extrabold underline-offset-2 hover:underline"
                >
                  {action.label}
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-bold">Usually:</span>
                  <DeltaChips delta={action.vitalsEffect} empty="no change" />
                </div>
                {action.variants
                  ?.filter((variant) => variant.vitalsEffect)
                  .map((variant, index) => (
                    <div key={index} className="mt-2 text-[13px]">
                      <span className="font-bold">
                        When {describeCondition(definition, variant.when).join(", and ")}:
                      </span>{" "}
                      <DeltaChips delta={variant.vitalsEffect} empty="no change" />
                    </div>
                  ))}
              </li>
            ))}
            {fatalActions.map((action) => (
              <li key={action.id} className="rounded-2xl bg-[#2b2540] p-4 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag
                    tone="dark"
                    className="bg-white/15"
                    icon={<OctagonX aria-hidden className="size-3.5" />}
                  >
                    Ends the case
                  </Tag>
                </div>
                <button
                  type="button"
                  onClick={() => goToAction(action.id)}
                  className="mt-2 block text-left text-[15px] font-extrabold underline-offset-2 hover:underline"
                >
                  {action.label}
                </button>
                <p className="mt-1 text-sm text-white/75">
                  The patient is lost as soon as this is done
                  {action.category === "treat" ? " or included in the final plan" : ""}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {stateActions.length > 0 && (
        <Panel>
          <PanelHeading
            level={3}
            title="Responses that depend on the patient's state"
            description="These actions answer differently depending on what has happened so far. Open each one in its step to compare the versions."
          />
          <ul className="divide-y divide-border">
            {stateActions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-start gap-3 py-3">
                <KindTag kind="state" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => goToAction(action.id)}
                    className="text-left text-sm font-extrabold underline-offset-2 hover:underline"
                  >
                    {action.label}
                  </button>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted-foreground">
                    {action.variants!.map((variant, index) => (
                      <li key={index}>
                        When {describeCondition(definition, variant.when).join(", and ")}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeading level={3} title="How the case can end" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-mint-soft p-4">
            <p className="flex items-center gap-2 font-extrabold text-[#0b4f4c]">
              <Trophy aria-hidden className="size-4" /> Diagnosis made
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              The student commits to{" "}
              {listText([
                definition.differential.find((item) => item.isCorrect)?.label ??
                  "the correct diagnosis",
              ])}{" "}
              with a treatment plan that does not end the case.
            </p>
          </div>
          <div className="rounded-2xl bg-yellow-soft p-4">
            <p className="flex items-center gap-2 font-extrabold text-[#5c4300]">
              <TrendingDown aria-hidden className="size-4" /> Diagnosis missed
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              The student commits to any other diagnosis (costs{" "}
              {Math.abs(definition.scoring.incorrectDiagnosisPenalty)} points).
            </p>
          </div>
          <div className="rounded-2xl bg-[#2b2540] p-4 text-white">
            <p className="flex items-center gap-2 font-extrabold">
              <HeartCrack aria-hidden className="size-4" /> Patient lost
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/85">
              {lossRules.map((rule) => (
                <li key={rule.id}>
                  “{actionLabel(definition, rule.action)}” not done by minute {rule.lossAtMinute}
                </li>
              ))}
              {fatalActions.map((action) => (
                <li key={action.id}>The student chooses “{action.label}”</li>
              ))}
              {!lossRules.length && !fatalActions.length && (
                <li>No way to lose the patient is defined.</li>
              )}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Students can only commit once they have ordered at least one test and put a diagnosis on
          their board.
        </p>
      </Panel>

      {comparisons.length > 0 && (
        <Panel>
          <PanelHeading
            level={3}
            title="Reference observations written by the author"
            description="Later observation sets are notes for reviewers only; the simulator calculates the course from the events above. Differences are worth a look."
            aside={<VisibilityTag visibility="reviewers" />}
          />
          <ul className="space-y-2">
            {comparisons.map((comparison) => (
              <li key={comparison.minute} className="rounded-2xl bg-muted/60 p-3 text-sm">
                <span className="font-extrabold">Minute {comparison.minute}: </span>
                {comparison.lostBefore
                  ? "the simulated patient has already been lost by then."
                  : comparison.differences.length
                    ? comparison.differences
                        .map(
                          (diff) =>
                            `${VITAL_META[diff.sign].short} written as ${diff.authored}, simulator gives ${diff.simulated}`,
                        )
                        .join("; ")
                    : "matches the simulated course."}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <TrajectoryExplorer definition={definition} />
    </div>
  );
}

/* ---- Explorer ------------------------------------------------------------- */

function TrajectoryExplorer({ definition }: { definition: MedicalCase }) {
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [choice, setChoice] = useState("");
  const [wait, setWait] = useState<number | undefined>(5);
  const result = useMemo(() => simulateSequence(definition, steps), [definition, steps]);
  const start = result.start;
  const lastDeadline = Math.max(
    0,
    ...definition.deteriorationRules.map((rule) => rule.lossAtMinute ?? rule.ifNotDoneBy),
  );

  const points: ChartPoint[] = start
    ? [
        { minute: start.timeMinute, vitals: start.vitals },
        ...result.frames
          .filter((frame) => !frame.error)
          .map((frame) => ({ minute: frame.minute, vitals: frame.vitals })),
      ]
    : [];
  const markers: ChartMarker[] = result.frames.flatMap((frame) =>
    frame.events
      .filter((event) => event.type === "deterioration" || event.type === "outcome")
      .map((event) => ({
        minute: event.timeMinute,
        label: event.title,
        kind: event.type === "outcome" ? ("lost" as const) : ("event" as const),
      })),
  );

  const categories = (["ask", "examine", "test", "treat"] as const).map((category) => ({
    category,
    actions: definition.actions.filter((action) => action.category === category),
  }));

  return (
    <Panel>
      <PanelHeading
        level={3}
        title="Try a sequence"
        description="Play any order of actions through the simulator to see the patient's trajectory, alerts and score. There is no single right order; use this to test the paths you expect students to take."
        aside={<Tag tone="neutral">Uses the real simulator</Tag>}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          tone="quiet"
          onClick={() => setSteps(lastDeadline ? [{ kind: "wait", minutes: lastDeadline }] : [])}
        >
          <Clock3 aria-hidden className="size-4" /> Do nothing until the last deadline
        </Button>
        <Button
          size="sm"
          tone="quiet"
          onClick={() =>
            setSteps(
              definition.solution.keyTreatment.map((id) => ({ kind: "action" as const, id })),
            )
          }
        >
          <Play aria-hidden className="size-4" /> Required treatments, in listed order
        </Button>
        <Button size="sm" tone="ghost" onClick={() => setSteps([])} disabled={!steps.length}>
          <RotateCcw aria-hidden className="size-4" /> Clear
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-wrap gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Action to add</span>
            <select
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"
            >
              <option value="">Choose an action to add…</option>
              {categories.map(({ category, actions }) => (
                <optgroup key={category} label={CATEGORY_META[category].plural}>
                  {actions.map((action) => (
                    <option
                      key={action.id}
                      value={action.id}
                      disabled={steps.some(
                        (step) => step.kind === "action" && step.id === action.id,
                      )}
                    >
                      {action.label || "Untitled"} ({action.timeCostMin} min)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            tone="primary"
            disabled={!choice}
            onClick={() => {
              setSteps((current) => [...current, { kind: "action", id: choice }]);
              setChoice("");
            }}
          >
            <Plus aria-hidden className="size-4" /> Add action
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <NumberInput
            value={wait}
            onChange={setWait}
            min={1}
            suffix="min"
            ariaLabel="Minutes to wait"
            className="w-28"
          />
          <Button
            size="sm"
            disabled={!wait || wait <= 0}
            onClick={() =>
              wait && setSteps((current) => [...current, { kind: "wait", minutes: wait }])
            }
          >
            <Clock3 aria-hidden className="size-4" /> Add wait
          </Button>
        </div>
      </div>

      {steps.length > 0 && start && (
        <div className="mt-5 space-y-4">
          <VitalsSmallMultiples
            points={points}
            markers={markers}
            endMinute={Math.max(...points.map((point) => point.minute), 1)}
          />
          <ol className="space-y-2">
            {result.frames.map((frame, index) => {
              const previous = index === 0 ? start.vitals : result.frames[index - 1]!.vitals;
              const notable = frame.events.filter(
                (event) =>
                  ["deterioration", "warning", "outcome"].includes(event.type) &&
                  event.title !== "Waiting",
              );
              return (
                <li key={index} className="rounded-2xl bg-muted/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#2b2540] px-2 py-0.5 text-xs font-black text-white tabular-nums">
                      {frame.minute} min
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-extrabold">{frame.title}</span>
                    <Tag tone="neutral" icon={<Activity aria-hidden className="size-3.5" />}>
                      Score {frame.score}
                    </Tag>
                    <button
                      type="button"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                      className="grid size-8 place-items-center rounded-full hover:bg-card"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {frame.error ? (
                    <p className="mt-2 text-[13px] font-bold text-[#8f2424]">{frame.error}</p>
                  ) : (
                    <>
                      <VitalsGrid
                        vitals={frame.vitals}
                        before={previous}
                        compact
                        className="mt-2"
                      />
                      {notable.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {notable.map((event) => (
                            <li
                              key={event.id}
                              className={cn(
                                "flex items-start gap-2 rounded-xl px-3 py-1.5 text-[13px]",
                                event.type === "outcome"
                                  ? "bg-[#2b2540] text-white"
                                  : "bg-yellow-soft",
                              )}
                            >
                              {event.type === "outcome" ? (
                                <OctagonX aria-hidden className="mt-0.5 size-4 shrink-0" />
                              ) : (
                                <Siren aria-hidden className="mt-0.5 size-4 shrink-0" />
                              )}
                              <span>
                                <span className="font-extrabold">
                                  {event.timeMinute} min · {event.title}:
                                </span>{" "}
                                {event.detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Trash2 aria-hidden className="size-3.5" /> Nothing here is saved; it does not change
            the case.
          </p>
        </div>
      )}
    </Panel>
  );
}

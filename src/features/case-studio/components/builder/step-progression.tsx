import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  GitBranch,
  HeartCrack,
  MousePointerClick,
  Plus,
  Siren,
  Trash2,
} from "lucide-react";
import type {
  DeteriorationRule,
  MedicalCase,
  VitalsSnapshot,
} from "@/features/case-challenge/schema";
import { compareSnapshots, describeCondition, untreatedCourse } from "../../case-analysis";
import { addRule, renameRuleId, ruleReferences } from "../../case-edits";
import type { StudioCheck } from "../../issue-guide";
import {
  ALERT_SOURCE_META,
  BUILD_STEP_META,
  CATEGORY_META,
  CATEGORY_STEP,
  VITAL_META,
} from "../../vocabulary";
import { DeltaChips } from "../clinical-display";
import {
  Button,
  ChoiceCards,
  Disclosure,
  EmptyState,
  Field,
  NumberInput,
  Panel,
  PanelHeading,
  SelectInput,
  Tag,
  TextArea,
  TextInput,
  Toggle,
  useConfirm,
} from "../studio-ui";
import { VitalsSmallMultiples } from "../vitals-chart";
import { useWorkspace } from "../workspace-context";
import { AddRow, VitalsDeltaEditor } from "./small-editors";
import { VitalsSnapshotFields } from "./step-patient";

function omitKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function RuleEditor({
  definition,
  rule,
  index,
  checks,
  onChange,
  onRemove,
}: {
  definition: MedicalCase;
  rule: DeteriorationRule;
  index: number;
  checks: StudioCheck[];
  onChange: (next: MedicalCase) => void;
  onRemove: () => void;
}) {
  const [idDraft, setIdDraft] = useState(rule.id);
  useEffect(() => setIdDraft(rule.id), [rule.id]);
  const setRule = (next: DeteriorationRule) =>
    onChange({
      ...definition,
      deteriorationRules: definition.deteriorationRules.map((item, i) =>
        i === index ? next : item,
      ),
    });
  const set = (partial: Partial<DeteriorationRule>) => setRule({ ...rule, ...partial });
  const preventing = definition.actions.find((action) => action.id === rule.action);
  const takenIds = new Set(definition.deteriorationRules.map((item) => item.id));
  takenIds.delete(rule.id);
  const idProblem = !/^[a-z0-9_]+$/.test(idDraft)
    ? "Use lowercase letters, numbers and underscores."
    : takenIds.has(idDraft)
      ? "Already used."
      : "";

  return (
    <article
      id={`studio-rule-${rule.id}`}
      className="studio-anchor scroll-mt-28 rounded-[20px] bg-card p-4 ring-1 ring-[#ead79a] md:p-5"
    >
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Tag tone="warn" icon={<Clock3 aria-hidden className="size-3.5" />}>
          Time-critical event {index + 1}
        </Tag>
        <Button size="sm" tone="danger" className="ml-auto" onClick={onRemove}>
          <Trash2 aria-hidden className="size-4" /> Delete event
        </Button>
      </header>
      {checks.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {checks.map((check) => (
            <li
              key={check.key}
              className={
                check.severity === "error"
                  ? "rounded-xl bg-pink-soft px-3 py-2 text-[13px] font-bold text-[#6f1c1c]"
                  : "rounded-xl bg-yellow-soft px-3 py-2 text-[13px] font-bold text-[#5c4300]"
              }
            >
              {check.message}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-6">
        <section className="space-y-3">
          <h5 className="font-display text-base font-black">When should this happen?</h5>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <Field
              label="If the student has not done…"
              required
              help="Doing this in time prevents the event."
            >
              <SelectInput
                value={rule.action}
                onChange={(action) => set({ action })}
                placeholder="Choose the action that prevents it"
                options={(["treat", "examine", "test", "ask"] as const).flatMap((category) =>
                  definition.actions
                    .filter((action) => action.category === category && action.id)
                    .map((action) => ({
                      value: action.id,
                      label: `${action.label || "Untitled"} (${CATEGORY_META[category].noun})`,
                    })),
                )}
              />
            </Field>
            <Field label="…by minute" required help="Simulated minutes since arrival.">
              <NumberInput
                value={rule.ifNotDoneBy}
                min={0}
                suffix="min"
                onChange={(value) => set({ ifNotDoneBy: value ?? 0 })}
              />
            </Field>
          </div>
          {preventing && preventing.timeCostMin > rule.ifNotDoneBy && (
            <p className="text-[13px] font-bold text-[#8f2424]">
              “{preventing.label}” takes {preventing.timeCostMin} minutes, so this can never be
              prevented.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h5 className="font-display text-base font-black">What happens?</h5>
          <Field label="Who raises the alarm?" required group>
            <ChoiceCards
              value={rule.source}
              onChange={(source) => set({ source })}
              columns={3}
              options={(Object.keys(ALERT_SOURCE_META) as DeteriorationRule["source"][]).map(
                (source) => ({
                  value: source,
                  label: ALERT_SOURCE_META[source].label,
                }),
              )}
            />
          </Field>
          <Field
            label="What they say"
            required
            help="Shown to the student the moment it happens."
            example="Doctor, her saturation is falling — 86% and her heart rate is climbing."
          >
            <TextArea
              value={rule.alertLine}
              rows={2}
              onChange={(alertLine) => set({ alertLine })}
            />
          </Field>
          <Field label="Change in observations" group>
            <VitalsDeltaEditor
              definition={definition}
              value={rule.effect}
              onChange={(effect) => set({ effect: effect ?? {} })}
              previewLabel="Compared with arrival:"
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h5 className="font-display text-base font-black">Can the patient be lost?</h5>
          <Toggle
            checked={rule.lossAtMinute !== undefined}
            tone="danger"
            icon={<HeartCrack aria-hidden className="size-4" />}
            label="If it is still not done later, the patient is lost"
            description="The case ends immediately at that minute."
            onChange={(on) =>
              setRule(
                on
                  ? { ...rule, lossAtMinute: Math.max(rule.ifNotDoneBy + 10, 10) }
                  : omitKey(rule, "lossAtMinute"),
              )
            }
          />
          {rule.lossAtMinute !== undefined && (
            <Field label="Patient lost at minute" required>
              <NumberInput
                className="max-w-[12rem]"
                value={rule.lossAtMinute}
                min={0}
                suffix="min"
                onChange={(lossAtMinute) => set({ lossAtMinute: lossAtMinute ?? 0 })}
              />
            </Field>
          )}
        </section>

        <Disclosure title="Advanced" summary="Internal reference and event tag">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Internal reference"
              help={
                idProblem ||
                "Changing it updates every alternative response that depends on this event."
              }
            >
              <div className="flex gap-2">
                <TextInput
                  value={idDraft}
                  onChange={(value) => setIdDraft(value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                />
                <Button
                  size="sm"
                  disabled={Boolean(idProblem) || idDraft === rule.id}
                  onClick={() => onChange(renameRuleId(definition, rule.id, idDraft))}
                >
                  Rename
                </Button>
              </div>
            </Field>
            <Field label="Event tag" help="Recorded on the student's timeline. No effect on play.">
              <TextInput
                value={rule.triggersEvent}
                onChange={(triggersEvent) => set({ triggersEvent })}
              />
            </Field>
          </div>
        </Disclosure>
      </div>
    </article>
  );
}

export function BuilderProgressionStep({
  definition,
  checks,
  onChange,
}: {
  definition: MedicalCase;
  checks: StudioCheck[];
  onChange: (next: MedicalCase) => void;
}) {
  const confirm = useConfirm();
  const { jump } = useWorkspace();
  const course = useMemo(() => untreatedCourse(definition), [definition]);
  const comparisons = useMemo(() => compareSnapshots(definition, course), [definition, course]);
  const rules = definition.deteriorationRules;
  const effectActions = definition.actions.filter(
    (action) =>
      action.vitalsEffect ||
      action.immediateFailure ||
      action.variants?.some((variant) => variant.vitalsEffect),
  );
  const stateActions = definition.actions.filter((action) => action.variants?.length);
  const references = definition.vitalsTimeline.slice(1);
  const setReferences = (next: VitalsSnapshot[]) =>
    onChange({ ...definition, vitalsTimeline: [definition.vitalsTimeline[0]!, ...next] });
  const ruleChecks = (rule: DeteriorationRule) =>
    checks.filter((check) => check.anchor === `studio-rule-${rule.id}`);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META.progression.title}
          description={BUILD_STEP_META.progression.blurb}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-yellow-soft/70 p-3 text-[13px] leading-relaxed">
            <p className="mb-1 flex items-center gap-1.5 font-extrabold">
              <Clock3 aria-hidden className="size-4" /> Time-critical events
            </p>
            Set here: what happens if something isn't done in time.
          </div>
          <div className="rounded-2xl bg-blue-soft/70 p-3 text-[13px] leading-relaxed">
            <p className="mb-1 flex items-center gap-1.5 font-extrabold">
              <MousePointerClick aria-hidden className="size-4" /> Effects of actions
            </p>
            Set on each action: e.g. oxygen raising SpO₂.
          </div>
          <div className="rounded-2xl bg-lavender-soft/70 p-3 text-[13px] leading-relaxed">
            <p className="mb-1 flex items-center gap-1.5 font-extrabold">
              <GitBranch aria-hidden className="size-4" /> State-dependent responses
            </p>
            Set on each action: a different answer after deterioration.
          </div>
        </div>
      </Panel>

      {course && course.points.length > 1 && (
        <Panel>
          <PanelHeading
            level={3}
            title="If the student does nothing"
            description={
              course.lostAt !== null
                ? `With the events below, an untreated patient is lost at minute ${course.lostAt}.`
                : "With the events below, an untreated patient deteriorates but is never lost from delay alone."
            }
            aside={<Tag>Updates as you edit</Tag>}
          />
          <VitalsSmallMultiples
            points={course.points}
            markers={[
              ...[...new Set(rules.map((rule) => rule.ifNotDoneBy))].map((minute) => ({
                minute,
                label: "Deterioration",
                kind: "event" as const,
              })),
              ...(course.lostAt !== null
                ? [{ minute: course.lostAt, label: "Patient lost", kind: "lost" as const }]
                : []),
            ]}
            endMinute={Math.max(
              course.lostAt ?? 0,
              ...rules.map((rule) => rule.lossAtMinute ?? rule.ifNotDoneBy),
              10,
            )}
          />
        </Panel>
      )}

      <section id="studio-rules" className="studio-anchor scroll-mt-28 space-y-3">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <h3 className="font-display text-lg font-black">Time-critical events</h3>
          <Tag>{rules.length}</Tag>
          <Button
            tone="primary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              const result = addRule(definition);
              onChange(result.definition);
              window.setTimeout(
                () =>
                  document
                    .getElementById(`studio-rule-${result.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                60,
              );
            }}
          >
            <Plus aria-hidden className="size-4" /> Add an event
          </Button>
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<Siren className="size-6" />}
            title="Nothing is time-critical yet"
            action={
              <Button tone="primary" onClick={() => onChange(addRule(definition).definition)}>
                <Plus aria-hidden className="size-4" /> Add the first event
              </Button>
            }
          >
            Example: if oxygen isn't given by minute 8, the nurse warns that saturation is falling,
            SpO₂ drops by 5, and the patient is lost at minute 18.
          </EmptyState>
        ) : (
          rules.map((rule, index) => (
            <RuleEditor
              key={index}
              definition={definition}
              rule={rule}
              index={index}
              checks={ruleChecks(rule)}
              onChange={onChange}
              onRemove={async () => {
                const refs = ruleReferences(definition, rule.id);
                const ok = await confirm({
                  title: "Delete this event?",
                  confirmLabel: "Delete event",
                  description: refs.length ? (
                    <div className="space-y-2">
                      <p>Other parts of the case use it and will be flagged for you to update:</p>
                      <ul className="list-disc pl-5">
                        {refs.map((ref, i) => (
                          <li key={i}>{ref.text}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    "This cannot be undone."
                  ),
                });
                if (ok)
                  onChange({
                    ...definition,
                    deteriorationRules: rules.filter((_, i) => i !== index),
                  });
              }}
            />
          ))
        )}
      </section>

      <Panel>
        <PanelHeading
          level={3}
          title="Changes set on actions"
          description="For reference. Edit these on the action itself."
        />
        {effectActions.length === 0 && stateActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No action changes the observations, ends the case or responds differently yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {[...new Set([...effectActions, ...stateActions])].map((action) => (
              <li key={action.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{action.label || "Untitled"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
                    {action.immediateFailure && <Tag tone="dark">Ends the case</Tag>}
                    {action.vitalsEffect && <DeltaChips delta={action.vitalsEffect} />}
                    {action.variants?.length ? (
                      <span className="text-muted-foreground">
                        Responds differently when{" "}
                        {action.variants
                          .map((variant) =>
                            describeCondition(definition, variant.when).join(" and "),
                          )
                          .join("; or when ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  tone="quiet"
                  onClick={() =>
                    jump({ step: CATEGORY_STEP[action.category], actionId: action.id })
                  }
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Disclosure
        title="Reference observations for reviewers (optional)"
        summary={
          references.length
            ? `${references.length} set${references.length === 1 ? "" : "s"} written`
            : "None"
        }
      >
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
          Notes on what you expect the observations to be later in an untreated case. The simulator
          does not use them; reviewers compare them with the calculated course above.
        </p>
        <div className="space-y-3">
          {references.map((snapshot, index) => {
            const comparison = comparisons[index];
            return (
              <div key={index} className="rounded-2xl border border-border p-3">
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <Field label="At minute" required className="w-36">
                    <NumberInput
                      value={snapshot.tMinute}
                      min={1}
                      suffix="min"
                      onChange={(value) =>
                        setReferences(
                          references.map((item, i) =>
                            i === index ? { ...item, tMinute: value ?? 1 } : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  {comparison && (
                    <p className="pb-2 text-[13px] text-muted-foreground">
                      {comparison.lostBefore
                        ? "The simulated patient is already lost by then."
                        : comparison.differences.length
                          ? `Simulator gives ${comparison.differences.map((diff) => `${VITAL_META[diff.sign].short} ${diff.simulated}`).join(", ")}.`
                          : "Matches the simulated course."}
                    </p>
                  )}
                  <Button
                    size="sm"
                    tone="danger"
                    className="ml-auto"
                    onClick={() => setReferences(references.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden className="size-4" /> Remove
                  </Button>
                </div>
                <VitalsSnapshotFields
                  snapshot={snapshot}
                  onChange={(next) =>
                    setReferences(references.map((item, i) => (i === index ? next : item)))
                  }
                />
              </div>
            );
          })}
          <AddRow
            onClick={() =>
              setReferences([
                ...references,
                {
                  ...(definition.vitalsTimeline.at(-1) ?? definition.vitalsTimeline[0]!),
                  tMinute: (definition.vitalsTimeline.at(-1)?.tMinute ?? 0) + 10,
                },
              ])
            }
          >
            Add a reference set
          </AddRow>
        </div>
      </Disclosure>
    </div>
  );
}

import { ArrowDown, ArrowUp, GitBranch, ShieldQuestion, Trash2 } from "lucide-react";
import type {
  ActionSafetyGate,
  CaseAction,
  CaseActionResult,
  MedicalCase,
  ResultCondition,
  ResultVariant,
  VitalSign,
} from "@/features/case-challenge/schema";
import { describeCondition, gateSentence, ruleTitle } from "../../case-analysis";
import { VITAL_META, VITAL_ORDER } from "../../vocabulary";
import {
  ChipToggleGroup,
  Field,
  IconButton,
  NumberInput,
  SelectInput,
  TextArea,
  Toggle,
} from "../studio-ui";
import {
  EcgPicker,
  ImagePicker,
  LabRowsEditor,
  MarkerEditor,
  ResponseTextField,
} from "./response-editor";
import { ActionPicker, AddRow, VitalsDeltaEditor } from "./small-editors";

function omitKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

/* ---- Safety condition ---------------------------------------------------- */

export function SafetyConditionEditor({
  definition,
  action,
  onChange,
}: {
  definition: MedicalCase;
  action: CaseAction;
  onChange: (next: CaseAction) => void;
}) {
  const gate = action.safeWhen;
  const penalty = Math.abs(definition.scoring.perHarmfulAction);
  const setGate = (next: ActionSafetyGate) => onChange({ ...action, safeWhen: next });
  const others = [action.id];

  return (
    <div className="space-y-3">
      <Toggle
        checked={Boolean(gate)}
        tone="warn"
        icon={<ShieldQuestion aria-hidden className="size-4" />}
        label="Only safe once other steps are done"
        description="For treatments that are right only after confirmation or preparation, e.g. anticoagulation after imaging."
        onChange={(on) => {
          if (on) onChange({ ...action, safeWhen: { explanation: "", anyActionIds: [] } });
          else onChange(omitKey(omitKey(action, "safeWhen"), "penalizeWhenUnsafe"));
        }}
      />
      {gate && (
        <div className="space-y-4 rounded-2xl border border-[#ead79a] bg-[#fffdf4] p-4">
          <Field
            label="Why is it only safe then?"
            required
            help="Students see this as a warning if they do it too early, and in the debrief."
            example="Anticoagulation is appropriate after confirmation or when clinical probability is high."
          >
            <TextArea
              value={gate.explanation}
              rows={2}
              onChange={(explanation) => setGate({ ...gate, explanation })}
            />
          </Field>
          <Field
            label="The student must have done all of these"
            group
            help="Leave empty if there is no must-have step."
          >
            <ActionPicker
              definition={definition}
              label="Must have done all of these"
              value={gate.allActionIds ?? []}
              exclude={others}
              onChange={(ids) =>
                setGate(ids.length ? { ...gate, allActionIds: ids } : omitKey(gate, "allActionIds"))
              }
            />
          </Field>
          <Field
            label="…and at least one of these"
            group
            help="Any one is enough, e.g. either of two confirmatory scans."
          >
            <ActionPicker
              definition={definition}
              label="At least one of these"
              value={gate.anyActionIds ?? []}
              exclude={others}
              onChange={(ids) =>
                setGate(ids.length ? { ...gate, anyActionIds: ids } : omitKey(gate, "anyActionIds"))
              }
            />
          </Field>
          <Field
            label="…or enough supporting findings"
            group
            help="An alternative to the list above: safe once the student has done at least this many of these actions."
          >
            <div className="space-y-2">
              <ActionPicker
                definition={definition}
                label="Supporting actions"
                value={gate.supportingActionThreshold?.actionIds ?? []}
                exclude={others}
                onChange={(ids) =>
                  setGate(
                    ids.length
                      ? {
                          ...gate,
                          supportingActionThreshold: {
                            actionIds: ids,
                            minimumCompleted:
                              Math.min(
                                gate.supportingActionThreshold?.minimumCompleted ?? 1,
                                ids.length,
                              ) || 1,
                          },
                        }
                      : omitKey(gate, "supportingActionThreshold"),
                  )
                }
              />
              {gate.supportingActionThreshold && (
                <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  At least
                  <NumberInput
                    className="w-24"
                    value={gate.supportingActionThreshold.minimumCompleted}
                    min={1}
                    max={gate.supportingActionThreshold.actionIds.length}
                    ariaLabel="Minimum number of supporting actions"
                    onChange={(value) =>
                      setGate({
                        ...gate,
                        supportingActionThreshold: {
                          ...gate.supportingActionThreshold!,
                          minimumCompleted: value ?? 1,
                        },
                      })
                    }
                  />
                  of {gate.supportingActionThreshold.actionIds.length}
                </label>
              )}
            </div>
          </Field>
          <p className="rounded-xl bg-yellow-soft px-3 py-2 text-[13px] font-bold">
            In short: {gateSentence(definition, gate)}
          </p>
          <Toggle
            checked={Boolean(action.penalizeWhenUnsafe)}
            tone="danger"
            label={`Count it as harmful if done too early (−${penalty} points)`}
            description="Off: the student only sees the warning. On: it also costs points and appears in the debrief."
            onChange={(on) =>
              onChange(
                on
                  ? { ...action, penalizeWhenUnsafe: true }
                  : omitKey(action, "penalizeWhenUnsafe"),
              )
            }
          />
        </div>
      )}
    </div>
  );
}

/* ---- Different responses ------------------------------------------------------ */

function ConditionEditor({
  definition,
  action,
  when,
  onChange,
}: {
  definition: MedicalCase;
  action: CaseAction;
  when: ResultCondition;
  onChange: (when: ResultCondition) => void;
}) {
  const set = <K extends keyof ResultCondition>(key: K, value: ResultCondition[K] | undefined) =>
    onChange(
      value === undefined || (Array.isArray(value) && !value.length)
        ? omitKey(when, key)
        : { ...when, [key]: value },
    );
  const vitals = when.vitals ?? {};
  const signs = Object.keys(vitals) as VitalSign[];
  const setVitals = (next: ResultCondition["vitals"]) =>
    set("vitals", next && Object.keys(next).length ? next : undefined);

  return (
    <div className="space-y-4">
      <Field label="The student has already done all of these" group>
        <ActionPicker
          definition={definition}
          label="Already done"
          value={when.afterActions ?? []}
          exclude={[action.id]}
          onChange={(ids) => set("afterActions", ids)}
        />
      </Field>
      <Field label="The student has not yet done any of these" group>
        <ActionPicker
          definition={definition}
          label="Not yet done"
          value={when.notAfterActions ?? []}
          exclude={[action.id]}
          onChange={(ids) => set("notAfterActions", ids)}
        />
      </Field>
      {definition.deteriorationRules.length > 0 && (
        <Field
          label="The patient has deteriorated because of"
          group
          help="Time-critical events from the Progression step."
        >
          <ChipToggleGroup
            label="Deterioration events"
            options={definition.deteriorationRules.map((rule) => ({
              id: rule.id,
              label: ruleTitle(definition, rule),
            }))}
            value={when.afterDeterioration ?? []}
            onChange={(ids) => set("afterDeterioration", ids)}
          />
        </Field>
      )}
      <Field
        label="An observation is in a range"
        group
        help="“At least” includes the number; “below” does not."
      >
        <div className="space-y-2">
          {signs.map((sign) => {
            const range = vitals[sign] ?? {};
            return (
              <div
                key={sign}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-2"
              >
                <SelectInput
                  className="w-auto min-w-[11rem]"
                  ariaLabel="Observation"
                  value={sign}
                  options={VITAL_ORDER.filter((item) => item === sign || !signs.includes(item)).map(
                    (item) => ({
                      value: item,
                      label: VITAL_META[item].label,
                    }),
                  )}
                  onChange={(next) => {
                    const copy = { ...vitals };
                    delete copy[sign];
                    copy[next] = range;
                    setVitals(copy);
                  }}
                />
                <span className="text-sm font-bold">at least</span>
                <NumberInput
                  className="w-28"
                  allowEmpty
                  ariaLabel={`${VITAL_META[sign].label} at least`}
                  value={range.atLeast}
                  suffix={VITAL_META[sign].unit}
                  onChange={(value) =>
                    setVitals({
                      ...vitals,
                      [sign]:
                        value === undefined
                          ? omitKey(range, "atLeast")
                          : { ...range, atLeast: value },
                    })
                  }
                />
                <span className="text-sm font-bold">and below</span>
                <NumberInput
                  className="w-28"
                  allowEmpty
                  ariaLabel={`${VITAL_META[sign].label} below`}
                  value={range.below}
                  suffix={VITAL_META[sign].unit}
                  onChange={(value) =>
                    setVitals({
                      ...vitals,
                      [sign]:
                        value === undefined ? omitKey(range, "below") : { ...range, below: value },
                    })
                  }
                />
                <IconButton
                  label="Remove this observation condition"
                  onClick={() => {
                    const copy = { ...vitals };
                    delete copy[sign];
                    setVitals(copy);
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            );
          })}
          {signs.length < VITAL_ORDER.length && (
            <AddRow
              onClick={() => {
                const next = VITAL_ORDER.find((sign) => !signs.includes(sign));
                if (next) setVitals({ ...vitals, [next]: {} });
              }}
            >
              Add an observation condition
            </AddRow>
          )}
        </div>
      </Field>
    </div>
  );
}

export function VariantsEditor({
  definition,
  action,
  onChange,
  onAddImage,
}: {
  definition: MedicalCase;
  action: CaseAction;
  onChange: (next: CaseAction) => void;
  onAddImage: () => void;
}) {
  const variants = action.variants ?? [];
  const setVariants = (next: ResultVariant[]) =>
    onChange(next.length ? { ...action, variants: next } : omitKey(action, "variants"));
  const setVariant = (index: number, next: ResultVariant) =>
    setVariants(variants.map((variant, i) => (i === index ? next : variant)));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= variants.length) return;
    const copy = [...variants];
    [copy[index], copy[target]] = [copy[target]!, copy[index]!];
    setVariants(copy);
  };
  const base = action.result;

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Use these when the answer should change with the patient — for example a repeat set of
        observations after oxygen, or an ECG after deterioration. When the action is completed the
        alternatives are checked from the top; the first whose conditions are all true replaces the
        usual response.
      </p>
      {variants.map((variant, index) => {
        const merged: CaseActionResult = { ...base, ...variant.result };
        const setResult = (partial: Partial<CaseActionResult>) =>
          setVariant(index, { ...variant, result: { ...variant.result, ...partial } });
        const clearResult = (key: keyof CaseActionResult) =>
          setVariant(index, { ...variant, result: omitKey(variant.result, key) });
        return (
          <article key={index} className="rounded-2xl border border-[#d9cff3] bg-[#faf8ff]">
            <header className="flex flex-wrap items-center gap-2 border-b border-[#e6e0f5] px-4 py-3">
              <GitBranch aria-hidden className="size-4 text-[#5a44b5]" />
              <h5 className="min-w-0 flex-1 text-sm font-extrabold">
                Alternative {index + 1}: when{" "}
                {describeCondition(definition, variant.when).join(", and ")}
              </h5>
              <IconButton
                label="Check this alternative earlier"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton
                label="Check this alternative later"
                disabled={index === variants.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton
                label="Remove this alternative"
                onClick={() => setVariants(variants.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </header>
            <div className="space-y-5 p-4">
              <section>
                <h6 className="mb-2 text-sm font-black">When does this apply?</h6>
                <ConditionEditor
                  definition={definition}
                  action={action}
                  when={variant.when}
                  onChange={(when) => setVariant(index, { ...variant, when })}
                />
              </section>
              <section className="space-y-4">
                <h6 className="text-sm font-black">What the student gets instead</h6>
                <ResponseTextField
                  definition={definition}
                  category={action.category}
                  value={merged.content}
                  onChange={(content) => setResult({ content })}
                />
                {base.type === "lab_table" && (
                  <>
                    <Toggle
                      checked={variant.result.labs !== undefined}
                      label="Different lab values"
                      onChange={(on) =>
                        on
                          ? setResult({ labs: structuredClone(base.labs ?? []) })
                          : clearResult("labs")
                      }
                    />
                    {variant.result.labs && (
                      <LabRowsEditor
                        rows={variant.result.labs}
                        onChange={(labs) => setResult({ labs })}
                      />
                    )}
                  </>
                )}
                {base.type === "ecg" && (
                  <>
                    <Toggle
                      checked={variant.result.ecg !== undefined}
                      label="Different ECG pattern"
                      onChange={(on) =>
                        on
                          ? setResult({ ecg: { preset: base.ecg?.preset ?? "sinus_normal" } })
                          : clearResult("ecg")
                      }
                    />
                    {variant.result.ecg && (
                      <EcgPicker
                        value={variant.result.ecg.preset}
                        heartRate={definition.vitalsTimeline[0]?.hr ?? 80}
                        onChange={(preset) => setResult({ ecg: { preset } })}
                      />
                    )}
                  </>
                )}
                {base.type === "image" && (
                  <>
                    <Toggle
                      checked={variant.result.assetId !== undefined}
                      label="Different image"
                      onChange={(on) =>
                        on ? setResult({ assetId: base.assetId ?? "" }) : clearResult("assetId")
                      }
                    />
                    {variant.result.assetId !== undefined && (
                      <ImagePicker
                        definition={definition}
                        value={variant.result.assetId}
                        onChange={(assetId) => setResult({ assetId })}
                        onAddImage={onAddImage}
                      />
                    )}
                  </>
                )}
                {(base.type === "image" || base.type === "ecg") &&
                  (variant.result.ecg !== undefined ||
                    variant.result.assetId !== undefined ||
                    variant.result.annotation) && (
                    <Field label="Debrief marker for this version" group>
                      <MarkerEditor
                        definition={definition}
                        result={merged}
                        onChange={(annotation) =>
                          annotation ? setResult({ annotation }) : clearResult("annotation")
                        }
                      />
                    </Field>
                  )}
              </section>
              <section className="space-y-3">
                <Toggle
                  checked={variant.vitalsEffect !== undefined}
                  label="Different effect on the observations"
                  description="Off: the usual effect (if any) applies."
                  onChange={(on) =>
                    setVariant(
                      index,
                      on
                        ? { ...variant, vitalsEffect: { ...(action.vitalsEffect ?? {}) } }
                        : omitKey(variant, "vitalsEffect"),
                    )
                  }
                />
                {variant.vitalsEffect !== undefined && (
                  <VitalsDeltaEditor
                    definition={definition}
                    value={variant.vitalsEffect}
                    onChange={(effect) =>
                      setVariant(index, { ...variant, vitalsEffect: effect ?? {} })
                    }
                  />
                )}
              </section>
            </div>
          </article>
        );
      })}
      <AddRow
        onClick={() => setVariants([...variants, { when: {}, result: { content: base.content } }])}
      >
        Add an alternative response
      </AddRow>
      {variants.some((variant) =>
        describeCondition(definition, variant.when)[0]?.startsWith("always"),
      ) && (
        <p className="text-[13px] font-bold text-[#8a5a00]">
          An alternative without conditions always applies, so the usual response is never shown.
        </p>
      )}
    </div>
  );
}

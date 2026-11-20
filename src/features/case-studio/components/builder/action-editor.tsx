import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  KeyRound,
  OctagonX,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CLUE_TIERS, type CaseAction, type MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { deltaParts } from "../../case-analysis";
import type { StudioCheck } from "../../issue-guide";
import { CATEGORY_META, CLUE_META, GROUP_PRESETS } from "../../vocabulary";
import { ActionTags, previewText } from "../clinical-display";
import {
  Button,
  ChipToggleGroup,
  ChoiceCards,
  Disclosure,
  Field,
  FOCUS_RING,
  IconButton,
  NumberInput,
  TextArea,
  TextInput,
  Toggle,
} from "../studio-ui";
import { useFocusAction } from "../workspace-context";
import { SafetyConditionEditor, VariantsEditor } from "./conditional-editors";
import { ResponseEditor } from "./response-editor";
import { VitalsDeltaEditor } from "./small-editors";

function omitKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function flag(
  action: CaseAction,
  key: "isKeyClue" | "isUnnecessary" | "harmful" | "immediateFailure",
  on: boolean,
): CaseAction {
  return on ? { ...action, [key]: true } : omitKey(action, key);
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h5 className="font-display text-base font-black text-[#2b2540]">{title}</h5>
      {children}
    </section>
  );
}

export interface ActionCardProps {
  definition: MedicalCase;
  action: CaseAction;
  open: boolean;
  onToggle: (open?: boolean) => void;
  checks: StudioCheck[];
  /** Edit the action itself (label edits may rename its internal id). */
  onActionChange: (next: CaseAction) => void;
  /** Edits that touch the rest of the case (required treatments, debrief lines). */
  onCaseChange: (change: (definition: MedicalCase) => MedicalCase) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddAfter: () => void;
  onAddImage: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function ActionCard(props: ActionCardProps) {
  const { definition, action, open, onToggle, checks } = props;
  const meta = CATEGORY_META[action.category];
  const headingRef = useRef<HTMLButtonElement | null>(null);
  const reveal = useCallback(() => {
    onToggle(true);
    requestAnimationFrame(() => {
      document
        .getElementById(`studio-action-${action.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, [action.id, onToggle]);
  useFocusAction(action.id, reveal);
  const errors = checks.filter((check) => check.severity === "error").length;
  const suggestions = checks.length - errors;

  return (
    <article
      id={`studio-action-${action.id}`}
      className={cn(
        "studio-anchor scroll-mt-28 rounded-[20px] bg-card ring-1 transition-shadow",
        open ? "shadow-[0_16px_34px_-20px_rgb(60_45_110/0.5)] ring-[#c9bdf2]" : "ring-border",
      )}
    >
      <div className="flex items-start gap-1 p-2 pr-3">
        <button
          ref={headingRef}
          type="button"
          aria-expanded={open}
          onClick={() => onToggle()}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-2 text-left",
            FOCUS_RING,
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "mt-0.5 size-5 shrink-0 text-ink-soft transition-transform",
              open ? "rotate-180" : "",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold leading-snug">
              {action.label || (
                <span className="italic text-muted-foreground">
                  New {meta.noun} — add the wording
                </span>
              )}
            </span>
            {!open && (
              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                {previewText(action.result.content) || "No response yet"}
              </span>
            )}
            <span className="mt-2 flex flex-wrap gap-1.5">
              {errors > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-soft px-2.5 py-1 text-xs font-extrabold text-[#8f2424]">
                  <TriangleAlert aria-hidden className="size-3.5" /> {errors} to fix
                </span>
              )}
              {errors === 0 && suggestions > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-soft px-2.5 py-1 text-xs font-extrabold text-[#6b4f00]">
                  {suggestions} suggestion{suggestions === 1 ? "" : "s"}
                </span>
              )}
              <ActionTags definition={definition} action={action} />
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          <IconButton
            label={`Move “${action.label || meta.noun}” up`}
            disabled={!props.canMoveUp}
            onClick={() => props.onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton
            label={`Move “${action.label || meta.noun}” down`}
            disabled={!props.canMoveDown}
            onClick={() => props.onMove(1)}
          >
            <ArrowDown className="size-4" />
          </IconButton>
        </div>
      </div>
      {open && <ActionEditor {...props} onDone={() => onToggle(false)} />}
    </article>
  );
}

export interface ActionEditorProps {
  definition: MedicalCase;
  action: CaseAction;
  checks: StudioCheck[];
  onActionChange: (next: CaseAction) => void;
  onCaseChange: (change: (definition: MedicalCase) => MedicalCase) => void;
  onDelete: () => void;
  onAddImage: () => void;
  /** "Done": close the editor. */
  onDone: () => void;
  onDuplicate?: (() => void) | undefined;
  onAddAfter?: (() => void) | undefined;
}

/** The full editor for one action; used by builder cards and, in place, by review cards. */
export function ActionEditor({
  definition,
  action,
  checks,
  onActionChange,
  onCaseChange,
  onDuplicate,
  onDelete,
  onAddAfter,
  onAddImage,
  onDone,
}: ActionEditorProps) {
  const meta = CATEGORY_META[action.category];
  const listId = useId();
  const [idDraft, setIdDraft] = useState(action.id);
  useEffect(() => setIdDraft(action.id), [action.id]);
  const set = (partial: Partial<CaseAction>) => onActionChange({ ...action, ...partial });
  const isTreat = action.category === "treat";
  const isRequired = definition.solution.keyTreatment.includes(action.id);
  const debrief = definition.solution.harmfulActionDebrief[action.id] ?? "";
  const { scoring } = definition;
  const customGroups = [
    ...new Set(
      definition.actions
        .filter((item) => item.category === action.category && item.group)
        .map((item) => item.group!),
    ),
  ];
  const groupOptions = [...new Set([...GROUP_PRESETS[action.category], ...customGroups])];
  const diagnosisOptions = definition.differential
    .filter((item) => item.label)
    .map((item) => ({
      id: item.id,
      label: `${item.label}${item.isCorrect ? " ✓" : item.isTempting ? " (tempting)" : ""}`,
    }));
  const takenIds = new Set(definition.actions.map((item) => item.id));
  takenIds.delete(action.id);
  const idProblem = !/^[a-z0-9_]+$/.test(idDraft)
    ? "Use lowercase letters, numbers and underscores only."
    : takenIds.has(idDraft)
      ? "Another action already uses this."
      : "";

  const scoringToggles = (
    <div className="grid gap-2 lg:grid-cols-2">
      {isTreat && (
        <Toggle
          checked={isRequired}
          tone="good"
          icon={<Star aria-hidden className="size-4" />}
          label="Required treatment"
          description={`Students must give it or include it in their final plan. Each one missing costs ${Math.abs(scoring.perMissedKeyTreatment)} points.`}
          onChange={(on) =>
            onCaseChange((current) => ({
              ...current,
              solution: {
                ...current.solution,
                keyTreatment: on
                  ? [...current.solution.keyTreatment.filter((id) => id !== action.id), action.id]
                  : current.solution.keyTreatment.filter((id) => id !== action.id),
              },
            }))
          }
        />
      )}
      <Toggle
        checked={Boolean(action.harmful)}
        tone="danger"
        icon={<ShieldAlert aria-hidden className="size-4" />}
        label="Harmful"
        description={`Always costs ${Math.abs(scoring.perHarmfulAction)} points, during the case or in the final plan. You'll explain why below.`}
        onChange={(on) => onActionChange(flag(action, "harmful", on))}
      />
      <Toggle
        checked={Boolean(action.immediateFailure)}
        tone="danger"
        icon={<OctagonX aria-hidden className="size-4" />}
        label="Ends the case — patient lost"
        description="For catastrophic choices such as discharging an unstable patient."
        onChange={(on) => onActionChange(flag(action, "immediateFailure", on))}
      />
      <Toggle
        checked={Boolean(action.isUnnecessary)}
        tone="warn"
        label="Unnecessary"
        description={`Over-investigation or an unhelpful step. Costs ${Math.abs(scoring.perUnnecessaryTest)} points each time.`}
        onChange={(on) => onActionChange(flag(action, "isUnnecessary", on))}
      />
    </div>
  );

  const debriefField = (action.harmful || action.immediateFailure || action.penalizeWhenUnsafe) && (
    <Field
      label={
        action.harmful || action.immediateFailure
          ? "Why is it harmful? (debrief)"
          : "Why is it unsafe when done too early? (debrief)"
      }
      required={Boolean(action.harmful)}
      help={
        action.harmful || action.immediateFailure
          ? "Students read this in their debrief if they chose it."
          : "Optional. If left empty, students read the safety explanation below."
      }
      example="She was not haemodynamically unstable, so thrombolysis added bleeding risk without benefit."
      anchor={`studio-debrief-${action.id}`}
    >
      <TextArea
        value={debrief}
        rows={2}
        onChange={(text) =>
          onCaseChange((current) => ({
            ...current,
            solution: {
              ...current.solution,
              harmfulActionDebrief: { ...current.solution.harmfulActionDebrief, [action.id]: text },
            },
          }))
        }
      />
    </Field>
  );

  const meaning = (
    <div className="space-y-4">
      <Field label="How does this help the diagnosis?" required group>
        <ChoiceCards
          value={action.clueTier}
          onChange={(clueTier) => set({ clueTier })}
          options={CLUE_TIERS.map((tier) => ({
            value: tier,
            label: CLUE_META[tier].label,
            description: CLUE_META[tier].description,
          }))}
        />
      </Field>
      <Toggle
        checked={Boolean(action.isKeyClue)}
        icon={<KeyRound aria-hidden className="size-4" />}
        label="Key clue"
        description={`A finding students must uncover. The debrief lists it as found or missed; finding any key clue by minute ${scoring.earlyClueCutoffMinute} earns +${scoring.bonusKeyClueFoundEarly} points.`}
        onChange={(on) => onActionChange(flag(action, "isKeyClue", on))}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Makes these diagnoses more likely"
          group
          help="Students can tag this evidence for these diagnoses."
        >
          <ChipToggleGroup
            label="Supports"
            options={diagnosisOptions}
            value={action.supports}
            onChange={(supports) => set({ supports })}
            emptyLabel="Add diagnoses in Case basics first."
          />
        </Field>
        <Field label="Makes these diagnoses less likely" group>
          <ChipToggleGroup
            label="Argues against"
            options={diagnosisOptions}
            value={action.against}
            onChange={(against) => set({ against })}
            emptyLabel="Add diagnoses in Case basics first."
          />
        </Field>
      </div>
    </div>
  );

  const effectSummary = deltaParts(action.vitalsEffect)
    .map((part) => part.text)
    .join(", ");

  return (
    <div className="space-y-6 border-t border-border px-4 pb-5 pt-5 md:px-6">
      {checks.length > 0 && (
        <ul className="space-y-1.5" aria-label="Problems in this action">
          {checks.map((check) => (
            <li
              key={check.key}
              className={cn(
                "flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-bold",
                check.severity === "error"
                  ? "bg-pink-soft text-[#6f1c1c]"
                  : check.severity === "warning"
                    ? "bg-yellow-soft text-[#5c4300]"
                    : "bg-blue-soft text-[#173f72]",
              )}
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {check.message}
            </li>
          ))}
        </ul>
      )}

      <EditorSection title={`1. What the student does`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Field
            label={meta.actionLabel}
            required
            help={meta.actionHelp}
            example={meta.actionExample}
            anchor={`studio-label-${action.id}`}
          >
            <TextInput value={action.label} onChange={(label) => set({ label })} />
          </Field>
          <Field
            label="Clinical heading"
            help={`Groups related ${meta.plural} for authors and reviewers. Students don't see it.`}
          >
            <TextInput
              value={action.group ?? ""}
              list={listId}
              placeholder="Choose or type a heading"
              onChange={(group) =>
                onActionChange(group.trim() ? { ...action, group } : omitKey(action, "group"))
              }
            />
            <datalist id={listId}>
              {groupOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
        </div>
      </EditorSection>

      <EditorSection title={`2. ${meta.responseLabel}`}>
        <ResponseEditor
          definition={definition}
          category={action.category}
          result={action.result}
          onChange={(result) => set({ result })}
          onAddImage={onAddImage}
          anchor={`studio-result-${action.id}`}
        />
      </EditorSection>

      <EditorSection title="3. Time and cost">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_minmax(0,1fr)]">
          <Field
            label="Time it takes"
            required
            help="Simulated minutes. The patient can deteriorate meanwhile."
          >
            <NumberInput
              value={action.timeCostMin}
              min={0}
              suffix="min"
              onChange={(value) => set({ timeCostMin: value ?? 0 })}
            />
          </Field>
          <Field label="Cost" help="Shown as hospital spend. No effect on the score.">
            <NumberInput
              value={action.moneyCost}
              min={0}
              suffix="$"
              onChange={(value) => set({ moneyCost: value ?? 0 })}
            />
          </Field>
          <Field
            label="Risk note"
            help="Shown to the student before they choose it."
            example="Ionising radiation and contrast exposure."
          >
            <TextInput value={action.riskNote} onChange={(riskNote) => set({ riskNote })} />
          </Field>
        </div>
      </EditorSection>

      {!isTreat && <EditorSection title="4. Clinical significance">{meaning}</EditorSection>}

      <EditorSection title={isTreat ? "4. Scoring and safety" : "5. Scoring and safety"}>
        {isTreat ? (
          <>
            {scoringToggles}
            {debriefField}
            <SafetyConditionEditor
              definition={definition}
              action={action}
              onChange={onActionChange}
            />
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">
              Most {meta.plural} need none of these. Mark one only if choosing it should cost the
              student.
            </p>
            {scoringToggles}
            {debriefField}
          </>
        )}
      </EditorSection>

      <div className="space-y-2">
        <Disclosure
          title="Effect on the patient's observations"
          summary={effectSummary || "No change"}
          defaultOpen={Boolean(action.vitalsEffect) && isTreat}
        >
          <p className="mb-3 text-[13px] text-muted-foreground">
            Applied the moment this is completed, e.g. oxygen raising SpO₂ by 4%.
          </p>
          <VitalsDeltaEditor
            definition={definition}
            value={action.vitalsEffect}
            onChange={(vitalsEffect) =>
              onActionChange(
                vitalsEffect ? { ...action, vitalsEffect } : omitKey(action, "vitalsEffect"),
              )
            }
          />
        </Disclosure>
        {isTreat && (
          <Disclosure
            title="Clinical significance"
            summary={`${CLUE_META[action.clueTier].label}${action.supports.length ? " · linked to a diagnosis" : ""}`}
          >
            {meaning}
          </Disclosure>
        )}
        {!isTreat && (
          <Disclosure
            title="Only safe once other steps are done"
            summary={action.safeWhen ? "On" : "Off — rarely needed outside treatments"}
          >
            <SafetyConditionEditor
              definition={definition}
              action={action}
              onChange={onActionChange}
            />
          </Disclosure>
        )}
        <Disclosure
          title="Different response depending on the patient's state"
          summary={
            action.variants?.length
              ? `${action.variants.length} alternative${action.variants.length === 1 ? "" : "s"}`
              : "None — the same response every time"
          }
          defaultOpen={false}
        >
          <VariantsEditor
            definition={definition}
            action={action}
            onChange={onActionChange}
            onAddImage={onAddImage}
          />
        </Disclosure>
        <Disclosure title="Advanced" summary="Internal reference and event tag">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Internal reference"
              help={
                idProblem ||
                "Used by the simulator to link things together. Changing it updates every link."
              }
            >
              <div className="flex gap-2">
                <TextInput
                  value={idDraft}
                  onChange={(value) => setIdDraft(value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                />
                <Button
                  size="sm"
                  disabled={Boolean(idProblem) || idDraft === action.id}
                  onClick={() => onActionChange({ ...action, id: idDraft })}
                >
                  Rename
                </Button>
              </div>
            </Field>
            <Field
              label="Event tag"
              help="Recorded on the student's timeline for analytics. No effect on play."
            >
              <TextInput
                value={action.triggersEvent}
                onChange={(triggersEvent) => set({ triggersEvent })}
              />
            </Field>
          </div>
        </Disclosure>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button tone="primary" onClick={onDone}>
          Done
        </Button>
        {onAddAfter && (
          <Button tone="quiet" onClick={onAddAfter}>
            <Plus aria-hidden className="size-4" /> Add another {meta.noun}
            {action.group ? ` under “${action.group}”` : ""}
          </Button>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          {onDuplicate && (
            <Button size="sm" onClick={onDuplicate}>
              <Copy aria-hidden className="size-4" /> Duplicate
            </Button>
          )}
          <Button size="sm" tone="danger" onClick={onDelete}>
            <Trash2 aria-hidden className="size-4" /> Delete
          </Button>
        </span>
      </div>
    </div>
  );
}

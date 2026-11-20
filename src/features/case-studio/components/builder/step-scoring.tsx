import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { CATEGORY_STEP, BUILD_STEP_META } from "../../vocabulary";
import {
  Button,
  ChipToggleGroup,
  Field,
  NumberInput,
  Panel,
  PanelHeading,
  TextArea,
  VisibilityTag,
} from "../studio-ui";
import { useWorkspace } from "../workspace-context";

type Scoring = MedicalCase["scoring"];

/** One scoring rule as a sentence with its numbers inline. */
function Sentence({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl bg-muted/50 px-4 py-3 text-[15px] font-semibold leading-relaxed">
      {children}
    </li>
  );
}

function Num({
  value,
  onChange,
  label,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <NumberInput
      className="inline-block w-28"
      value={value}
      min={0}
      ariaLabel={label}
      {...(suffix ? { suffix } : {})}
      onChange={(next) => onChange(Math.abs(next ?? 0))}
    />
  );
}

export function BuilderScoringStep({
  definition,
  onChange,
}: {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const { jump } = useWorkspace();
  const { scoring, solution } = definition;
  const setScoring = (partial: Partial<Scoring>) =>
    onChange({ ...definition, scoring: { ...scoring, ...partial } });
  // Penalties are stored as negative numbers; creators type how many points are lost.
  const penalty = (key: keyof Scoring) => (value: number) =>
    setScoring({ [key]: -Math.abs(value) } as Partial<Scoring>);
  const treatments = definition.actions.filter(
    (action) => action.category === "treat" && action.id,
  );
  const unsafe = definition.actions.filter(
    (action) => action.harmful || action.immediateFailure || action.penalizeWhenUnsafe,
  );

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META.scoring.title}
          description={BUILD_STEP_META.scoring.blurb}
        />
        <p className="text-sm text-muted-foreground">
          Best possible score:{" "}
          <strong className="text-foreground">
            {scoring.base + scoring.bonusKeyClueFoundEarly}
          </strong>
          . Scores never drop below 0.
        </p>
      </Panel>

      <Panel id="studio-points">
        <PanelHeading
          level={3}
          title="Points"
          description="Type how many points each rule gives or takes away. The defaults suit most cases."
          aside={<VisibilityTag visibility="debrief" />}
        />
        <ul className="space-y-2">
          <Sentence>
            Students start with
            <Num
              value={scoring.base}
              label="Starting points"
              onChange={(base) => setScoring({ base })}
            />
            points.
          </Sentence>
          <Sentence>
            Finding any key clue by minute
            <Num
              value={scoring.earlyClueCutoffMinute}
              label="Early clue deadline"
              suffix="min"
              onChange={(earlyClueCutoffMinute) => setScoring({ earlyClueCutoffMinute })}
            />
            earns a one-off bonus of
            <Num
              value={scoring.bonusKeyClueFoundEarly}
              label="Early clue bonus"
              onChange={(bonusKeyClueFoundEarly) => setScoring({ bonusKeyClueFoundEarly })}
            />
            points.
          </Sentence>
          <Sentence>
            After minute
            <Num
              value={scoring.perMinutePenaltyAfter}
              label="Minutes before time penalty"
              suffix="min"
              onChange={(perMinutePenaltyAfter) => setScoring({ perMinutePenaltyAfter })}
            />
            every extra minute costs
            <Num
              value={Math.abs(scoring.perMinutePenalty)}
              label="Points per extra minute"
              onChange={penalty("perMinutePenalty")}
            />
            points.
          </Sentence>
          <Sentence>
            Each harmful action costs
            <Num
              value={Math.abs(scoring.perHarmfulAction)}
              label="Points per harmful action"
              onChange={penalty("perHarmfulAction")}
            />
            points.
          </Sentence>
          <Sentence>
            Each unnecessary test or action costs
            <Num
              value={Math.abs(scoring.perUnnecessaryTest)}
              label="Points per unnecessary action"
              onChange={penalty("perUnnecessaryTest")}
            />
            points.
          </Sentence>
          <Sentence>
            Committing to the wrong diagnosis costs
            <Num
              value={Math.abs(scoring.incorrectDiagnosisPenalty)}
              label="Points for a wrong diagnosis"
              onChange={penalty("incorrectDiagnosisPenalty")}
            />
            points.
          </Sentence>
          <Sentence>
            Each required treatment left out costs
            <Num
              value={Math.abs(scoring.perMissedKeyTreatment)}
              label="Points per missed required treatment"
              onChange={penalty("perMissedKeyTreatment")}
            />
            points.
          </Sentence>
        </ul>
      </Panel>

      <Panel id="studio-required">
        <PanelHeading
          level={3}
          title="Required treatments"
          description="What a safe plan must include. Students who neither give these nor include them in their final plan lose points for each one."
        />
        <Field label="Choose the required treatments" required group>
          <ChipToggleGroup
            label="Required treatments"
            options={treatments.map((action) => ({
              id: action.id,
              label: action.label || "Untitled",
            }))}
            value={solution.keyTreatment}
            onChange={(keyTreatment) =>
              onChange({ ...definition, solution: { ...solution, keyTreatment } })
            }
            emptyLabel="Add treatments in the Treatment step first."
          />
        </Field>
      </Panel>

      <Panel id="studio-harmful">
        <PanelHeading
          level={3}
          title="Why unsafe actions are unsafe"
          description="Each harmful action needs an explanation for the debrief. You can also write these on the action itself."
          aside={<VisibilityTag visibility="debrief" />}
        />
        {unsafe.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action is marked harmful yet.</p>
        ) : (
          <div className="space-y-4">
            {unsafe.map((action) => (
              <Field
                key={action.id}
                label={action.label || "Untitled"}
                required={Boolean(action.harmful)}
                anchor={`studio-harmful-${action.id}`}
              >
                <TextArea
                  value={solution.harmfulActionDebrief[action.id] ?? ""}
                  rows={2}
                  onChange={(text) =>
                    onChange({
                      ...definition,
                      solution: {
                        ...solution,
                        harmfulActionDebrief: {
                          ...solution.harmfulActionDebrief,
                          [action.id]: text,
                        },
                      },
                    })
                  }
                />
                <Button
                  size="sm"
                  tone="ghost"
                  className="mt-1"
                  onClick={() =>
                    jump({ step: CATEGORY_STEP[action.category], actionId: action.id })
                  }
                >
                  Open “{action.label || "this action"}”
                </Button>
              </Field>
            ))}
          </div>
        )}
      </Panel>

      <Panel id="studio-hints">
        <PanelHeading
          level={3}
          title="Hints from Dr. Ambrose"
          description="Three nudges students can ask for, from gentle to direct. Each can cost points."
          aside={<VisibilityTag visibility="students" />}
        />
        <div className="space-y-3">
          {definition.hints.map((hint, index) => (
            <div
              key={hint.tier}
              className="grid gap-3 rounded-2xl bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_9rem]"
            >
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Lightbulb aria-hidden className="size-4" /> Hint {hint.tier}
                    {hint.tier === 1 ? " — gentle" : hint.tier === 3 ? " — direct" : ""}
                  </span>
                }
                required
              >
                <TextArea
                  value={hint.text}
                  rows={2}
                  onChange={(text) =>
                    onChange({
                      ...definition,
                      hints: definition.hints.map((item, i) =>
                        i === index ? { ...item, text } : item,
                      ) as MedicalCase["hints"],
                    })
                  }
                />
              </Field>
              <Field label="Costs">
                <NumberInput
                  value={hint.cost}
                  min={0}
                  suffix="pts"
                  onChange={(cost) =>
                    onChange({
                      ...definition,
                      hints: definition.hints.map((item, i) =>
                        i === index ? { ...item, cost: Math.abs(cost ?? 0) } : item,
                      ) as MedicalCase["hints"],
                    })
                  }
                />
              </Field>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Debrief comparison"
          aside={<VisibilityTag visibility="debrief" />}
        />
        <Field
          label="Share of students who solve it"
          help="Shown in the debrief for comparison. It is a fixed figure you choose, not live data."
          className="max-w-xs"
        >
          <NumberInput
            value={definition.mockComparisonPercent}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) =>
              onChange({
                ...definition,
                mockComparisonPercent: Math.min(100, Math.max(0, value ?? 0)),
              })
            }
          />
        </Field>
      </Panel>
    </div>
  );
}

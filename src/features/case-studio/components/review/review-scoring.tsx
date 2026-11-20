import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  HeartPulse,
  Info,
  KeyRound,
  Lightbulb,
  Minus,
  Plus,
  Star,
  Stethoscope,
} from "lucide-react";
import type { CaseAction, MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { actionLabel, assessAction, consistencyFindings, gateSentence } from "../../case-analysis";
import { CATEGORY_META, CATEGORY_STEP } from "../../vocabulary";
import { VerdictTag } from "../clinical-display";
import { Panel, PanelHeading, SubHeading, Tag, VisibilityTag } from "../studio-ui";
import { useWorkspace } from "../workspace-context";
import { EditButton } from "../edit-button";

function Points({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-16 items-center justify-center gap-0.5 rounded-full px-2.5 py-1 text-sm font-black tabular-nums",
        positive
          ? "bg-mint-soft text-[#0b4f4c]"
          : value < 0
            ? "bg-pink-soft text-[#7b1f1f]"
            : "bg-muted",
      )}
    >
      {positive ? (
        <Plus aria-hidden className="size-3.5" />
      ) : value < 0 ? (
        <Minus aria-hidden className="size-3.5" />
      ) : null}
      {Math.abs(value)}
      <span className="sr-only">{positive ? " points gained" : " points lost"}</span>
    </span>
  );
}

function ActionChips({ definition, actions }: { definition: MedicalCase; actions: CaseAction[] }) {
  const { jump } = useWorkspace();
  if (!actions.length)
    return <span className="text-[13px] text-muted-foreground">None in this case</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => jump({ step: CATEGORY_STEP[action.category], actionId: action.id })}
          className="rounded-full bg-muted px-2.5 py-1 text-xs font-extrabold hover:bg-lavender-soft"
          title={`Open “${action.label}”`}
        >
          {action.label || "Untitled"}
        </button>
      ))}
    </span>
  );
}

function RuleRow({
  icon,
  title,
  points,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  points: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-lavender-soft text-[#4a3799]"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-snug">{title}</p>
          {children && <div className="mt-1.5">{children}</div>}
        </div>
      </div>
      <div className="pl-11 sm:pl-0">{points}</div>
    </li>
  );
}

export function ReviewScoringStage({
  definition,
  readOnly = false,
}: {
  definition: MedicalCase;
  readOnly?: boolean;
}) {
  const { scoring, solution } = definition;
  const { jump } = useWorkspace();
  const by = (test: (action: CaseAction) => boolean) => definition.actions.filter(test);
  const harmful = by((action) => Boolean(action.harmful));
  const conditional = by((action) => Boolean(action.safeWhen));
  const unnecessary = by((action) => Boolean(action.isUnnecessary));
  const keyClues = by((action) => Boolean(action.isKeyClue));
  const earlyClues = keyClues.filter(
    (action) => action.timeCostMin <= scoring.earlyClueCutoffMinute,
  );
  const required = solution.keyTreatment
    .map((id) => definition.actions.find((action) => action.id === id))
    .filter((action): action is CaseAction => Boolean(action));
  const findings = useMemo(() => consistencyFindings(definition), [definition]);
  const maximum = scoring.base + scoring.bonusKeyClueFoundEarly;
  const hintTotal = definition.hints.reduce((sum, hint) => sum + hint.cost, 0);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel>
          <PanelHeading
            title="Scoring & patient safety"
            description="How students are assessed, in plain language. Every rule below comes straight from the case settings."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-lavender-soft/70 p-4">
              <p className="text-[13px] font-bold text-ink-soft">Students start with</p>
              <p className="font-display text-3xl font-black tabular-nums">{scoring.base}</p>
            </div>
            <div className="rounded-2xl bg-mint-soft p-4">
              <p className="text-[13px] font-bold text-[#0b4f4c]">Best possible score</p>
              <p className="font-display text-3xl font-black tabular-nums">{maximum}</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-[13px] font-bold text-ink-soft">Lowest possible score</p>
              <p className="font-display text-3xl font-black tabular-nums">0</p>
            </div>
          </div>
        </Panel>
      )}

      <Panel id="studio-points">
        <PanelHeading
          level={3}
          title="How points are gained and lost"
          aside={
            <>
              <VisibilityTag visibility="debrief" />
              {!readOnly && (
                <EditButton
                  target={{ step: "scoring", anchor: "studio-points" }}
                  label="Edit points & hints"
                />
              )}
            </>
          }
        />
        <ul className="divide-y divide-border">
          <RuleRow
            icon={<KeyRound className="size-4" />}
            title={`Finding a key clue by minute ${scoring.earlyClueCutoffMinute} (once)`}
            points={<Points value={scoring.bonusKeyClueFoundEarly} />}
          >
            <p className="mb-1.5 text-[13px] text-muted-foreground">
              Key clues that can be reached in time on their own: {earlyClues.length} of{" "}
              {keyClues.length}.
            </p>
            <ActionChips definition={definition} actions={keyClues} />
          </RuleRow>
          <RuleRow
            icon={<Clock3 className="size-4" />}
            title={`Each minute after minute ${scoring.perMinutePenaltyAfter}`}
            points={<Points value={scoring.perMinutePenalty} />}
          />
          <RuleRow
            icon={<AlertTriangle className="size-4" />}
            title="Each harmful action (during the case or in the final plan)"
            points={<Points value={scoring.perHarmfulAction} />}
          >
            <ActionChips
              definition={definition}
              actions={[
                ...harmful,
                ...conditional.filter((action) => action.penalizeWhenUnsafe && !action.harmful),
              ]}
            />
            {conditional.some((action) => action.penalizeWhenUnsafe && !action.harmful) && (
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Includes actions that count as harmful only when done before it is safe.
              </p>
            )}
          </RuleRow>
          <RuleRow
            icon={<Info className="size-4" />}
            title="Each unnecessary test or action"
            points={<Points value={scoring.perUnnecessaryTest} />}
          >
            <ActionChips definition={definition} actions={unnecessary} />
          </RuleRow>
          <RuleRow
            icon={<Stethoscope className="size-4" />}
            title="Committing to the wrong diagnosis"
            points={<Points value={scoring.incorrectDiagnosisPenalty} />}
          />
          <RuleRow
            icon={<Star className="size-4" />}
            title="Each required treatment missing from the final plan (or not given)"
            points={<Points value={scoring.perMissedKeyTreatment} />}
          >
            <ActionChips definition={definition} actions={required} />
          </RuleRow>
          <RuleRow
            icon={<Lightbulb className="size-4" />}
            title="Hints from Dr. Ambrose (if all three are used)"
            points={<Points value={-hintTotal} />}
          >
            <ol className="space-y-1.5 text-[13px]">
              {definition.hints.map((hint) => (
                <li key={hint.tier} className="flex gap-2">
                  <span className="shrink-0 font-extrabold">
                    Hint {hint.tier} ({hint.cost ? `−${hint.cost}` : "free"}):
                  </span>
                  <span className="text-muted-foreground">{hint.text || <em>empty</em>}</span>
                </li>
              ))}
            </ol>
          </RuleRow>
        </ul>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The score never drops below 0 or rises above {maximum}.
        </p>
      </Panel>

      <Panel id="studio-harmful">
        <PanelHeading
          level={3}
          title="Patient safety"
          description="Why each action is judged unsafe, as students will read it in their debrief."
          aside={
            readOnly ? undefined : (
              <EditButton
                target={{ step: "scoring", anchor: "studio-harmful" }}
                label="Edit explanations"
              />
            )
          }
        />
        <SubHeading>Harmful actions and actions that end the case</SubHeading>
        {harmful.length || by((action) => Boolean(action.immediateFailure)).length ? (
          <ul className="space-y-2">
            {by((action) => Boolean(action.harmful || action.immediateFailure)).map((action) => {
              const assessment = assessAction(definition, action);
              return (
                <li key={action.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerdictTag verdict={assessment.verdict} />
                    <Tag>{CATEGORY_META[action.category].noun}</Tag>
                    <button
                      type="button"
                      onClick={() =>
                        jump({ step: CATEGORY_STEP[action.category], actionId: action.id })
                      }
                      className="text-left text-sm font-extrabold underline-offset-2 hover:underline"
                    >
                      {action.label}
                    </button>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    <span className="font-bold">Why: </span>
                    {assessment.debrief ?? (
                      <em className="text-[#8f2424]">No explanation written.</em>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No harmful actions.</p>
        )}

        <div className="mt-5">
          <SubHeading>Safe only in the right context</SubHeading>
          {conditional.length ? (
            <ul className="space-y-2">
              {conditional.map((action) => (
                <li key={action.id} className="rounded-2xl bg-yellow-soft/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerdictTag verdict="context" />
                    <span className="text-sm font-extrabold">{action.label}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">
                    {gateSentence(definition, action.safeWhen!)}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {action.penalizeWhenUnsafe
                      ? `Too early counts as harmful (${scoring.perHarmfulAction} points).`
                      : "Too early shows a warning only; no points are lost."}{" "}
                    {action.safeWhen!.explanation && (
                      <>Students are told: “{action.safeWhen!.explanation}”</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No conditional actions.</p>
          )}
        </div>

        <div className="mt-5">
          <SubHeading>Unsafe omissions</SubHeading>
          <ul className="space-y-1.5 text-sm">
            {definition.deteriorationRules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2">
                <HeartPulse aria-hidden className="mt-0.5 size-4 shrink-0 text-[#b42323]" />
                <span>
                  Not doing “{actionLabel(definition, rule.action)}” by minute {rule.ifNotDoneBy}{" "}
                  makes the patient deteriorate
                  {rule.lossAtMinute !== undefined
                    ? `, and loses them at minute ${rule.lossAtMinute}`
                    : ""}
                  .
                </span>
              </li>
            ))}
            {required.map((action) => (
              <li key={action.id} className="flex items-start gap-2">
                <Star aria-hidden className="mt-0.5 size-4 shrink-0 text-[#0b5f5c]" />
                <span>
                  Leaving “{action.label}” out of the final plan costs{" "}
                  {Math.abs(scoring.perMissedKeyTreatment)} points.
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="Possible inconsistencies"
          description="Settings that contradict each other or will not behave as they read. These are automatic checks, not clinical judgements."
        />
        {findings.length === 0 ? (
          <p className="text-sm font-bold text-[#0b5f5c]">No contradictions found.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((finding, index) => (
              <li
                key={index}
                className={cn(
                  "flex flex-wrap items-start gap-2 rounded-2xl p-3 text-sm",
                  finding.level === "warning" ? "bg-yellow-soft" : "bg-blue-soft",
                )}
              >
                {finding.level === "warning" ? (
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1 leading-snug">{finding.message}</span>
                <button
                  type="button"
                  onClick={() =>
                    jump({
                      step: finding.step,
                      ...(finding.actionId ? { actionId: finding.actionId } : {}),
                      ...(finding.anchor ? { anchor: finding.anchor } : {}),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-extrabold shadow-sm hover:bg-muted"
                >
                  Show me <ArrowRight aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

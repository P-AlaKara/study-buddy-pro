import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GitBranch,
  PencilLine,
  Search,
  TriangleAlert,
} from "lucide-react";
import { interpolateVitals } from "@/features/case-challenge/engine";
import type { ActionCategory, CaseAction, MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { applyDelta, assessAction, describeCondition, initialVitals } from "../../case-analysis";
import { CATEGORY_META, CATEGORY_STEP, CLUE_META, REVIEW_STAGE_META } from "../../vocabulary";
import {
  ActionFacts,
  ActionTags,
  AssessmentLines,
  ClueTag,
  previewText,
  DeltaChips,
  DiagnosisList,
  ResultView,
  VerdictTag,
  VitalsGrid,
} from "../clinical-display";
import {
  Button,
  EmptyState,
  FOCUS_RING,
  Panel,
  PanelHeading,
  SubHeading,
  Tag,
  useConfirm,
  VisibilityTag,
} from "../studio-ui";
import { removeAction } from "../../case-edits";
import { ActionEditor } from "../builder/action-editor";
import { applyActionChange, confirmDeleteAction } from "../builder/step-actions";
import {
  groupActions,
  useFocusAction,
  useStableKeys,
  useWorkspace,
  type FocusRequest,
} from "../workspace-context";

/*
 * Review of one action category (history, examination, tests, treatment).
 * Actions sit under their clinical headings as expandable cards; reviewers can
 * filter, search, expand everything, or step through one card at a time, and
 * fix anything they find by editing the card in place.
 */

type Filter = "all" | "key" | "unsafe" | "variants";

const RESPONSE_HEADING: Record<ActionCategory, string> = {
  ask: "Patient replies",
  examine: "Finding",
  test: "Result",
  treat: "What happens",
};

export function ReviewActionsStage({
  definition,
  category,
  readOnly = false,
}: {
  definition: MedicalCase;
  category: ActionCategory;
  readOnly?: boolean;
}) {
  const stage = CATEGORY_STEP[category];
  const meta = CATEGORY_META[category];
  const keys = useStableKeys();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Keyed by stable key, so a card stays open while its label (and id) is edited.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const actions = definition.actions.filter((action) => action.category === category);
  const { focus } = useWorkspace();

  // A jump to an action hidden by the current search/filter clears them first.
  useEffect(() => {
    if (focus?.actionId && actions.some((action) => action.id === focus.actionId)) {
      setQuery("");
      setFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const matches = useCallback(
    (action: CaseAction) => {
      const text = `${action.label} ${action.result.content} ${action.group ?? ""}`.toLowerCase();
      if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
      switch (filter) {
        case "key":
          return Boolean(action.isKeyClue);
        case "unsafe":
          return Boolean(
            action.harmful || action.immediateFailure || action.safeWhen || action.isUnnecessary,
          );
        case "variants":
          return Boolean(action.variants?.length);
        default:
          return true;
      }
    },
    [query, filter],
  );

  const groups = useMemo(
    () =>
      groupActions(definition.actions, category)
        .map((group) => ({ ...group, actions: group.actions.filter(matches) }))
        .filter((group) => group.actions.length),
    [definition.actions, category, matches],
  );
  const ordered = groups.flatMap((group) => group.actions);

  const flip = (setter: typeof setOpen) => (id: string, next?: boolean) =>
    setter((current) => {
      const key = keys.keyFor(id);
      const copy = new Set(current);
      if (next ?? !copy.has(key)) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  const toggle = flip(setOpen);
  const toggleEditing = flip(setEditing);

  const counts = {
    key: actions.filter((action) => action.isKeyClue).length,
    unsafe: actions.filter(
      (action) =>
        action.harmful || action.immediateFailure || action.safeWhen || action.isUnnecessary,
    ).length,
    variants: actions.filter((action) => action.variants?.length).length,
  };
  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: actions.length },
    { id: "key", label: "Key clues", count: counts.key },
    {
      id: "unsafe",
      label: category === "treat" ? "Harmful or conditional" : "Penalised",
      count: counts.unsafe,
    },
    { id: "variants", label: "Changes with patient state", count: counts.variants },
  ];

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel>
          <PanelHeading
            title={REVIEW_STAGE_META[stage].title}
            description={REVIEW_STAGE_META[stage].blurb}
            aside={
              <Tag tone="accent">
                {actions.length} {actions.length === 1 ? meta.noun : meta.plural}
              </Tag>
            }
          />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search {meta.plural}</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${meta.plural} and responses…`}
                className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#7c63e0] focus:ring-2 focus:ring-[#7c63e0]/25"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-extrabold transition-colors",
                    FOCUS_RING,
                    filter === item.id
                      ? "bg-[#2b2540] text-white"
                      : "bg-muted hover:bg-lavender-soft",
                  )}
                >
                  {item.label}
                  {item.count !== undefined ? ` · ${item.count}` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              tone="ghost"
              onClick={() => setOpen(new Set(ordered.map((action) => keys.keyFor(action.id))))}
            >
              <ChevronsUpDown aria-hidden className="size-4" /> Expand all
            </Button>
            <Button size="sm" tone="ghost" onClick={() => setOpen(new Set())}>
              <ChevronsDownUp aria-hidden className="size-4" /> Collapse all
            </Button>
          </div>
        </Panel>
      )}

      {actions.length === 0 ? (
        <EmptyState title={meta.emptyTitle}>
          This case has no {meta.plural}. Students will find this part of the encounter empty.
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing matches">Try another search or filter.</EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.name} aria-label={group.name} className="space-y-2">
            <h3 className="flex items-center gap-2 px-1 pt-2 font-display text-base font-black text-ink-soft">
              {group.name}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-extrabold">
                {group.actions.length}
              </span>
            </h3>
            {group.actions.map((action) => {
              const index = ordered.indexOf(action);
              return (
                <ReviewActionCard
                  key={keys.keyFor(action.id)}
                  definition={definition}
                  action={action}
                  open={open.has(keys.keyFor(action.id))}
                  onToggle={(next) => toggle(action.id, next)}
                  editing={editing.has(keys.keyFor(action.id))}
                  onEditingChange={(next) => toggleEditing(action.id, next)}
                  renameKey={keys.rename}
                  onStep={(direction) => {
                    const target = ordered[index + direction];
                    if (!target) return;
                    setOpen(new Set([keys.keyFor(target.id)]));
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`studio-action-${target.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    );
                  }}
                  position={{ index, total: ordered.length }}
                  readOnly={readOnly}
                />
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}

export function ReviewActionCard({
  definition,
  action,
  open,
  onToggle,
  editing,
  onEditingChange,
  renameKey,
  onStep,
  position,
  readOnly,
}: {
  definition: MedicalCase;
  action: CaseAction;
  open: boolean;
  onToggle: (next?: boolean) => void;
  editing: boolean;
  onEditingChange: (next: boolean) => void;
  renameKey: (from: string, to: string) => void;
  onStep: (direction: -1 | 1) => void;
  position: { index: number; total: number };
  readOnly: boolean;
}) {
  const stage = CATEGORY_STEP[action.category];
  const meta = CATEGORY_META[action.category];
  const headingRef = useRef<HTMLButtonElement | null>(null);
  const confirm = useConfirm();
  const { edit, editor } = useWorkspace();
  const isEditing = editing && Boolean(editor) && !readOnly;
  const reveal = useCallback(
    (request: FocusRequest) => {
      onToggle(true);
      if (request.edit) onEditingChange(true);
      requestAnimationFrame(() => {
        document
          .getElementById(`studio-action-${action.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        headingRef.current?.focus({ preventScroll: true });
      });
    },
    [action.id, onToggle, onEditingChange],
  );
  useFocusAction(action.id, reveal);

  return (
    <article
      id={`studio-action-${action.id}`}
      className={cn(
        "studio-anchor scroll-mt-28 rounded-[20px] bg-card ring-1 transition-shadow",
        open ? "shadow-[0_14px_30px_-18px_rgb(60_45_110/0.45)] ring-[#c9bdf2]" : "ring-border",
      )}
    >
      <h4>
        <button
          ref={headingRef}
          type="button"
          aria-expanded={open}
          onClick={() => onToggle()}
          className={cn("flex w-full items-start gap-3 rounded-[20px] p-4 text-left", FOCUS_RING)}
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
              {action.label || <span className="italic text-[#8f2424]">Untitled {meta.noun}</span>}
            </span>
            {!open && (
              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                {previewText(action.result.content) || "No response yet"}
              </span>
            )}
            <span className="mt-2 flex flex-wrap gap-1.5">
              {isEditing && (
                <Tag tone="accent" icon={<PencilLine aria-hidden className="size-3.5" />}>
                  Editing
                </Tag>
              )}
              <ActionTags
                definition={definition}
                action={action}
                showVerdict={action.category === "treat"}
              />
            </span>
          </span>
        </button>
      </h4>
      {open && isEditing && editor && (
        <ActionEditor
          definition={editor.definition}
          action={action}
          checks={editor.checks.filter((check) => check.actionId === action.id)}
          onActionChange={(next) =>
            editor.onChange(applyActionChange(editor.definition, action.id, next, renameKey))
          }
          onCaseChange={(change) => editor.onChange(change(editor.definition))}
          onDelete={async () => {
            if (await confirmDeleteAction(confirm, editor.definition, action)) {
              editor.onChange(removeAction(editor.definition, action.id));
            }
          }}
          onAddImage={editor.onAddImage}
          onDone={() => onEditingChange(false)}
        />
      )}
      {open && !isEditing && (
        <div className="space-y-5 border-t border-border px-4 pb-4 pt-4 md:px-5">
          <ActionDetails definition={definition} action={action} />
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                tone="ghost"
                disabled={position.index <= 0}
                onClick={() => onStep(-1)}
              >
                <ChevronLeft aria-hidden className="size-4" /> Previous
              </Button>
              <span className="text-xs font-bold text-muted-foreground">
                {position.index + 1} of {position.total}
              </span>
              <Button
                size="sm"
                tone="ghost"
                disabled={position.index >= position.total - 1}
                onClick={() => onStep(1)}
              >
                Next <ChevronRight aria-hidden className="size-4" />
              </Button>
              {edit && (
                <Button
                  size="sm"
                  tone="primary"
                  className="ml-auto"
                  onClick={() => edit({ step: stage, actionId: action.id })}
                >
                  <PencilLine aria-hidden className="size-4" /> Edit this {meta.noun}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Section({
  title,
  visibility,
  children,
}: {
  title: string;
  visibility?: "students" | "debrief" | "reviewers";
  children: ReactNode;
}) {
  return (
    <section>
      <SubHeading aside={visibility ? <VisibilityTag visibility={visibility} /> : undefined}>
        {title}
      </SubHeading>
      {children}
    </section>
  );
}

export function ActionDetails({
  definition,
  action,
}: {
  definition: MedicalCase;
  action: CaseAction;
}) {
  const start = initialVitals(definition);
  const assessment = assessAction(definition, action);
  const isTreat = action.category === "treat";
  const hasTokens = /\{\w+([+-]\d+)?\}/.test(action.result.content);
  const showMeaning =
    action.category !== "treat" || action.clueTier !== "none" || action.supports.length > 0;

  const effect = action.vitalsEffect && start && (
    <Section title="Effect on the patient" visibility="students">
      <div className="space-y-2">
        <DeltaChips delta={action.vitalsEffect} />
        <p className="text-[13px] text-muted-foreground">
          Applied to the observations the moment this is completed. If done on arrival:
        </p>
        <VitalsGrid vitals={applyDelta(start, action.vitalsEffect)} before={start} compact />
      </div>
    </Section>
  );

  const assessmentBlock = (
    <Section title="Assessment & scoring" visibility="reviewers">
      <div className="space-y-2">
        <div>
          <VerdictTag verdict={assessment.verdict} />
        </div>
        <AssessmentLines definition={definition} action={action} />
        {assessment.debrief && (
          <div className="rounded-2xl bg-lavender-soft/60 p-3">
            <p className="mb-1 flex flex-wrap items-center gap-2 text-[13px] font-extrabold">
              Why, in the student's debrief <VisibilityTag visibility="debrief" />
            </p>
            <p className="text-sm leading-relaxed">{assessment.debrief}</p>
          </div>
        )}
        {(action.harmful || action.immediateFailure) && !assessment.debrief && (
          <p className="flex items-center gap-2 text-sm font-bold text-[#8f2424]">
            <TriangleAlert aria-hidden className="size-4" /> No debrief explanation: students won't
            be told why.
          </p>
        )}
      </div>
    </Section>
  );

  return (
    <>
      <Section title="Student does" visibility="students">
        <div className="space-y-2">
          <p className="text-[15px] font-bold">{action.label || "—"}</p>
          <ActionFacts action={action} />
          {action.riskNote && (
            <p className="text-[13px] text-muted-foreground">
              <span className="font-bold text-foreground">Risk note shown before choosing:</span>{" "}
              {action.riskNote}
            </p>
          )}
        </div>
      </Section>

      <Section
        title={
          action.variants?.length
            ? `${RESPONSE_HEADING[action.category]} (usual)`
            : RESPONSE_HEADING[action.category]
        }
        visibility="students"
      >
        <ResultView
          definition={definition}
          result={action.result}
          title={action.label}
          {...(start ? { heartRate: start.hr } : {})}
        />
        {hasTokens && start && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            <span className="font-bold">On arrival this reads:</span> “
            {interpolateVitals(action.result.content, start)}”
          </p>
        )}
      </Section>

      {isTreat && effect}
      {isTreat && assessmentBlock}

      {action.variants?.length ? (
        <Section title="Different responses depending on the patient's state" visibility="students">
          <p className="mb-2 text-[13px] text-muted-foreground">
            Checked in this order when the action is completed; the first that matches replaces the
            usual response.
          </p>
          <ol className="space-y-3">
            {action.variants.map((variant, index) => {
              const merged = { ...action.result, ...variant.result };
              return (
                <li key={index} className="rounded-2xl bg-[#f7f5fc] p-3 ring-1 ring-[#e6e0f5]">
                  <p className="mb-2 flex items-start gap-2 text-sm font-extrabold">
                    <GitBranch aria-hidden className="mt-0.5 size-4 shrink-0 text-[#5a44b5]" />
                    <span>
                      {index + 1}. When {describeCondition(definition, variant.when).join(", and ")}
                      :
                    </span>
                  </p>
                  <ResultView
                    definition={definition}
                    result={merged}
                    title={`${action.label} — alternative ${index + 1}`}
                    {...(start ? { heartRate: start.hr } : {})}
                  />
                  {variant.vitalsEffect && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-bold">Effect instead of the usual:</span>
                      <DeltaChips delta={variant.vitalsEffect} empty="No change" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}

      {showMeaning && (
        <Section title="Clinical significance" visibility="reviewers">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Clue type</dt>
              <dd className="mt-1 space-y-1">
                <ClueTag action={action} />
                <span className="block text-[13px] text-muted-foreground">
                  {CLUE_META[action.clueTier].description}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Key clue</dt>
              <dd className="mt-1 text-sm font-bold">{action.isKeyClue ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Supports</dt>
              <dd className="mt-1">
                <DiagnosisList definition={definition} ids={action.supports} />
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Argues against</dt>
              <dd className="mt-1">
                <DiagnosisList definition={definition} ids={action.against} />
              </dd>
            </div>
          </dl>
        </Section>
      )}

      {!isTreat && effect}
      {!isTreat && assessmentBlock}
    </>
  );
}

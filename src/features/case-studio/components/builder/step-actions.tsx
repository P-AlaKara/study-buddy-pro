import { useEffect, useState } from "react";
import { Lightbulb, Plus, Search } from "lucide-react";
import type { ActionCategory, CaseAction, MedicalCase } from "@/features/case-challenge/schema";
import {
  actionReferences,
  addAction,
  duplicateAction,
  moveAction,
  removeAction,
  updateActionWithLabel,
} from "../../case-edits";
import type { StudioCheck } from "../../issue-guide";
import {
  BUILD_STEP_META,
  CATEGORY_META,
  CATEGORY_STEP,
  GROUP_PRESETS,
  UNGROUPED,
} from "../../vocabulary";
import { Button, EmptyState, Panel, PanelHeading, Tag, useConfirm } from "../studio-ui";
import { groupActions, useStableKeys, useWorkspace } from "../workspace-context";
import { ActionCard } from "./action-editor";
import { ImageLibrary } from "./image-library";

const TIPS: Record<ActionCategory, string> = {
  ask: "Include questions that reveal the key clues, the ones that point to the tempting diagnosis, and a red herring or two.",
  examine:
    "Give each finding its own action when inspection, palpation, percussion and auscultation say different things.",
  test: "Offer the tests a student might reasonably order, including unnecessary ones. Lab values need reference ranges.",
  treat:
    "Add what helps, what harms and the tempting wrong treatments. Students choose from all of them.",
};

/** Confirm deleting an action, listing what else in the case uses it. */
export async function confirmDeleteAction(
  confirm: ReturnType<typeof useConfirm>,
  definition: MedicalCase,
  action: CaseAction,
): Promise<boolean> {
  const noun = CATEGORY_META[action.category].noun;
  const references = actionReferences(definition, action.id);
  return confirm({
    title: `Delete “${action.label || `this ${noun}`}”?`,
    confirmLabel: `Delete ${noun}`,
    description: (
      <div className="space-y-2">
        <p>This cannot be undone.</p>
        {references.length > 0 && (
          <>
            <p className="font-bold text-foreground">Other parts of the case use it:</p>
            <ul className="list-disc space-y-1 pl-5">
              {references.map((reference, index) => (
                <li key={index}>{reference.text}</li>
              ))}
            </ul>
            {references.some((reference) => reference.needsAttention) && (
              <p>Those links will be flagged so you can update them.</p>
            )}
          </>
        )}
      </div>
    ),
  });
}

/** Apply an action edit, keeping its card's React key when the label renames its id. */
export function applyActionChange(
  definition: MedicalCase,
  id: string,
  next: CaseAction,
  rename: (from: string, to: string) => void,
): MedicalCase {
  const index = definition.actions.findIndex((action) => action.id === id);
  const updated = updateActionWithLabel(definition, id, next);
  const newId = updated.actions[index]?.id;
  if (newId && newId !== id) rename(id, newId);
  return updated;
}

function focusLabel(id: string) {
  window.setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>(`#studio-label-${CSS.escape(id)} input`);
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }, 60);
}

export function BuilderActionsStep({
  definition,
  category,
  checks,
  onChange,
  onAddImage,
}: {
  definition: MedicalCase;
  category: ActionCategory;
  checks: StudioCheck[];
  onChange: (next: MedicalCase) => void;
  onAddImage: () => void;
}) {
  const confirm = useConfirm();
  const meta = CATEGORY_META[category];
  const step = CATEGORY_STEP[category];
  const keys = useStableKeys();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const actions = definition.actions.filter((action) => action.category === category);
  const { focus } = useWorkspace();
  useEffect(() => {
    if (focus?.actionId) setQuery("");
  }, [focus]);
  const groups = groupActions(definition.actions, category)
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) =>
        `${action.label} ${action.result.content}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.actions.length);

  const setOpenFor = (id: string, next?: boolean) =>
    setOpen((current) => {
      const key = keys.keyFor(id);
      const copy = new Set(current);
      if (next ?? !copy.has(key)) copy.add(key);
      else copy.delete(key);
      return copy;
    });

  function add(group: string | undefined, afterId?: string) {
    const result = addAction(
      definition,
      category,
      group === UNGROUPED ? undefined : group,
      afterId,
    );
    onChange(result.definition);
    setOpenFor(result.id, true);
    setQuery("");
    focusLabel(result.id);
  }

  function changeAction(id: string, next: CaseAction) {
    onChange(applyActionChange(definition, id, next, keys.rename));
  }

  async function remove(action: CaseAction) {
    if (await confirmDeleteAction(confirm, definition, action)) {
      onChange(removeAction(definition, action.id));
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META[step].title}
          description={BUILD_STEP_META[step].blurb}
          aside={
            <>
              <Tag tone="accent">
                {actions.length} {actions.length === 1 ? meta.noun : meta.plural}
              </Tag>
              <Button tone="primary" onClick={() => add(undefined)}>
                <Plus aria-hidden className="size-4" /> {meta.addLabel}
              </Button>
            </>
          }
        />
        <p className="flex items-start gap-2 rounded-2xl bg-yellow-soft/70 px-3 py-2.5 text-[13px] leading-relaxed text-[#5c4300]">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0" />
          {TIPS[category]}
        </p>
        {actions.length > 6 && (
          <label className="relative mt-3 block">
            <span className="sr-only">Find a {meta.noun}</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Find a ${meta.noun}…`}
              className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#7c63e0] focus:ring-2 focus:ring-[#7c63e0]/25"
            />
          </label>
        )}
      </Panel>

      {actions.length === 0 ? (
        <EmptyState
          title={meta.emptyTitle}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {GROUP_PRESETS[category].slice(0, 4).map((group) => (
                <Button key={group} tone="quiet" size="sm" onClick={() => add(group)}>
                  <Plus aria-hidden className="size-3.5" /> {group}
                </Button>
              ))}
            </div>
          }
        >
          {meta.emptyBody} Pick a heading to start:
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing matches">Try a different search.</EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.name} aria-label={group.name} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
              <h3 className="font-display text-base font-black text-ink-soft">{group.name}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-extrabold">
                {group.actions.length}
              </span>
              <Button
                size="sm"
                tone="ghost"
                className="ml-auto"
                onClick={() => add(group.name, group.actions.at(-1)?.id)}
              >
                <Plus aria-hidden className="size-3.5" /> Add here
              </Button>
            </div>
            {group.actions.map((action, index) => (
              <ActionCard
                key={keys.keyFor(action.id)}
                definition={definition}
                action={action}
                open={open.has(keys.keyFor(action.id))}
                onToggle={(next) => setOpenFor(action.id, next)}
                checks={checks.filter((check) => check.actionId === action.id)}
                onActionChange={(next) => changeAction(action.id, next)}
                onCaseChange={(change) => onChange(change(definition))}
                onMove={(direction) => onChange(moveAction(definition, action.id, direction, true))}
                canMoveUp={index > 0}
                canMoveDown={index < group.actions.length - 1}
                onDuplicate={() => {
                  const result = duplicateAction(definition, action.id);
                  if (!result) return;
                  onChange(result.definition);
                  setOpenFor(result.id, true);
                  focusLabel(result.id);
                }}
                onDelete={() => void remove(action)}
                onAddAfter={() => add(action.group, action.id)}
                onAddImage={onAddImage}
              />
            ))}
          </section>
        ))
      )}

      {category === "test" && <ImageLibrary definition={definition} onChange={onChange} />}
    </div>
  );
}

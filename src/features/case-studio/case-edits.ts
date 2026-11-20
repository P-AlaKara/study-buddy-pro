import type {
  ActionCategory,
  ActionSafetyGate,
  CaseAction,
  CaseAsset,
  DeteriorationRule,
  MedicalCase,
  ResultVariant,
} from "@/features/case-challenge/schema";
import { blankAction } from "./drafts";

/*
 * Immutable edits for a case draft.
 *
 * Creators never see internal ids, so anything that changes or removes one
 * must keep the rest of the case consistent:
 * - a rename rewrites every reference, so it can never break the case;
 * - a removal only drops references whose removal cannot change clinical
 *   behaviour (a required-treatment entry, a debrief line). References that
 *   would change behaviour if silently dropped — a safety prerequisite, the
 *   condition of an alternative response, the action that prevents a
 *   deterioration — are left in place so the validator flags them and the
 *   creator decides.
 */

/* ---- Ids ------------------------------------------------------------------ */

export function slugifyId(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
    .replace(/_+$/g, "");
  return slug || fallback;
}

export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

const PLACEHOLDER_ACTION_ID = /^(ask|examine|test|treat)_new(_\d+)?$/;

/**
 * Whether an id was generated from the label (or is still a placeholder), so
 * it can follow the label as the creator edits it. Hand-written ids — every
 * shipped case uses them — are never touched.
 */
export function idFollowsLabel(id: string, label: string, fallback: string): boolean {
  if (!id || PLACEHOLDER_ACTION_ID.test(id)) return true;
  const slug = slugifyId(label, fallback);
  return id === slug || new RegExp(`^${slug}_\\d+$`).test(id);
}

/* ---- Actions -------------------------------------------------------------- */

function mapGate(
  gate: ActionSafetyGate | undefined,
  map: (ids: string[]) => string[],
): ActionSafetyGate | undefined {
  if (!gate) return gate;
  const next: ActionSafetyGate = { ...gate };
  if (gate.anyActionIds) next.anyActionIds = map(gate.anyActionIds);
  if (gate.allActionIds) next.allActionIds = map(gate.allActionIds);
  if (gate.supportingActionThreshold) {
    next.supportingActionThreshold = {
      ...gate.supportingActionThreshold,
      actionIds: map(gate.supportingActionThreshold.actionIds),
    };
  }
  return next;
}

function mapVariants(
  variants: ResultVariant[] | undefined,
  mapActions: (ids: string[]) => string[],
  mapRules: (ids: string[]) => string[],
): ResultVariant[] | undefined {
  if (!variants) return variants;
  return variants.map((variant) => {
    const when = { ...variant.when };
    if (when.afterActions) when.afterActions = mapActions(when.afterActions);
    if (when.notAfterActions) when.notAfterActions = mapActions(when.notAfterActions);
    if (when.afterDeterioration) when.afterDeterioration = mapRules(when.afterDeterioration);
    return { ...variant, when };
  });
}

function withOptional<T extends object, K extends keyof T>(value: T, key: K, next: T[K]): T {
  const copy = { ...value };
  if (next === undefined) delete copy[key];
  else copy[key] = next;
  return copy;
}

export function renameActionId(definition: MedicalCase, from: string, to: string): MedicalCase {
  if (from === to) return definition;
  const swap = (ids: string[]) => ids.map((id) => (id === from ? to : id));
  const debrief = { ...definition.solution.harmfulActionDebrief };
  if (from in debrief) {
    debrief[to] = debrief[from] ?? "";
    delete debrief[from];
  }
  return {
    ...definition,
    actions: definition.actions.map((action) => {
      let next: CaseAction = action.id === from ? { ...action, id: to } : { ...action };
      next = withOptional(next, "safeWhen", mapGate(action.safeWhen, swap));
      next = withOptional(
        next,
        "variants",
        mapVariants(action.variants, swap, (ids) => ids),
      );
      return next;
    }),
    deteriorationRules: definition.deteriorationRules.map((rule) =>
      rule.action === from ? { ...rule, action: to } : rule,
    ),
    solution: {
      ...definition.solution,
      keyTreatment: swap(definition.solution.keyTreatment),
      harmfulActionDebrief: debrief,
    },
  };
}

export function renameRuleId(definition: MedicalCase, from: string, to: string): MedicalCase {
  if (from === to) return definition;
  const swap = (ids: string[]) => ids.map((id) => (id === from ? to : id));
  return {
    ...definition,
    deteriorationRules: definition.deteriorationRules.map((rule) =>
      rule.id === from ? { ...rule, id: to } : rule,
    ),
    actions: definition.actions.map((action) =>
      withOptional(
        action,
        "variants",
        mapVariants(action.variants, (ids) => ids, swap),
      ),
    ),
  };
}

export function renameDiagnosisId(definition: MedicalCase, from: string, to: string): MedicalCase {
  if (from === to) return definition;
  const swap = (ids: string[]) => ids.map((id) => (id === from ? to : id));
  return {
    ...definition,
    differential: definition.differential.map((item) =>
      item.id === from ? { ...item, id: to } : item,
    ),
    actions: definition.actions.map((action) => ({
      ...action,
      supports: swap(action.supports),
      against: swap(action.against),
    })),
    solution: {
      ...definition.solution,
      diagnosisId: definition.solution.diagnosisId === from ? to : definition.solution.diagnosisId,
    },
  };
}

export interface Reference {
  /** Plain-language description of where the id is used. */
  text: string;
  /** Removing the target leaves this reference for the creator to fix. */
  needsAttention: boolean;
}

export function actionReferences(definition: MedicalCase, id: string): Reference[] {
  const refs: Reference[] = [];
  if (definition.solution.keyTreatment.includes(id)) {
    refs.push({
      text: "It is a required treatment (it will be removed from that list).",
      needsAttention: false,
    });
  }
  for (const rule of definition.deteriorationRules) {
    if (rule.action === id) {
      refs.push({
        text: `It prevents the deterioration at minute ${rule.ifNotDoneBy} (“${rule.alertLine || "untitled event"}”).`,
        needsAttention: true,
      });
    }
  }
  for (const action of definition.actions) {
    if (action.id === id) continue;
    const gate = action.safeWhen;
    const gateIds = [
      ...(gate?.allActionIds ?? []),
      ...(gate?.anyActionIds ?? []),
      ...(gate?.supportingActionThreshold?.actionIds ?? []),
    ];
    if (gateIds.includes(id)) {
      refs.push({
        text: `It is part of the safety condition for “${action.label || "an untitled action"}”.`,
        needsAttention: true,
      });
    }
    if (
      action.variants?.some(
        (variant) =>
          variant.when.afterActions?.includes(id) || variant.when.notAfterActions?.includes(id),
      )
    ) {
      refs.push({
        text: `An alternative response of “${action.label || "an untitled action"}” depends on it.`,
        needsAttention: true,
      });
    }
  }
  return refs;
}

export function removeAction(definition: MedicalCase, id: string): MedicalCase {
  const debrief = { ...definition.solution.harmfulActionDebrief };
  delete debrief[id];
  return {
    ...definition,
    actions: definition.actions.filter((action) => action.id !== id),
    solution: {
      ...definition.solution,
      keyTreatment: definition.solution.keyTreatment.filter((item) => item !== id),
      harmfulActionDebrief: debrief,
    },
  };
}

export function actionIdSet(definition: MedicalCase): Set<string> {
  return new Set(definition.actions.map((action) => action.id));
}

/** A new, empty action filed under `group`, inserted after `afterId` (or at the end of its category). */
export function addAction(
  definition: MedicalCase,
  category: ActionCategory,
  group: string | undefined,
  afterId?: string,
): { definition: MedicalCase; id: string } {
  const id = uniqueId(`${category}_new`, actionIdSet(definition));
  const action: CaseAction = { ...blankAction(category, id), ...(group ? { group } : {}) };
  const actions = [...definition.actions];
  let index = afterId ? actions.findIndex((item) => item.id === afterId) : -1;
  if (index === -1) {
    // After the last action of the same category, so the student tray keeps its order.
    index = actions.reduce((last, item, i) => (item.category === category ? i : last), -1);
    if (index === -1) index = actions.length - 1;
  }
  actions.splice(index + 1, 0, action);
  return { definition: { ...definition, actions }, id };
}

export function duplicateAction(
  definition: MedicalCase,
  id: string,
): { definition: MedicalCase; id: string } | null {
  const source = definition.actions.find((action) => action.id === id);
  if (!source) return null;
  const label = `${source.label} (copy)`;
  const newId = uniqueId(slugifyId(label, `${source.category}_new`), actionIdSet(definition));
  const copy: CaseAction = { ...structuredClone(source), id: newId, label };
  const actions = [...definition.actions];
  actions.splice(actions.indexOf(source) + 1, 0, copy);
  const debriefLine = definition.solution.harmfulActionDebrief[id];
  return {
    id: newId,
    definition: {
      ...definition,
      actions,
      solution: {
        ...definition.solution,
        harmfulActionDebrief:
          debriefLine === undefined
            ? definition.solution.harmfulActionDebrief
            : { ...definition.solution.harmfulActionDebrief, [newId]: debriefLine },
      },
    },
  };
}

/**
 * Move an action up or down past the nearest action that shares its category
 * (and, when `sameGroup`, its group), keeping every other action in place.
 */
export function moveAction(
  definition: MedicalCase,
  id: string,
  direction: -1 | 1,
  sameGroup: boolean,
): MedicalCase {
  const actions = [...definition.actions];
  const index = actions.findIndex((action) => action.id === id);
  const action = actions[index];
  if (!action) return definition;
  let target = index + direction;
  while (target >= 0 && target < actions.length) {
    const candidate = actions[target]!;
    if (
      candidate.category === action.category &&
      (!sameGroup || (candidate.group ?? "") === (action.group ?? ""))
    ) {
      break;
    }
    target += direction;
  }
  if (target < 0 || target >= actions.length) return definition;
  actions[index] = actions[target]!;
  actions[target] = action;
  return { ...definition, actions };
}

export function replaceAction(definition: MedicalCase, id: string, next: CaseAction): MedicalCase {
  let updated = definition;
  if (next.id !== id) updated = renameActionId(updated, id, next.id);
  return {
    ...updated,
    actions: updated.actions.map((action) => (action.id === next.id ? next : action)),
  };
}

/**
 * Apply an edit to an action and, if its id still follows its label, rename
 * it (with every reference) to match the new label.
 */
export function updateActionWithLabel(
  definition: MedicalCase,
  id: string,
  next: CaseAction,
): MedicalCase {
  const previous = definition.actions.find((action) => action.id === id);
  if (!previous) return definition;
  let candidate = next;
  if (
    next.label !== previous.label &&
    next.label.trim() &&
    idFollowsLabel(previous.id, previous.label, `${previous.category}_new`)
  ) {
    const taken = actionIdSet(definition);
    taken.delete(previous.id);
    candidate = { ...next, id: uniqueId(slugifyId(next.label, `${next.category}_new`), taken) };
  }
  return replaceAction(definition, id, candidate);
}

export function setKeyTreatment(definition: MedicalCase, id: string, on: boolean): MedicalCase {
  const current = definition.solution.keyTreatment;
  const keyTreatment = on
    ? current.includes(id)
      ? current
      : [...current, id]
    : current.filter((item) => item !== id);
  return { ...definition, solution: { ...definition.solution, keyTreatment } };
}

export function setDebriefLine(definition: MedicalCase, id: string, text: string): MedicalCase {
  return {
    ...definition,
    solution: {
      ...definition.solution,
      harmfulActionDebrief: { ...definition.solution.harmfulActionDebrief, [id]: text },
    },
  };
}

/* ---- Deterioration rules --------------------------------------------------- */

export function ruleReferences(definition: MedicalCase, id: string): Reference[] {
  return definition.actions
    .filter((action) =>
      action.variants?.some((variant) => variant.when.afterDeterioration?.includes(id)),
    )
    .map((action) => ({
      text: `An alternative response of “${action.label || "an untitled action"}” depends on it.`,
      needsAttention: true,
    }));
}

export function addRule(definition: MedicalCase): { definition: MedicalCase; id: string } {
  const id = uniqueId("event", new Set(definition.deteriorationRules.map((rule) => rule.id)));
  const rule: DeteriorationRule = {
    id,
    ifNotDoneBy: 10,
    action: "",
    effect: {},
    alertLine: "",
    source: "nurse",
    triggersEvent: "",
  };
  return {
    id,
    definition: { ...definition, deteriorationRules: [...definition.deteriorationRules, rule] },
  };
}

/* ---- Differential ---------------------------------------------------------- */

export function addDiagnosis(definition: MedicalCase): MedicalCase {
  const id = uniqueId("diagnosis", new Set(definition.differential.map((item) => item.id)));
  return {
    ...definition,
    differential: [
      ...definition.differential,
      { id, label: "", isCorrect: false, isTempting: false },
    ],
  };
}

export function updateDiagnosisLabel(
  definition: MedicalCase,
  id: string,
  label: string,
): MedicalCase {
  const item = definition.differential.find((entry) => entry.id === id);
  if (!item) return definition;
  let updated = definition;
  let nextId = id;
  if (
    label.trim() &&
    (/^diagnosis(_\d+)?$/.test(id) || idFollowsLabel(id, item.label, "diagnosis"))
  ) {
    const taken = new Set(definition.differential.map((entry) => entry.id));
    taken.delete(id);
    nextId = uniqueId(slugifyId(label, "diagnosis"), taken);
    updated = renameDiagnosisId(updated, id, nextId);
  }
  return {
    ...updated,
    differential: updated.differential.map((entry) =>
      entry.id === nextId ? { ...entry, label } : entry,
    ),
  };
}

export function removeDiagnosis(definition: MedicalCase, id: string): MedicalCase {
  const drop = (ids: string[]) => ids.filter((item) => item !== id);
  return {
    ...definition,
    differential: definition.differential.filter((item) => item.id !== id),
    actions: definition.actions.map((action) => ({
      ...action,
      supports: drop(action.supports),
      against: drop(action.against),
    })),
    solution: {
      ...definition.solution,
      diagnosisId: definition.solution.diagnosisId === id ? "" : definition.solution.diagnosisId,
    },
  };
}

export function setCorrectDiagnosis(definition: MedicalCase, id: string): MedicalCase {
  return {
    ...definition,
    differential: definition.differential.map((item) => ({ ...item, isCorrect: item.id === id })),
    solution: { ...definition.solution, diagnosisId: id },
  };
}

export function setTemptingDiagnosis(definition: MedicalCase, id: string): MedicalCase {
  return {
    ...definition,
    differential: definition.differential.map((item) => ({
      ...item,
      isTempting: item.id === id,
    })),
  };
}

/* ---- Images ---------------------------------------------------------------- */

export function blankAsset(definition: MedicalCase): CaseAsset {
  return {
    id: uniqueId("image", new Set(definition.assets.map((asset) => asset.id))),
    filename: "",
    sourceUrl: "",
    author: "",
    license: "",
    requiredAttributionText: "",
    altText: "",
    isPlaceholder: false,
  };
}

export function assetUsers(definition: MedicalCase, assetId: string): CaseAction[] {
  return definition.actions.filter(
    (action) =>
      action.result.assetId === assetId ||
      action.variants?.some((variant) => variant.result.assetId === assetId),
  );
}

/** Keep the asset id in step with the file name while the id is still generated. */
export function updateAsset(definition: MedicalCase, id: string, next: CaseAsset): MedicalCase {
  let candidate = next;
  const previous = definition.assets.find((asset) => asset.id === id);
  if (
    previous &&
    next.filename !== previous.filename &&
    next.filename.trim() &&
    (/^image(_\d+)?$/.test(previous.id) ||
      idFollowsLabel(previous.id, previous.filename.replace(/\.[a-z0-9]+$/i, ""), "image"))
  ) {
    const taken = new Set(definition.assets.map((asset) => asset.id));
    taken.delete(previous.id);
    candidate = {
      ...next,
      id: uniqueId(slugifyId(next.filename.replace(/\.[a-z0-9]+$/i, ""), "image"), taken),
    };
  }
  const renamed = candidate.id !== id;
  return {
    ...definition,
    assets: definition.assets.map((asset) => (asset.id === id ? candidate : asset)),
    actions: renamed
      ? definition.actions.map((action) => ({
          ...action,
          result:
            action.result.assetId === id
              ? { ...action.result, assetId: candidate.id }
              : action.result,
          ...(action.variants
            ? {
                variants: action.variants.map((variant) =>
                  variant.result.assetId === id
                    ? { ...variant, result: { ...variant.result, assetId: candidate.id } }
                    : variant,
                ),
              }
            : {}),
        }))
      : definition.actions,
  };
}

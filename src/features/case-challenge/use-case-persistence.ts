import type { GameState } from "./engine.js";
import type { MedicalCase } from "./schema.js";

const STORAGE_PREFIX = "medley.case-encounter.v1:";
const SCHEMA_VERSION = 1 as const;

interface PersistedEncounter {
  schema: typeof SCHEMA_VERSION;
  game: GameState;
  notes: string;
}

function storageKey(caseId: string): string {
  return `${STORAGE_PREFIX}${caseId}`;
}

/**
 * Restore a saved encounter (full `GameState` + clinical notes) for a case.
 * Returns null when nothing valid is stored — unknown case, schema drift,
 * blocked/unavailable storage, or on the server. The orchestrator drives restore
 * from a single effect (never a render initializer) so the SSR markup and the
 * first client render stay identical and hydration never mismatches.
 */
/**
 * Whether a saved game still fits the case as it is now. Cases are edited and
 * republished in the case studio; a save that refers to an action, diagnosis
 * or deterioration event that no longer exists cannot be resumed safely.
 */
function fitsCase(game: GameState, definition: MedicalCase): boolean {
  const actions = new Set(definition.actions.map((action) => action.id));
  const diagnoses = new Set(definition.differential.map((item) => item.id));
  const rules = new Set(definition.deteriorationRules.map((rule) => rule.id));
  return (
    game.completedActions.every((entry) => actions.has(entry.actionId)) &&
    game.discoveredEvidence.every((entry) => actions.has(entry.actionId)) &&
    game.harmfulActionIds.every((id) => actions.has(id)) &&
    game.committedTreatmentIds.every((id) => actions.has(id)) &&
    game.differential.every((entry) => diagnoses.has(entry.diagnosisId)) &&
    (game.committedDiagnosisId === null || diagnoses.has(game.committedDiagnosisId)) &&
    game.appliedDeteriorationRuleIds.every((id) => rules.has(id))
  );
}

export function loadEncounter(
  caseId: string,
  definition?: MedicalCase,
): { game: GameState; notes: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEncounter;
    if (
      parsed?.schema !== SCHEMA_VERSION ||
      parsed.game?.version !== 1 ||
      parsed.game?.caseId !== caseId
    ) {
      return null;
    }
    if (definition && !fitsCase(parsed.game, definition)) return null;
    return { game: parsed.game, notes: parsed.notes ?? "" };
  } catch {
    return null;
  }
}

/** Persist the live encounter so a refresh resumes exactly where it left off. */
export function saveEncounter(caseId: string, game: GameState, notes: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedEncounter = { schema: SCHEMA_VERSION, game, notes };
    window.localStorage.setItem(storageKey(caseId), JSON.stringify(payload));
  } catch {
    // Private mode / quota / blocked storage — the simulator still works, the
    // encounter just won't survive a refresh.
  }
}

/** Remove a saved encounter (used when the student restarts a case). */
export function clearEncounter(caseId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(caseId));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

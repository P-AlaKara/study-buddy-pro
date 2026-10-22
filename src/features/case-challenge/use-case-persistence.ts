import type { GameState } from "./engine.js";

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
export function loadEncounter(caseId: string): { game: GameState; notes: string } | null {
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

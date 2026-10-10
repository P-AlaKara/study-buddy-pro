import type { GlobalRating, OsceResult } from "./engine.js";
import type { OsceMode } from "./schema.js";

export const OSCE_PROGRESS_STORAGE_KEY = "medley-osce-progress-v1";

export const OSCE_RATING_LABELS: Record<GlobalRating, string> = {
  clear_fail: "Clear Fail",
  borderline: "Borderline",
  pass: "Pass",
  good: "Good",
  excellent: "Excellent",
};

export interface OsceModeProgress {
  bestRating: GlobalRating;
  bestComposite: number;
  attempts: number;
  completedAt: string;
}

export interface OsceProgress {
  version: 1;
  stations: Record<string, Partial<Record<OsceMode, OsceModeProgress>>>;
}

export interface OsceProgressSummary {
  id: string;
  stationId: string;
  mode: OsceMode;
  score: number;
  attempts: number;
  completedAt: string;
}

type ProgressStorage = Pick<Storage, "getItem" | "setItem">;

const ratingRank: Record<GlobalRating, number> = {
  clear_fail: 0,
  borderline: 1,
  pass: 2,
  good: 3,
  excellent: 4,
};

export function emptyOsceProgress(): OsceProgress {
  return { version: 1, stations: {} };
}

function browserStorage(): ProgressStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function loadOsceProgress(storage: ProgressStorage | null = browserStorage()): OsceProgress {
  if (!storage) return emptyOsceProgress();
  try {
    const parsed = JSON.parse(storage.getItem(OSCE_PROGRESS_STORAGE_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return emptyOsceProgress();
    const candidate = parsed as Partial<OsceProgress>;
    if (candidate.version !== 1 || !candidate.stations || typeof candidate.stations !== "object") {
      return emptyOsceProgress();
    }
    return candidate as OsceProgress;
  } catch {
    return emptyOsceProgress();
  }
}

export function saveOsceResult(
  stationId: string,
  mode: OsceMode,
  result: OsceResult,
  storage: ProgressStorage | null = browserStorage(),
  completedAt = new Date().toISOString(),
): OsceProgress {
  const progress = loadOsceProgress(storage);
  const station = progress.stations[stationId] ?? {};
  const previous = station[mode];
  const isBetter =
    !previous ||
    ratingRank[result.rating] > ratingRank[previous.bestRating] ||
    (ratingRank[result.rating] === ratingRank[previous.bestRating] &&
      result.score.composite > previous.bestComposite);
  const nextMode: OsceModeProgress = {
    bestRating: isBetter ? result.rating : previous.bestRating,
    bestComposite: isBetter ? result.score.composite : previous.bestComposite,
    attempts: (previous?.attempts ?? 0) + 1,
    completedAt: isBetter ? completedAt : previous.completedAt,
  };
  const next: OsceProgress = {
    version: 1,
    stations: {
      ...progress.stations,
      [stationId]: { ...station, [mode]: nextMode },
    },
  };
  storage?.setItem(OSCE_PROGRESS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function recommendedOsceMode(
  stationProgress: Partial<Record<OsceMode, OsceModeProgress>> | undefined,
): OsceMode {
  if (!stationProgress?.learn) return "learn";
  if (!stationProgress.practice) return "practice";
  if (!stationProgress.exam) return "exam";
  return "exam";
}

export function listOsceProgress(progress: OsceProgress): OsceProgressSummary[] {
  const modes: readonly OsceMode[] = ["learn", "practice", "exam"];
  return Object.entries(progress.stations).flatMap(([stationId, station]) =>
    modes.flatMap((mode) => {
      const entry = station[mode];
      return entry
        ? [
            {
              id: `${stationId}:${mode}`,
              stationId,
              mode,
              score: entry.bestComposite,
              attempts: entry.attempts,
              completedAt: entry.completedAt,
            },
          ]
        : [];
    }),
  );
}

import { useCallback, useEffect, useState } from "react";
import type { ReviewStage } from "./vocabulary";

/*
 * Review progress: which sections a reviewer has worked through for a case,
 * kept in this browser and keyed by case id. Reviewers fix problems by editing
 * the case directly, so there are no notes or decisions to store; this only
 * powers the review checklist.
 */

const REVIEWS_KEY = "medley.case-studio.reviews.v1";

export interface ReviewRecord {
  caseId: string;
  reviewedStages: ReviewStage[];
  updatedAt: string;
}

type ReviewStore = Record<string, ReviewRecord>;

function readStore(): ReviewStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVIEWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Older records also carried notes and decisions; only the progress is kept.
    const store: ReviewStore = {};
    for (const [caseId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const stages = (value as { reviewedStages?: unknown })?.reviewedStages;
      store[caseId] = {
        caseId,
        reviewedStages: Array.isArray(stages) ? (stages as ReviewStage[]) : [],
        updatedAt: String((value as { updatedAt?: unknown })?.updatedAt ?? ""),
      };
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: ReviewStore): void {
  try {
    window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(store));
  } catch {
    // Progress is a convenience; the studio works without it.
  }
}

export function emptyReview(caseId: string): ReviewRecord {
  return { caseId, reviewedStages: [], updatedAt: new Date().toISOString() };
}

/** All review progress, persisted to this browser on every change. */
export function useReviewStore() {
  const [store, setStore] = useState<ReviewStore>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setStore(readStore());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) writeStore(store);
  }, [store, hydrated]);

  const update = useCallback((caseId: string, change: (record: ReviewRecord) => ReviewRecord) => {
    setStore((current) => ({
      ...current,
      [caseId]: {
        ...change(current[caseId] ?? emptyReview(caseId)),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);
  const remove = useCallback((caseId: string) => {
    setStore((current) => {
      const next = { ...current };
      delete next[caseId];
      return next;
    });
  }, []);
  return { store, update, remove, hydrated };
}

export type ReviewUpdate = (change: (record: ReviewRecord) => ReviewRecord) => void;

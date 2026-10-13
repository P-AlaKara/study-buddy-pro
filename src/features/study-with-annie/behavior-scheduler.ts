import type { Chattiness, QuizCandidate, QuizResult } from "./types";

export type BehaviorType = "quiz" | "commentary";

export type SchedulerConfig = {
  cooldownMs: Record<Chattiness, number>;
  jitterRatio: number;
  activeScrollWindowMs: number;
  meaningfulPageTimeMs: number;
  ignoredBeforeSlowdown: number;
  adaptiveCooldownMultiplier: number;
};

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  cooldownMs: { quiet: 8 * 60_000, normal: 4 * 60_000, chatty: 2 * 60_000 },
  jitterRatio: 0.3,
  activeScrollWindowMs: 2_000,
  meaningfulPageTimeMs: 35_000,
  ignoredBeforeSlowdown: 3,
  adaptiveCooldownMultiplier: 1.75,
};

export type SchedulerSnapshot = {
  currentPage: number;
  pageEnteredAt: number;
  lastScrollAt: number;
  typingNote: boolean;
  interactionOpen: boolean;
  silencedUntil: number | "session" | "forever" | null;
  chattiness: Chattiness;
  quizzesEnabled: boolean;
  commentaryEnabled: boolean;
  availableQuizPages: number[];
  availableCommentaryPages: number[];
};

export class BehaviorScheduler {
  private readonly config: SchedulerConfig;
  private readonly random: () => number;
  private lastInterruptionAt: number;
  private nextCooldownMs: number;
  private history: BehaviorType[] = [];
  private ignoredInARow = 0;
  private waitingForFirstCooldown = true;
  private lastChattiness: Chattiness = "normal";

  constructor(
    now = Date.now(),
    config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
    random: () => number = Math.random,
  ) {
    this.config = config;
    this.random = random;
    this.lastInterruptionAt = now;
    this.nextCooldownMs = 0;
  }

  private cooldown(chattiness: Chattiness) {
    const base = this.config.cooldownMs[chattiness];
    const jitter = 1 + (this.random() * 2 - 1) * this.config.jitterRatio;
    const adaptive =
      this.ignoredInARow >= this.config.ignoredBeforeSlowdown
        ? this.config.adaptiveCooldownMultiplier
        : 1;
    return base * jitter * adaptive;
  }

  private isSilenced(value: SchedulerSnapshot["silencedUntil"], now: number) {
    return value === "session" || value === "forever" || (typeof value === "number" && value > now);
  }

  next(snapshot: SchedulerSnapshot, now = Date.now()): BehaviorType | null {
    this.lastChattiness = snapshot.chattiness;
    if (this.waitingForFirstCooldown) {
      this.waitingForFirstCooldown = false;
      this.lastInterruptionAt = now;
      this.nextCooldownMs = this.cooldown(snapshot.chattiness);
      return null;
    }
    if (
      this.isSilenced(snapshot.silencedUntil, now) ||
      snapshot.typingNote ||
      snapshot.interactionOpen ||
      now - snapshot.lastScrollAt < this.config.activeScrollWindowMs ||
      now - this.lastInterruptionAt < this.nextCooldownMs
    ) {
      return null;
    }

    const options: BehaviorType[] = [];
    const onPageLongEnough = now - snapshot.pageEnteredAt >= this.config.meaningfulPageTimeMs;
    if (
      snapshot.quizzesEnabled &&
      onPageLongEnough &&
      snapshot.availableQuizPages.some((page) => page <= snapshot.currentPage)
    ) {
      options.push("quiz");
    }
    if (
      snapshot.commentaryEnabled &&
      snapshot.availableCommentaryPages.some((page) => page <= snapshot.currentPage)
    ) {
      options.push("commentary");
    }
    if (!options.length) return null;

    const lastTwo = this.history.slice(-2);
    const filtered =
      lastTwo.length === 2 && lastTwo[0] === lastTwo[1]
        ? options.filter((type) => type !== lastTwo[0])
        : options;
    if (!filtered.length) return null;

    const choice = filtered[Math.floor(this.random() * filtered.length)] ?? filtered[0]!;
    this.history.push(choice);
    this.history = this.history.slice(-4);
    this.lastInterruptionAt = now;
    this.nextCooldownMs = this.cooldown(snapshot.chattiness);
    return choice;
  }

  recordOutcome(outcome: "engaged" | "dismissed" | "ignored") {
    if (outcome === "engaged") {
      this.ignoredInARow = 0;
      this.nextCooldownMs = this.cooldown(this.lastChattiness);
    } else this.ignoredInARow += 1;
  }
}

export function pickWeightedQuizCandidate(
  candidates: QuizCandidate[],
  currentPage: number,
  random: () => number = Math.random,
): QuizCandidate | null {
  const reached = candidates.filter((candidate) => candidate.page <= currentPage);
  if (!reached.length) return null;

  const weighted = reached.map((candidate) => {
    const latest = candidate.attempts?.[0];
    let weight = candidate.page === currentPage ? 2 : 1;
    if (latest?.result === "incorrect" || latest?.result === "partially_correct") weight *= 3;
    if (latest?.result === "correct") {
      const age = Date.now() - new Date(latest.created_at).getTime();
      weight *= age < 24 * 60 * 60_000 ? 0.15 : 0.6;
    }
    return { candidate, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.candidate;
  }
  return weighted.at(-1)?.candidate ?? null;
}

export function resultCounts(results: QuizResult[]) {
  return {
    attempted: results.filter((result) => result !== "skipped").length,
    correct: results.filter((result) => result === "correct").length,
  };
}

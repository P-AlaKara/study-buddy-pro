import { CARD_STYLES, OSCE_CATEGORIES, POOR_TECHNIQUE_STYLES, type OsceStation } from "./schema.js";

export interface OsceValidationIssue {
  path: string;
  message: string;
}

const poorStyles = new Set<string>(POOR_TECHNIQUE_STYLES);

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateOsceStation(station: OsceStation): OsceValidationIssue[] {
  const issues: OsceValidationIssue[] = [];
  const cardIds = new Set(station.cards.map((card) => card.id));
  const cueIds = new Set(station.cues.map((cue) => cue.id));
  const factIds = new Set(Object.keys(station.facts));
  const checklistIds = new Set(station.checklist.map((item) => item.id));
  const validUnlockIds = new Set([...cardIds, ...cueIds]);

  if (station.clockSeconds <= 0 || station.readingSeconds < 0) {
    issues.push({
      path: "clockSeconds",
      message: "Station time must be positive and reading time cannot be negative.",
    });
  }
  if (
    station.idleDrift.startsAfterRealSeconds < 0 ||
    station.idleDrift.realSecondsPerSimulatedSecond <= 0
  ) {
    issues.push({
      path: "idleDrift",
      message: "Idle drift needs a non-negative delay and a positive real-to-simulated ratio.",
    });
  }
  if (
    station.curveball.triggerAtPercentClock <= 0 ||
    station.curveball.triggerAtPercentClock >= 100
  ) {
    issues.push({
      path: "curveball.triggerAtPercentClock",
      message: "The timed curveball trigger must be between 0 and 100 percent.",
    });
  }
  if (station.examinerQuestions.length !== 3) {
    issues.push({
      path: "examinerQuestions",
      message: "A station must have exactly three questions.",
    });
  }

  for (const id of duplicates(station.cards.map((card) => card.id))) {
    issues.push({ path: "cards", message: `Duplicate card ID: ${id}.` });
  }
  for (const id of duplicates(station.cues.map((cue) => cue.id))) {
    issues.push({ path: "cues", message: `Duplicate cue ID: ${id}.` });
  }
  for (const id of duplicates(station.checklist.map((item) => item.id))) {
    issues.push({ path: "checklist", message: `Duplicate checklist ID: ${id}.` });
  }

  for (const category of OSCE_CATEGORIES) {
    const count = station.cards.filter((card) => card.category === category).length;
    if (count < 6 || count > 12) {
      issues.push({
        path: `cards.${category}`,
        message: `Category must contain 6-12 cards; found ${count}.`,
      });
    }
  }

  for (const item of station.checklist) {
    if (!station.cards.some((card) => card.satisfies.includes(item.id))) {
      issues.push({
        path: `checklist.${item.id}`,
        message: "Checklist item is not satisfiable by any card.",
      });
    }
  }

  for (const cue of station.cues) {
    if (cue.windowActions < 1) {
      issues.push({
        path: `cues.${cue.id}.windowActions`,
        message: "A cue window must contain at least one student action.",
      });
    }
    if (!cue.pickupCardIds.length) {
      issues.push({ path: `cues.${cue.id}`, message: "Cue has no pickup cards." });
    }
    for (const pickupId of cue.pickupCardIds) {
      const pickup = station.cards.find((card) => card.id === pickupId);
      if (!pickup) {
        issues.push({
          path: `cues.${cue.id}.pickupCardIds`,
          message: `Unknown pickup card: ${pickupId}.`,
        });
      } else if (pickup.availableOnlyInWindowOfCue !== cue.id) {
        issues.push({
          path: `cards.${pickupId}.availableOnlyInWindowOfCue`,
          message: `Pickup card must use cue window ${cue.id}.`,
        });
      }
    }
    if (!cardIds.has(cue.idealResponseCardId)) {
      issues.push({
        path: `cues.${cue.id}.idealResponseCardId`,
        message: `Unknown ideal response card: ${cue.idealResponseCardId}.`,
      });
    }
    for (const requiredId of cue.requiresCardIds) {
      if (!cardIds.has(requiredId)) {
        issues.push({
          path: `cues.${cue.id}.requiresCardIds`,
          message: `Unknown required card: ${requiredId}.`,
        });
      }
    }
  }

  for (const failure of station.criticalFails) {
    if (!failure.triggeredBy.length) {
      issues.push({
        path: `criticalFails.${failure.id}`,
        message: "Critical fail is not triggerable.",
      });
      continue;
    }
    const validIds = failure.trigger === "action" ? cardIds : checklistIds;
    for (const triggerId of failure.triggeredBy) {
      if (!validIds.has(triggerId)) {
        issues.push({
          path: `criticalFails.${failure.id}.triggeredBy`,
          message: `Unknown ${failure.trigger === "action" ? "card" : "checklist"} ID: ${triggerId}.`,
        });
      }
    }
  }

  const poorCount = station.cards.filter((card) => poorStyles.has(card.style)).length;
  const poorRatio = poorCount / Math.max(1, station.cards.length);
  if (poorRatio < 0.3 || poorRatio > 0.4) {
    issues.push({
      path: "cards",
      message: `Poor-technique/distractor ratio must be 30-40%; found ${(poorRatio * 100).toFixed(1)}%.`,
    });
  }

  const modelRunIds = station.modelRun.map((step) => step.cardId);
  for (const cardId of modelRunIds) {
    if (!cardIds.has(cardId)) {
      issues.push({ path: "modelRun", message: `Model run references unknown card: ${cardId}.` });
    }
  }
  if (duplicates(modelRunIds).length) {
    issues.push({ path: "modelRun", message: "Model run must not repeat one-use cards." });
  }
  const modelRunSeconds = station.modelRun.reduce(
    (total, step) =>
      total + (station.cards.find((card) => card.id === step.cardId)?.timeCostSec ?? 0),
    0,
  );
  if (modelRunSeconds > station.clockSeconds * 0.95) {
    issues.push({
      path: "modelRun",
      message: `Model run takes ${modelRunSeconds}s, above 95% of the ${station.clockSeconds}s clock.`,
    });
  }

  const allUsefulSeconds = station.cards
    .filter((card) => card.satisfies.length > 0 && !poorStyles.has(card.style))
    .reduce((total, card) => total + card.timeCostSec, 0);
  if (allUsefulSeconds <= station.clockSeconds) {
    issues.push({
      path: "cards",
      message: `All useful cards total ${allUsefulSeconds}s and must exceed the ${station.clockSeconds}s clock.`,
    });
  }

  for (const card of station.cards) {
    if (!CARD_STYLES.includes(card.style)) {
      issues.push({
        path: `cards.${card.id}.style`,
        message: `Unknown card style: ${card.style}.`,
      });
    }
    if (card.timeCostSec <= 0) {
      issues.push({ path: `cards.${card.id}.timeCostSec`, message: "Time cost must be positive." });
    }
    for (const factId of card.revealsFacts) {
      if (!factIds.has(factId)) {
        issues.push({
          path: `cards.${card.id}.revealsFacts`,
          message: `Unknown fact ID: ${factId}.`,
        });
      }
    }
    for (const factId of card.conditionalFactReveal?.factIds ?? []) {
      if (!factIds.has(factId)) {
        issues.push({
          path: `cards.${card.id}.conditionalFactReveal`,
          message: `Unknown conditional fact ID: ${factId}.`,
        });
      }
    }
    for (const itemId of [...card.satisfies, ...card.penalises]) {
      if (!checklistIds.has(itemId)) {
        issues.push({ path: `cards.${card.id}`, message: `Unknown checklist ID: ${itemId}.` });
      }
    }
    for (const unlockId of card.unlockedBy) {
      if (!validUnlockIds.has(unlockId)) {
        issues.push({
          path: `cards.${card.id}.unlockedBy`,
          message: `Unknown unlock ID: ${unlockId}.`,
        });
      }
    }
    if (card.availableOnlyInWindowOfCue && !cueIds.has(card.availableOnlyInWindowOfCue)) {
      issues.push({
        path: `cards.${card.id}.availableOnlyInWindowOfCue`,
        message: `Unknown cue ID: ${card.availableOnlyInWindowOfCue}.`,
      });
    }
    if (card.triggersCue && !cueIds.has(card.triggersCue)) {
      issues.push({
        path: `cards.${card.id}.triggersCue`,
        message: `Unknown cue ID: ${card.triggersCue}.`,
      });
    }
  }

  for (const responseId of station.curveball.responseCardIds) {
    if (!cardIds.has(responseId)) {
      issues.push({
        path: "curveball.responseCardIds",
        message: `Unknown response card: ${responseId}.`,
      });
    }
  }
  for (const failureId of station.curveball.criticalFailCardIds) {
    if (!station.curveball.responseCardIds.includes(failureId)) {
      issues.push({
        path: "curveball.criticalFailCardIds",
        message: `Critical response is not a curveball option: ${failureId}.`,
      });
    }
  }
  const honestResponses = station.curveball.responseCardIds.filter(
    (id) =>
      station.cards.find((card) => card.id === id)?.curveballResponseKind === "honest_empathic",
  );
  if (honestResponses.length !== 1) {
    issues.push({
      path: "curveball.responseCardIds",
      message: `Exactly one honest-empathic response is required; found ${honestResponses.length}.`,
    });
  }

  station.examinerQuestions.forEach((question) => {
    const correctCount = question.options.filter((option) => option.correct).length;
    if (correctCount < 1) {
      issues.push({
        path: `examinerQuestions.${question.id}`,
        message: "Question has no correct answer.",
      });
    }
    if (question.type === "single" && correctCount !== 1) {
      issues.push({
        path: `examinerQuestions.${question.id}`,
        message: "Single-choice question must have exactly one correct answer.",
      });
    }
  });

  const weights = station.ratingThresholds.componentWeights;
  if (Object.values(weights).reduce((total, weight) => total + weight, 0) !== 1) {
    issues.push({
      path: "ratingThresholds.componentWeights",
      message: "Component weights must sum to 1.",
    });
  }
  if (!(
    station.ratingThresholds.borderline < station.ratingThresholds.pass &&
    station.ratingThresholds.pass < station.ratingThresholds.good &&
    station.ratingThresholds.good < station.ratingThresholds.excellent
  )) {
    issues.push({ path: "ratingThresholds", message: "Rating thresholds must increase in order." });
  }
  const communicationCaps = station.ratingThresholds.communicationCaps;
  if (
    communicationCaps.borderlineIfRapportBelow < 0 ||
    communicationCaps.borderlineIfRapportBelow > 100 ||
    communicationCaps.borderlineIfCommunicationBelow < 0 ||
    communicationCaps.borderlineIfCommunicationBelow > 100
  ) {
    issues.push({
      path: "ratingThresholds.communicationCaps",
      message: "Communication rating caps must be percentages from 0 to 100.",
    });
  }

  station.nudges.forEach((nudge, index) => {
    if (nudge.tier !== index + 1 || nudge.pointCost < 0) {
      issues.push({
        path: `nudges.${index}`,
        message: "Nudges must be tiers 1-3 with non-negative costs.",
      });
    }
  });

  return issues;
}

export function assertValidOsceStation(station: OsceStation): void {
  const issues = validateOsceStation(station);
  if (!issues.length) return;
  throw new Error(
    `Invalid OSCE station ${station.id}:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`,
  );
}

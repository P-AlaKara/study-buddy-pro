import type { OsceStation } from "../src/features/osce/schema.js";
import { CHEST_TIGHTNESS_STATION } from "../src/features/osce/stations/chest-tightness-on-the-stairs.js";
import { validateOsceStation } from "../src/features/osce/validator.js";

function cloneStation(): OsceStation {
  return structuredClone(CHEST_TIGHTNESS_STATION);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectIssue(station: OsceStation, text: string): void {
  const messages = validateOsceStation(station).map((issue) => issue.message);
  assert(
    messages.some((message) => message.includes(text)),
    `Expected validator issue containing “${text}”. Received:\n${messages.join("\n")}`,
  );
}

assert(
  validateOsceStation(CHEST_TIGHTNESS_STATION).length === 0,
  "Authored station must be valid.",
);

{
  const station = cloneStation();
  for (const card of station.cards)
    card.satisfies = card.satisfies.filter((id) => id !== "hx_site");
  expectIssue(station, "Checklist item is not satisfiable");
}

{
  const station = cloneStation();
  station.cues[0]!.pickupCardIds = [];
  expectIssue(station, "Cue has no pickup cards");
}

{
  const station = cloneStation();
  station.criticalFails[0]!.triggeredBy = [];
  expectIssue(station, "Critical fail is not triggerable");
}

{
  const station = cloneStation();
  for (const card of station.cards) card.style = "open";
  expectIssue(station, "Poor-technique/distractor ratio");
}

{
  const station = cloneStation();
  station.cards.find((card) => card.id === station.modelRun[0]!.cardId)!.timeCostSec = 999;
  expectIssue(station, "above 95%");
}

{
  const station = cloneStation();
  for (const card of station.cards) {
    if (card.satisfies.length) card.timeCostSec = 1;
  }
  expectIssue(station, "must exceed");
}

{
  const station = cloneStation();
  station.cards[0]!.revealsFacts.push("missing_fact");
  expectIssue(station, "Unknown fact ID");
}

{
  const station = cloneStation();
  station.cards[0]!.unlockedBy.push("missing_card");
  expectIssue(station, "Unknown unlock ID");
}

{
  const station = cloneStation();
  const honest = station.cards.find((card) => card.curveballResponseKind === "honest_empathic")!;
  delete honest.curveballResponseKind;
  expectIssue(station, "Exactly one honest-empathic response");
}

console.log("OSCE validator tests passed.");

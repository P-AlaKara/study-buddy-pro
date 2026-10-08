import { OSCE_STATIONS } from "../src/features/osce/stations/index.js";
import { POOR_TECHNIQUE_STYLES } from "../src/features/osce/schema.js";
import { validateOsceStation } from "../src/features/osce/validator.js";

const issues = OSCE_STATIONS.flatMap((station) =>
  validateOsceStation(station).map((issue) => ({
    ...issue,
    path: `${station.id}.${issue.path}`,
  })),
);

if (issues.length) {
  for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
  process.exitCode = 1;
} else {
  const poorStyles = new Set<string>(POOR_TECHNIQUE_STYLES);
  for (const station of OSCE_STATIONS) {
    const poorCards = station.cards.filter((card) => poorStyles.has(card.style)).length;
    const modelSeconds = station.modelRun.reduce(
      (total, step) =>
        total + (station.cards.find((card) => card.id === step.cardId)?.timeCostSec ?? 0),
      0,
    );
    const usefulSeconds = station.cards
      .filter((card) => card.satisfies.length && !poorStyles.has(card.style))
      .reduce((total, card) => total + card.timeCostSec, 0);
    console.log(
      `Validated ${station.id}: ${station.cards.length} cards, ${((poorCards / station.cards.length) * 100).toFixed(1)}% poor/distractor, ${modelSeconds}s model run, ${usefulSeconds}s all useful cards, ${station.clockSeconds}s clock.`,
    );
  }
}

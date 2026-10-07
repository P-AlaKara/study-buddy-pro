import { CASE_BANK } from "./cases/index.js";
import { FEATURED_CASE_ID } from "./config.js";

const configuredCase = CASE_BANK.find(
  (caseDefinition) =>
    caseDefinition.id === FEATURED_CASE_ID || caseDefinition.slug === FEATURED_CASE_ID,
);

if (!configuredCase && import.meta.env.DEV) {
  console.warn(
    `[case-challenge] Featured case "${FEATURED_CASE_ID}" was not found; using the first available case.`,
  );
}

export const FEATURED_CASE = configuredCase ?? CASE_BANK[0];

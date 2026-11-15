import { theLongFlight } from "./the-long-flight.js";
import { theTearingPain } from "./the-tearing-pain.js";
import { theSweetBreath } from "./the-sweet-breath.js";
import { theMissedPeriod } from "./the-missed-period.js";
import type { MedicalCase } from "../schema.js";
import { validateCaseBank } from "../validator.js";

export const CASE_BANK = [
  theLongFlight,
  theTearingPain,
  theSweetBreath,
  theMissedPeriod,
] as const satisfies readonly MedicalCase[];

const validationIssues = validateCaseBank(CASE_BANK);
if (validationIssues.length) {
  throw new Error(
    `Invalid medical case bank:\n${validationIssues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n")}`,
  );
}

export function getCaseById(id: string): MedicalCase | undefined {
  return CASE_BANK.find((caseDefinition) => caseDefinition.id === id || caseDefinition.slug === id);
}

export { theLongFlight, theTearingPain, theSweetBreath, theMissedPeriod };

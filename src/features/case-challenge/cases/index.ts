import { theLongFlight } from "./the-long-flight.js";
import { theTearingPain } from "./the-tearing-pain.js";
import { theSweetBreath } from "./the-sweet-breath.js";
import { theMissedPeriod } from "./the-missed-period.js";
import type { MedicalCase } from "../schema.js";
import { validateCaseBank } from "../validator.js";

/*
 * Seed data and test fixtures only. The live case bank is in Supabase
 * (`public.clinical_cases`), authored in the case studio; these four cases
 * were copied into it by migration 20261120120000_clinical_case_bank.sql and
 * are kept so the engine tests have stable, known cases to play. The app must
 * not import them.
 */
export const SEED_CASES = [
  theLongFlight,
  theTearingPain,
  theSweetBreath,
  theMissedPeriod,
] as const satisfies readonly MedicalCase[];

const validationIssues = validateCaseBank(SEED_CASES);
if (validationIssues.length) {
  throw new Error(
    `Invalid seed cases:\n${validationIssues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n")}`,
  );
}

export { theLongFlight, theTearingPain, theSweetBreath, theMissedPeriod };

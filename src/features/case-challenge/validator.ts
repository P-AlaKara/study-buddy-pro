import { CLUE_TIERS, type CaseAsset, type MedicalCase } from "./schema.js";

export interface CaseValidationIssue {
  path: string;
  message: string;
}

const REQUIRED_CLUE_TIERS = ["obvious", "buried", "contradicting"] as const;

export function validateCase(caseDefinition: MedicalCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  const actionIds = new Set(caseDefinition.actions.map((action) => action.id));
  const diagnosisIds = new Set(caseDefinition.differential.map((diagnosis) => diagnosis.id));
  const assetIds = new Set(caseDefinition.assets.map((asset) => asset.id));

  if (caseDefinition.intro.trim().split(/\s+/).length > 40) {
    issues.push({ path: "intro", message: "Intro must be 40 words or fewer." });
  }

  for (const tier of REQUIRED_CLUE_TIERS) {
    if (!caseDefinition.actions.some((action) => action.clueTier === tier)) {
      issues.push({ path: "actions", message: `Missing a ${tier} clue.` });
    }
  }

  const correct = caseDefinition.differential.filter((diagnosis) => diagnosis.isCorrect);
  if (correct.length !== 1) {
    issues.push({ path: "differential", message: "Exactly one diagnosis must be correct." });
  }

  const tempting = caseDefinition.differential.filter((diagnosis) => diagnosis.isTempting);
  if (tempting.length !== 1) {
    issues.push({ path: "differential", message: "Exactly one diagnosis must be tempting." });
  }

  if (!diagnosisIds.has(caseDefinition.solution.diagnosisId)) {
    issues.push({
      path: "solution.diagnosisId",
      message: "Solution diagnosis is not on the differential.",
    });
  } else if (!correct.some((diagnosis) => diagnosis.id === caseDefinition.solution.diagnosisId)) {
    issues.push({
      path: "solution.diagnosisId",
      message: "Solution diagnosis is not marked correct.",
    });
  }

  const keyClues = caseDefinition.actions.filter((action) => action.isKeyClue);
  if (!keyClues.length) {
    issues.push({
      path: "actions",
      message: "At least one reachable action must expose a key clue.",
    });
  }

  for (const action of caseDefinition.actions) {
    if (!CLUE_TIERS.includes(action.clueTier)) {
      issues.push({ path: `actions.${action.id}.clueTier`, message: "Unknown clue tier." });
    }
    if (action.result.assetId && !assetIds.has(action.result.assetId)) {
      issues.push({
        path: `actions.${action.id}.result.assetId`,
        message: `Referenced asset ${action.result.assetId} is not in the case manifest.`,
      });
    }
    for (const diagnosisId of [...action.supports, ...action.against]) {
      if (!diagnosisIds.has(diagnosisId)) {
        issues.push({
          path: `actions.${action.id}`,
          message: `Referenced diagnosis ${diagnosisId} is not on the differential.`,
        });
      }
    }
    for (const requiredId of [
      ...(action.safeWhen?.anyActionIds ?? []),
      ...(action.safeWhen?.allActionIds ?? []),
      ...(action.safeWhen?.supportingActionThreshold?.actionIds ?? []),
    ]) {
      if (!actionIds.has(requiredId)) {
        issues.push({
          path: `actions.${action.id}.safeWhen`,
          message: `Safety prerequisite ${requiredId} is not a valid action.`,
        });
      }
    }
    const threshold = action.safeWhen?.supportingActionThreshold;
    if (
      threshold &&
      (threshold.minimumCompleted < 1 || threshold.minimumCompleted > threshold.actionIds.length)
    ) {
      issues.push({
        path: `actions.${action.id}.safeWhen.supportingActionThreshold`,
        message: "Supporting-action threshold must be reachable.",
      });
    }
  }

  for (const rule of caseDefinition.deteriorationRules) {
    if (!actionIds.has(rule.action)) {
      issues.push({
        path: `deteriorationRules.${rule.id}.action`,
        message: `Deterioration rule references unknown action ${rule.action}.`,
      });
    }
  }

  const assetFilenames = new Set<string>();
  for (const asset of caseDefinition.assets) {
    if (assetFilenames.has(asset.filename)) {
      issues.push({
        path: `assets.${asset.id}.filename`,
        message: "Asset filenames must be unique per case.",
      });
    }
    assetFilenames.add(asset.filename);
  }

  return issues;
}

export function validateCaseBank(caseBank: readonly MedicalCase[]): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const caseDefinition of caseBank) {
    if (ids.has(caseDefinition.id)) {
      issues.push({ path: caseDefinition.id, message: "Case IDs must be unique." });
    }
    if (slugs.has(caseDefinition.slug)) {
      issues.push({ path: caseDefinition.slug, message: "Case slugs must be unique." });
    }
    ids.add(caseDefinition.id);
    slugs.add(caseDefinition.slug);
    issues.push(
      ...validateCase(caseDefinition).map((issue) => ({
        ...issue,
        path: `${caseDefinition.slug}.${issue.path}`,
      })),
    );
  }

  return issues;
}

export function assetManifestFor(caseDefinition: MedicalCase): readonly CaseAsset[] {
  return caseDefinition.assets;
}

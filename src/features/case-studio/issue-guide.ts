import type { ActionCategory, MedicalCase } from "@/features/case-challenge/schema";
import { consistencyFindings, ruleTitle } from "./case-analysis";
import { inspectCase, type StudioIssue } from "./drafts";
import {
  BUILD_STEP_META,
  BUILD_STEPS,
  CATEGORY_STEP,
  CLUE_META,
  type BuildStep,
} from "./vocabulary";

/*
 * Turns validator output into something a clinician can act on: a plain
 * sentence, the step it belongs to and the field to jump to. Unknown messages
 * fall back to the validator's own wording, so nothing is ever hidden.
 */

export type CheckSeverity = "error" | "warning" | "info";

export interface StudioCheck {
  key: string;
  severity: CheckSeverity;
  source: "validator" | "quality" | "consistency";
  message: string;
  step: BuildStep;
  /** Action card to open, if the problem is in one action. */
  actionId?: string;
  /** DOM id (`studio-…`) of the field to scroll to. */
  anchor?: string;
  /** What the check is about, e.g. the action's wording, when it is one item. */
  subject?: string;
}

const FIELD_NAMES: Record<string, string> = {
  id: "an internal case ID",
  slug: "a case reference code",
  title: "a case title",
  setting: "the clinical setting",
  intro: "the opening scene",
};

const TIER_FROM_WORD: Record<string, keyof typeof CLUE_META> = {
  obvious: "obvious",
  buried: "buried",
  contradicting: "contradicting",
};

const FLAG_STEP: Record<string, BuildStep> = {
  keyClue: "history",
  harmful: "treatment",
  fatal: "treatment",
  unnecessary: "tests",
};

function translate(message: string, definition: MedicalCase): string {
  const label = (id: string) =>
    definition.actions.find((action) => action.id === id)?.label || "an untitled action";
  let match: RegExpExecArray | null;
  if ((match = /^(id|slug|title|setting|intro) is required\.$/.exec(message))) {
    return `Add ${FIELD_NAMES[match[1]!] ?? match[1]}.`;
  }
  if ((match = /^Missing a (obvious|buried|contradicting) clue\.$/.exec(message))) {
    const tier = CLUE_META[TIER_FROM_WORD[match[1]!]!];
    return `Add at least one “${tier.label}” — ${tier.description.charAt(0).toLowerCase()}${tier.description.slice(1)}`;
  }
  if ((match = /^Harmful action (.+) needs a debrief explanation\.$/.exec(message))) {
    return `Explain in the debrief why “${label(match[1]!)}” is harmful.`;
  }
  if ((match = /^Referenced asset (.+) is not in the case manifest\.$/.exec(message))) {
    return "This result points to an image that is not in the case's image library.";
  }
  if ((match = /^Key treatment (.+) is not a valid treatment action\.$/.exec(message))) {
    return "A required treatment no longer exists or is not in the Treatment step.";
  }
  if ((match = /^Deterioration rule references unknown action (.*)\.$/.exec(message))) {
    return "Choose the action that prevents this deterioration.";
  }
  if (/^Condition action .* is not valid\.$/.exec(message)) {
    return "An alternative response depends on an action that no longer exists (or on itself).";
  }
  if (/^Condition deterioration rule .* does not exist\.$/.exec(message)) {
    return "An alternative response depends on a deterioration event that no longer exists.";
  }
  if (/^Referenced diagnosis .* is not on the differential\.$/.exec(message)) {
    return "This finding is linked to a diagnosis that is no longer on the list.";
  }
  if (/^Safety prerequisite .* is not a valid action\.$/.exec(message)) {
    return "The “only safe after…” condition refers to an action that no longer exists.";
  }
  if (/^Unknown ECG preset/.exec(message)) return "Choose one of the available ECG patterns.";
  const table: Record<string, string> = {
    "Action IDs must be unique within a case.":
      "Two actions share the same internal ID. Rename one under Advanced.",
    "A case needs at least one action.":
      "Add at least one question, examination, test or treatment.",
    "List at least one specialty.": "Choose at least one specialty.",
    "The patient needs a name.": "Give the patient a name.",
    "Intro must be 40 words or fewer.": "Shorten the opening scene to 40 words or fewer.",
    "Add the arrival vital signs (minute 0).": "Add the patient's observations on arrival.",
    "The first vitals snapshot must be minute 0.":
      "The first set of observations must be on arrival (minute 0).",
    "Blood pressure must start with systolic/diastolic, e.g. 118/76.":
      "Write blood pressure as systolic/diastolic, for example 118/76.",
    "Differential IDs must be unique.": "Two diagnoses have the same name.",
    "Exactly one diagnosis must be correct.": "Mark exactly one diagnosis as the correct answer.",
    "Exactly one diagnosis must be tempting.":
      "Mark exactly one diagnosis as the tempting wrong answer.",
    "Solution diagnosis is not on the differential.":
      "Choose the correct diagnosis from your list.",
    "Solution diagnosis is not marked correct.": "Choose the correct diagnosis from your list.",
    "At least one reachable action must expose a key clue.":
      "Mark at least one finding as a key clue that students can reach before the patient is lost.",
    "Image results need an asset to display.": "Choose the image students see for this result.",
    "ECG results need a generated tracing or an asset.": "Choose an ECG pattern.",
    "Lab results need at least one row.": "Add at least one row of lab results.",
    "Unknown clue tier.": "Choose a clue type.",
    "Supporting-action threshold must be reachable.":
      "The “at least N of these” number is larger than the number of actions chosen.",
    "Deterioration rule IDs must be unique within a case.":
      "Two deterioration events share an internal ID.",
    "Exactly three hints are required.": "Write all three hints.",
    "Hints must use tiers 1, 2, and 3 in order with non-negative costs.":
      "Hint costs cannot be negative.",
    "Hint text is empty.": "Write this hint.",
    "Exactly three teaching points are required.": "Write all three teaching points.",
    "Name at least one key treatment.": "Choose at least one treatment students must give.",
    "Score bonuses and penalties have invalid signs.":
      "A point value has the wrong sign: bonuses must be positive and penalties negative.",
    "Asset filenames must be unique per case.": "Two images use the same file name.",
  };
  return table[message] ?? message;
}

function locate(
  path: string,
  definition: MedicalCase,
): { step: BuildStep; actionId?: string; anchor?: string } {
  const [head, second] = path.split(".");
  switch (head) {
    case "id":
    case "slug":
      return { step: "finish", anchor: "studio-technical" };
    case "title":
    case "specialty":
    case "difficulty":
      return { step: "basics", anchor: `studio-${head}` };
    case "differential":
      return { step: "basics", anchor: "studio-differential" };
    case "intro":
    case "setting":
      return { step: "patient", anchor: `studio-${head}` };
    case "patient":
      return { step: "patient", anchor: `studio-patient-${second ?? "name"}` };
    case "vitalsTimeline":
      return { step: "patient", anchor: "studio-vitals" };
    case "deteriorationRules": {
      const rule = definition.deteriorationRules.find((item) => item.id === second);
      return rule
        ? { step: "progression", anchor: `studio-rule-${rule.id}` }
        : { step: "progression", anchor: "studio-rules" };
    }
    case "hints":
      return { step: "scoring", anchor: "studio-hints" };
    case "scoring":
    case "mockComparisonPercent":
      return { step: "scoring", anchor: "studio-points" };
    case "assets":
      return { step: "tests", anchor: second ? `studio-asset-${second}` : "studio-images" };
    case "solution": {
      if (second === "keyTreatment") return { step: "scoring", anchor: "studio-required" };
      if (second === "harmfulActionDebrief") {
        const actionId = path.split(".")[2];
        const action = definition.actions.find((item) => item.id === actionId);
        return action
          ? { step: CATEGORY_STEP[action.category], actionId: action.id }
          : { step: "scoring", anchor: "studio-harmful" };
      }
      if (second === "diagnosisId" || second === "whyNotTempting") {
        return { step: "basics", anchor: "studio-differential" };
      }
      if (second === "teachingPoints") return { step: "basics", anchor: "studio-teaching" };
      return { step: "basics" };
    }
    case "actions": {
      if (second?.startsWith("@")) {
        const flag = second.slice(1);
        const category = flag as ActionCategory;
        if (category in CATEGORY_STEP) return { step: CATEGORY_STEP[category] };
        return { step: FLAG_STEP[flag] ?? "history" };
      }
      const action = definition.actions.find((item) => item.id === second);
      if (action) return { step: CATEGORY_STEP[action.category], actionId: action.id };
      return { step: "history" };
    }
    default:
      return { step: "finish" };
  }
}

function fromIssue(issue: StudioIssue, definition: MedicalCase, index: number): StudioCheck {
  const target = locate(issue.path, definition);
  // Messages that say "an action is missing" belong on the step that needs it.
  let step = target.step;
  if (issue.path === "actions" && issue.severity === "error") {
    if (/clue/.test(issue.message)) step = "history";
  }
  const hint = /^hints\.(\d)$/.exec(issue.path);
  const message =
    hint && issue.message === "Hint text is empty."
      ? `Write hint ${Number(hint[1]) + 1}.`
      : translate(issue.message, definition);
  return {
    key: `${issue.severity}-${issue.path}-${index}`,
    severity: issue.severity,
    source: issue.severity === "error" ? "validator" : "quality",
    message,
    ...target,
    step,
  };
}

/** Every automated check for a case, most serious first. */
export function collectChecks(definition: MedicalCase): StudioCheck[] {
  const issues = inspectCase(definition);
  const checks = issues.map((issue, index) => fromIssue(issue, definition, index));
  // Shape errors mean the case cannot be analysed safely.
  if (
    !issues.some(
      (issue) => issue.path === "case" || /must be an? (array|object)/.test(issue.message),
    )
  ) {
    consistencyFindings(definition).forEach((finding, index) => {
      checks.push({
        key: `consistency-${index}`,
        severity: finding.level,
        source: "consistency",
        message: finding.message,
        step: finding.step,
        ...(finding.actionId ? { actionId: finding.actionId } : {}),
        ...(finding.anchor ? { anchor: finding.anchor } : {}),
      });
    });
  }
  for (const check of checks) {
    const action = check.actionId
      ? definition.actions.find((item) => item.id === check.actionId)
      : undefined;
    const rule = check.anchor?.startsWith("studio-rule-")
      ? definition.deteriorationRules.find((item) => `studio-rule-${item.id}` === check.anchor)
      : undefined;
    if (action) check.subject = action.label || "Untitled action";
    else if (rule) check.subject = ruleTitle(definition, rule);
  }
  const order: Record<CheckSeverity, number> = { error: 0, warning: 1, info: 2 };
  return checks.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      BUILD_STEPS.indexOf(a.step) - BUILD_STEPS.indexOf(b.step),
  );
}

export function checksByStep(checks: readonly StudioCheck[]): Map<BuildStep, StudioCheck[]> {
  const map = new Map<BuildStep, StudioCheck[]>();
  for (const check of checks) {
    const list = map.get(check.step) ?? [];
    list.push(check);
    map.set(check.step, list);
  }
  return map;
}

export function stepTitle(step: BuildStep): string {
  return BUILD_STEP_META[step].title;
}

import type { CasePatient, MedicalCase } from "./schema.js";

/** What the case library and the home screen need to show a case card. */
export interface CaseSummary {
  id: string;
  slug: string;
  title: string;
  intro: string;
  setting: string;
  difficulty: 1 | 2 | 3;
  specialty: string[];
  patient: Pick<CasePatient, "name" | "age" | "sex" | "avatar" | "initialExpression">;
  arrivalRespiratoryRate: number;
}

export function summarizeCase(definition: MedicalCase): CaseSummary {
  const { patient } = definition;
  return {
    id: definition.id,
    slug: definition.slug,
    title: definition.title,
    intro: definition.intro,
    setting: definition.setting,
    difficulty: definition.difficulty,
    specialty: definition.specialty,
    patient: {
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      avatar: patient.avatar,
      initialExpression: patient.initialExpression,
    },
    arrivalRespiratoryRate: definition.vitalsTimeline[0]?.rr ?? 16,
  };
}

/** The case after this one, for the debrief's "Next case" link. */
export interface NextCase {
  id: string;
  title: string;
}

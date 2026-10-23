import type { MedicalCase } from "../schema.js";

export interface PatientImage {
  src: string;
  alt: string;
}

/**
 * Resolve the hospital-bed patient photo for a case from the patient's sex.
 * Female cases use the female asset, everything else uses the male asset.
 * Assets live in `public/patients/` (see `public/patients/ATTRIBUTION.md`).
 */
export function patientImageForCase(caseDefinition: MedicalCase): PatientImage {
  const sex = caseDefinition.patient.sex.trim().toLowerCase();
  const female = sex.startsWith("f") || sex.startsWith("woman");
  return {
    src: female ? "/patients/female.webp" : "/patients/male.webp",
    alt: `${caseDefinition.patient.name}, ${caseDefinition.patient.age}-year-old ${
      female ? "woman" : "man"
    }, resting in a hospital bed`,
  };
}

/**
 * Presenting-feature chips for the viewport overlay. Prefers the authored
 * `presentingTags`, falling back to the case specialty so the overlay is never
 * empty.
 */
export function presentingTags(caseDefinition: MedicalCase): string[] {
  const tags = caseDefinition.patient.presentingTags;
  if (tags && tags.length > 0) return tags;
  return caseDefinition.specialty;
}

/**
 * Parse the wall-clock start time out of a case `setting` such as
 * "ER, 2:47 AM" into minutes-since-midnight. Returns null when the setting has
 * no parseable time.
 */
function parseSettingStartMinutes(setting: string): number | null {
  const match = setting.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Format a timeline event's offset as a wall-clock time relative to the case
 * start (e.g. "2:49 AM"). Falls back to a relative "+Nm" label when the setting
 * has no parseable start time.
 */
export function formatEncounterClock(setting: string, offsetMinute: number): string {
  const start = parseSettingStartMinutes(setting);
  if (start === null) return `+${Math.max(0, Math.round(offsetMinute))}m`;
  const total = ((start + Math.max(0, Math.round(offsetMinute))) % (24 * 60)) + 24 * 60;
  const normalized = total % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

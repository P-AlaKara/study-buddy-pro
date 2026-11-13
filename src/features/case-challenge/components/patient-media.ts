import type { MedicalCase } from "../schema.js";

export type WardImageId = "female" | "male";

export interface WardImage {
  id: WardImageId;
  /** Full-resolution asset, served from `public/patients/`. */
  src: string;
  /** Width candidates for `srcset`; the browser picks by viewport width × DPR. */
  srcSet: string;
  alt: string;
  /** Intrinsic size so layout is reserved before the image decodes. */
  width: number;
  height: number;
  /**
   * Where the patient's face sits in the image, as percentages of its width
   * and height. Used as the `object-position` focal point so that, under
   * `object-fit: cover`, the patient keeps the same relative place in the
   * viewport however much the edges are cropped.
   */
  focus: { x: number; y: number };
  /**
   * Horizontal focal point for portrait phones, where only a narrow slice of
   * the image is visible: nudged so the patient's face and chest sit near the
   * middle of the screen rather than its left edge.
   */
  phoneFocusX: number;
}

const WARD_IMAGES: Record<WardImageId, Omit<WardImage, "id" | "alt">> = {
  female: {
    src: "/patients/ward-female.webp",
    srcSet: "/patients/ward-female-1080.webp 1080w, /patients/ward-female.webp 1344w",
    width: 1344,
    height: 768,
    focus: { x: 37, y: 56 },
    phoneFocusX: 37,
  },
  male: {
    src: "/patients/ward-male.webp",
    srcSet: "/patients/ward-male-1080.webp 1080w, /patients/ward-male.webp 1672w",
    width: 1672,
    height: 941,
    focus: { x: 40, y: 48 },
    phoneFocusX: 38,
  },
};

function wardImageIdFromSex(sex: string): WardImageId {
  const value = sex.trim().toLowerCase();
  return value.startsWith("f") || value.startsWith("woman") ? "female" : "male";
}

/**
 * Resolve the pre-rendered hospital-ward background for a case. An explicit
 * `patient.model` wins; otherwise the image follows `patient.sex` (female
 * cases use the female ward, everything else the male ward). Assets live in
 * `public/patients/` (see `public/patients/ATTRIBUTION.md`).
 */
export function wardImageForCase(caseDefinition: MedicalCase): WardImage {
  const { patient } = caseDefinition;
  const id = patient.model ?? wardImageIdFromSex(patient.sex);
  return {
    id,
    ...WARD_IMAGES[id],
    alt: `${patient.name}, ${patient.age}-year-old ${
      id === "female" ? "woman" : "man"
    }, resting in a hospital bed on the ward`,
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

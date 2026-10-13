export const STUDY_WITH_ANNIE_ENABLED = import.meta.env["VITE_ENABLE_STUDY_WITH_ANNIE"] === "true";

export function requireStudyWithAnnieEnabled() {
  if (!STUDY_WITH_ANNIE_ENABLED) {
    throw new Error("Study with Annie is currently unavailable.");
  }
}

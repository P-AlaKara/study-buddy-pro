// Study with Annie (the "AI Study" space) ships enabled. It stays on unless the
// build explicitly opts out with VITE_ENABLE_STUDY_WITH_ANNIE="false", which keeps
// a kill switch available without hiding the feature by default.
export const STUDY_WITH_ANNIE_ENABLED = import.meta.env["VITE_ENABLE_STUDY_WITH_ANNIE"] !== "false";

export function requireStudyWithAnnieEnabled() {
  if (!STUDY_WITH_ANNIE_ENABLED) {
    throw new Error("Study with Annie is currently unavailable.");
  }
}

// Study with Annie (the "AI Study" space) is always enabled. This is intentionally
// hardcoded rather than read from VITE_ENABLE_STUDY_WITH_ANNIE: that variable is
// inlined at build time, so a stale "false" left in a deployment environment would
// keep the feature hidden even after it is meant to be live. To take it offline in
// the future, flip this constant to `false` and rebuild.
export const STUDY_WITH_ANNIE_ENABLED: boolean = true;

export function requireStudyWithAnnieEnabled() {
  if (!STUDY_WITH_ANNIE_ENABLED) {
    throw new Error("Study with Annie is currently unavailable.");
  }
}

// The Exam Generator is always enabled. Hardcoded (not a build-time env var) so
// a stale value in a deployment environment can never hide or expose it. To
// take it offline, flip this constant to `false` and rebuild.
export const EXAM_GENERATOR_ENABLED: boolean = true;

export function requireExamGeneratorEnabled() {
  if (!EXAM_GENERATOR_ENABLED) {
    throw new Error("The Exam Generator is currently unavailable.");
  }
}

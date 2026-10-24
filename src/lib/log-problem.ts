// Logs the real underlying error to the console so problems are easy to inspect
// in the browser dev tools (and in server logs for server code), while the UI
// keeps showing a friendly, non-technical message. Never surface the raw error
// to the user — pass that separately to your own error state.
//
// `scope` is a short, greppable label for where the failure happened, e.g.
// "Student directory" or "OSCE guided action".
export function logProblem(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  // Server functions attach the real, technical reason on `error.cause` while
  // keeping `error.message` friendly for the UI. Surface it here so the console
  // shows what actually went wrong without leaking it into the interface.
  const cause = error instanceof Error && error.cause != null ? error.cause : undefined;
  const extras: unknown[] = [];
  if (cause !== undefined) extras.push("\n  cause:", cause);
  if (context && Object.keys(context).length > 0) extras.push("\n  context:", context);
  console.error(`[Medley] ${scope}:`, error, ...extras);
}

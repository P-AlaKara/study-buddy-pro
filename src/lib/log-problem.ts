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
  if (context && Object.keys(context).length > 0) {
    console.error(`[Medley] ${scope}:`, error, context);
  } else {
    console.error(`[Medley] ${scope}:`, error);
  }
}

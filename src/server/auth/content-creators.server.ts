// Server-only allowlist of content creators: the accounts that may open the
// case studio (/manage/cases). Membership is configured by email in the
// CONTENT_CREATOR_EMAILS environment variable (comma-separated, case
// insensitive) so it can be changed per deployment without a migration.
// Never import this from client code.

let cached: Set<string> | undefined;

export function contentCreatorEmails(): ReadonlySet<string> {
  if (cached) return cached;
  cached = new Set(
    (process.env["CONTENT_CREATOR_EMAILS"] ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  return cached;
}

export function isContentCreator(email: string | null | undefined): boolean {
  if (!email) return false;
  return contentCreatorEmails().has(email.trim().toLowerCase());
}

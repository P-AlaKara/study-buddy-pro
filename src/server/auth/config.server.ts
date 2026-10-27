// Server-only configuration for application-owned authentication.
// Never import this from client code: it reads secrets from the environment.

export interface AuthConfig {
  jwtSecret: Uint8Array;
  cookieName: string;
  /** Session lifetime in seconds. */
  sessionTtlSeconds: number;
  /** Re-issue the cookie when fewer than this many seconds remain. */
  renewThresholdSeconds: number;
  secureCookies: boolean;
}

let cached: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;

  const secret = process.env["AUTH_JWT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing or weak AUTH_JWT_SECRET. Set a random value of at least 32 characters " +
        "(node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\").",
    );
  }

  const ttlDays = Number(process.env["AUTH_SESSION_TTL_DAYS"] ?? "30");
  const sessionTtlSeconds = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays * 86400 : 30 * 86400;

  cached = {
    jwtSecret: new TextEncoder().encode(secret),
    cookieName: process.env["AUTH_SESSION_COOKIE"] || "medley_session",
    sessionTtlSeconds,
    renewThresholdSeconds: 7 * 86400,
    secureCookies: process.env["NODE_ENV"] === "production",
  };
  return cached;
}

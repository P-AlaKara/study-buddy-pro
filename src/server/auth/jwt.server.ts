// Server-only: sign and verify our own session JWTs (HS256 via jose).
// These tokens are application-owned and are NOT Supabase Auth tokens.
import { SignJWT, jwtVerify } from "jose";
import { getAuthConfig } from "./config.server";

const ISSUER = "medley";
const AUDIENCE = "medley-app";

export interface SessionClaims {
  /** app_users.id */
  userId: string;
  /** auth_sessions.id (for server-side revocation) */
  sessionId: string;
  /** students.id — the single profile owned by this user */
  profileId: string;
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  const { jwtSecret, sessionTtlSeconds } = getAuthConfig();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sessionId, pid: claims.profileId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + sessionTtlSeconds)
    .sign(jwtSecret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  const { jwtSecret } = getAuthConfig();
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload["sid"] !== "string" ||
      typeof payload["pid"] !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      sessionId: payload["sid"] as string,
      profileId: payload["pid"] as string,
    };
  } catch {
    return null;
  }
}

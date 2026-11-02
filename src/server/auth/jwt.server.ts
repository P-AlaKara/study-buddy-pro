// Server-only: sign and verify our own session JWTs (HS256 via jose).
// These tokens are application-owned and are NOT Supabase Auth tokens.
import { SignJWT, jwtVerify } from "jose";
import { getAuthConfig } from "./config.server";

const ISSUER = "medley";
const AUDIENCE = "medley-app";

export type AccountRole = "student" | "coach";

export interface SessionClaims {
  /** app_users.id */
  userId: string;
  /** auth_sessions.id (for server-side revocation) */
  sessionId: string;
  /** students.id or coaches.id — the single profile owned by this user */
  profileId: string;
  /** account role; governs which profile table `profileId` points at */
  role: AccountRole;
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  const { jwtSecret, sessionTtlSeconds } = getAuthConfig();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sessionId, pid: claims.profileId, rol: claims.role })
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
    // `rol` is a later addition; default older tokens to the student role.
    const role: AccountRole = payload["rol"] === "coach" ? "coach" : "student";
    return {
      userId: payload.sub,
      sessionId: payload["sid"] as string,
      profileId: payload["pid"] as string,
      role,
    };
  } catch {
    return null;
  }
}

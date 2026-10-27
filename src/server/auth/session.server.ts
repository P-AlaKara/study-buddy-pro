/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only session management: the auth_sessions table (for revocation) plus
// the httpOnly session cookie. The cookie carries an app-signed JWT; the row
// lets us revoke a session server-side (sign-out, sign-out-everywhere).
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { getAuthConfig } from "./config.server";
import { signSessionToken, verifySessionToken } from "./jwt.server";

export interface ActiveSession {
  userId: string;
  profileId: string;
  sessionId: string;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

/** Create a session row and set the httpOnly session cookie. */
export async function startSession(input: { userId: string; profileId: string }): Promise<void> {
  const client = await db();
  const { sessionTtlSeconds } = getAuthConfig();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

  const { data, error } = await client
    .from("auth_sessions")
    .insert({ user_id: input.userId, expires_at: expiresAt })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeSessionCookie({
    userId: input.userId,
    profileId: input.profileId,
    sessionId: data.id as string,
  });
}

async function writeSessionCookie(session: ActiveSession): Promise<void> {
  const { cookieName, sessionTtlSeconds, secureCookies } = getAuthConfig();
  const token = await signSessionToken(session);
  setCookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: sessionTtlSeconds,
  });
}

/**
 * Read and validate the current session: verify the JWT, confirm the session
 * row is live, and refresh the cookie when it is close to expiry. Returns null
 * for anonymous or invalid/revoked sessions.
 */
export async function loadSession(): Promise<ActiveSession | null> {
  const { cookieName } = getAuthConfig();
  const token = getCookie(cookieName);
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const client = await db();
  const { data, error } = await client
    .from("auth_sessions")
    .select("id,user_id,expires_at,revoked_at")
    .eq("id", claims.sessionId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (data.user_id !== claims.userId) return null;

  const session: ActiveSession = {
    userId: claims.userId,
    profileId: claims.profileId,
    sessionId: claims.sessionId,
  };
  return session;
}

/** Revoke the current session (if any) and clear the cookie. */
export async function endSession(): Promise<void> {
  const { cookieName } = getAuthConfig();
  const token = getCookie(cookieName);
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims) {
      const client = await db();
      await client
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", claims.sessionId);
    }
  }
  deleteCookie(cookieName, { path: "/" });
}

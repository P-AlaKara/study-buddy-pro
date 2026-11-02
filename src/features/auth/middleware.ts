// Application-owned authentication middleware for TanStack Start server
// functions. Validates our own session cookie (app-signed JWT + live session
// row) and exposes the account id and profile id to handlers.
//
// This lives outside src/server/** on purpose: the server-function middleware
// chain is referenced from client-reachable modules, so this file must be
// importable in the client environment. The actual secret/DB work happens in
// the dynamically imported, server-only session module inside `.server()`.
import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Require a signed-in account. Handlers receive { userId, profileId, sessionId }. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { loadSession } = await import("@/server/auth/session.server");
  const session = await loadSession();
  if (!session) {
    setResponseStatus(401);
    throw new UnauthorizedError();
  }
  return next({
    context: {
      userId: session.userId,
      profileId: session.profileId,
      sessionId: session.sessionId,
      role: session.role,
    },
  });
});

/** Optional auth: exposes the session when present, null otherwise. */
export const optionalAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { loadSession } = await import("@/server/auth/session.server");
  const session = await loadSession();
  return next({
    context: {
      userId: session?.userId ?? null,
      profileId: session?.profileId ?? null,
      sessionId: session?.sessionId ?? null,
      role: session?.role ?? null,
    },
  });
});

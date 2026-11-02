import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";

// Minimal signup surface (data minimization): email + password only, with an
// optional display name. The account role (student or coach) is chosen at
// registration; every other profile field is deferred to the Profile page.
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(200, "Password is too long."),
});

const signUpSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["student", "coach"]).default("student"),
});

export type AccountRole = "student" | "coach";

export interface CurrentUserPayload {
  id: string;
  email: string;
  profileId: string;
  role: AccountRole;
}

function displayNameFrom(email: string, provided?: string): string {
  if (provided && provided.trim().length >= 2) return provided.trim();
  const local =
    email
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "Student";
  const name = local.length >= 2 ? local : "Student";
  return name.slice(0, 100);
}

export const signUp = createServerFn({ method: "POST" })
  .validator((input: unknown) => signUpSchema.parse(input))
  .handler(async ({ data }): Promise<CurrentUserPayload> => {
    const { hashPassword } = await import("@/server/auth/password.server");
    const { createUserWithProfile, normalizeEmail, EmailAlreadyRegisteredError } =
      await import("@/server/auth/users.server");
    const { startSession } = await import("@/server/auth/session.server");

    const email = normalizeEmail(data.email);
    try {
      const passwordHash = await hashPassword(data.password);
      const { userId, profileId, role } = await createUserWithProfile({
        email,
        passwordHash,
        displayName: displayNameFrom(email, data.displayName),
        role: data.role,
      });
      await startSession({ userId, profileId, role });
      return { id: userId, email, profileId, role };
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new Error("That email is already registered. Try signing in instead.");
      }
      throw error;
    }
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((input: unknown) => credentialsSchema.parse(input))
  .handler(async ({ data }): Promise<CurrentUserPayload> => {
    const { verifyPassword } = await import("@/server/auth/password.server");
    const { findUserByEmail, getProfileIdForUser, normalizeEmail } =
      await import("@/server/auth/users.server");
    const { startSession } = await import("@/server/auth/session.server");

    const email = normalizeEmail(data.email);
    const user = await findUserByEmail(email);
    // Verify against the stored hash when present; otherwise run a dummy verify
    // so response timing does not reveal whether the email exists.
    const ok = user
      ? await verifyPassword(user.password_hash, data.password)
      : await verifyPassword(
          "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000",
          data.password,
        );

    if (!user || !ok) {
      throw new Error("Incorrect email or password.");
    }

    const profileId = await getProfileIdForUser(user.id, user.role);
    if (!profileId) throw new Error("Your account has no profile. Contact support.");

    await startSession({ userId: user.id, profileId, role: user.role });
    return { id: user.id, email: user.email, profileId, role: user.role };
  });

export const signOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const { endSession } = await import("@/server/auth/session.server");
    await endSession();
    return { ok: true };
  },
);

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<CurrentUserPayload> => {
    const { getUserById } = await import("@/server/auth/users.server");
    const user = await getUserById(context.userId);
    if (!user) throw new Error("Account not found.");
    return { id: user.id, email: user.email, profileId: context.profileId, role: user.role };
  });

// Anonymous-safe session probe for route guards: returns null instead of a 401
// when there is no valid session.
export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUserPayload | null> => {
    const { loadSession } = await import("@/server/auth/session.server");
    const { getUserById } = await import("@/server/auth/users.server");
    const session = await loadSession();
    if (!session) return null;
    const user = await getUserById(session.userId);
    if (!user) return null;
    return { id: user.id, email: user.email, profileId: session.profileId, role: session.role };
  },
);

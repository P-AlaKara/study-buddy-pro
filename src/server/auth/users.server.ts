/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only repository for application-owned accounts (app_users) and their
// linked student profile. All access uses the service-role client; callers are
// responsible for authentication. Isolated so the data layer can be swapped
// (e.g. to Drizzle direct-Postgres) without changing the auth flow.

export type AccountRole = "student" | "coach";

export interface AppUser {
  id: string;
  email: string;
  password_hash: string;
  status: string;
  role: AccountRole;
  created_at: string;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("That email is already registered.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** Normalize an email for storage and lookup: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // app_users / auth_sessions are not in the generated types; service-role only.
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const client = await db();
  const { data, error } = await client
    .from("app_users")
    .select("id,email,password_hash,status,role,created_at")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppUser) ?? null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const client = await db();
  const { data, error } = await client
    .from("app_users")
    .select("id,email,password_hash,status,role,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppUser) ?? null;
}

/**
 * Resolve the profile row id for an account. Students own a `students` row and
 * coaches own a `coaches` row; which table is authoritative depends on the
 * account role.
 */
export async function getProfileIdForUser(
  userId: string,
  role: AccountRole,
): Promise<string | null> {
  const client = await db();
  const table = role === "coach" ? "coaches" : "students";
  const { data, error } = await client.from(table).select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

/**
 * Create an account and its single profile. The profile lives in `students`
 * for a student account and in `coaches` for a coach account; the role is
 * chosen at registration. Email uniqueness is enforced by a database
 * constraint; a concurrent duplicate surfaces as EmailAlreadyRegisteredError.
 * If the profile insert fails the user row is rolled back on a best-effort
 * basis.
 */
export async function createUserWithProfile(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  role: AccountRole;
}): Promise<{ userId: string; profileId: string; role: AccountRole }> {
  const client = await db();
  const email = normalizeEmail(input.email);
  const role: AccountRole = input.role === "coach" ? "coach" : "student";

  const { data: user, error: userError } = await client
    .from("app_users")
    .insert({ email, password_hash: input.passwordHash, role })
    .select("id")
    .single();

  if (userError) {
    // 23505 = unique_violation
    if (userError.code === "23505") throw new EmailAlreadyRegisteredError();
    throw new Error(userError.message);
  }

  const userId = user.id as string;
  const profileTable = role === "coach" ? "coaches" : "students";

  const { data: profile, error: profileError } = await client
    .from(profileTable)
    .insert({ user_id: userId, name: input.displayName, email })
    .select("id")
    .single();

  if (profileError) {
    await client.from("app_users").delete().eq("id", userId);
    throw new Error(profileError.message);
  }

  return { userId, profileId: profile.id as string, role };
}

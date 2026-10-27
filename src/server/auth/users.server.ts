/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only repository for application-owned accounts (app_users) and their
// linked student profile. All access uses the service-role client; callers are
// responsible for authentication. Isolated so the data layer can be swapped
// (e.g. to Drizzle direct-Postgres) without changing the auth flow.

export interface AppUser {
  id: string;
  email: string;
  password_hash: string;
  status: string;
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
    .select("id,email,password_hash,status,created_at")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppUser) ?? null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const client = await db();
  const { data, error } = await client
    .from("app_users")
    .select("id,email,password_hash,status,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppUser) ?? null;
}

export async function getProfileIdForUser(userId: string): Promise<string | null> {
  const client = await db();
  const { data, error } = await client
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

/**
 * Create an account and its single student profile. Email uniqueness is
 * enforced by a database constraint; a concurrent duplicate surfaces as
 * EmailAlreadyRegisteredError. If the profile insert fails the user row is
 * rolled back on a best-effort basis.
 */
export async function createUserWithProfile(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<{ userId: string; profileId: string }> {
  const client = await db();
  const email = normalizeEmail(input.email);

  const { data: user, error: userError } = await client
    .from("app_users")
    .insert({ email, password_hash: input.passwordHash })
    .select("id")
    .single();

  if (userError) {
    // 23505 = unique_violation
    if (userError.code === "23505") throw new EmailAlreadyRegisteredError();
    throw new Error(userError.message);
  }

  const userId = user.id as string;

  const { data: profile, error: profileError } = await client
    .from("students")
    .insert({ user_id: userId, name: input.displayName, email })
    .select("id")
    .single();

  if (profileError) {
    await client.from("app_users").delete().eq("id", userId);
    throw new Error(profileError.message);
  }

  return { userId, profileId: profile.id as string };
}

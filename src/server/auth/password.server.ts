// Server-only password hashing. Argon2id via @node-rs/argon2 (prebuilt native
// bindings). Isolated here so the algorithm/library can be swapped without
// touching the rest of the auth system.
import { hash, verify, Algorithm } from "@node-rs/argon2";

// OWASP-aligned Argon2id parameters. Library defaults are sensible; we pin them
// explicitly so a dependency bump cannot silently weaken stored hashes.
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    // Malformed hash or verifier error: treat as a failed login, never throw.
    return false;
  }
}

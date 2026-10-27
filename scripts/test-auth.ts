import * as assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/server/auth/password.server.js";

// JWT sign/verify and email normalization are covered by the standalone smoke
// test; this harness focuses on the security-critical password hashing logic
// (its module has no path-aliased imports, so it compiles standalone).

type Test = { name: string; run: () => Promise<void> | void };
const tests: Test[] = [];
const test = (name: string, run: Test["run"]) => tests.push({ name, run });

test("hashes passwords with Argon2id and verifies the correct password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.ok(hash.startsWith("$argon2id$"), "hash should be Argon2id");
  assert.equal(await verifyPassword(hash, "correct horse battery staple"), true);
});

test("rejects an incorrect password", async () => {
  const hash = await hashPassword("s3cret-passphrase");
  assert.equal(await verifyPassword(hash, "not-the-password"), false);
});

test("produces a distinct hash per call (random salt) that both still verify", async () => {
  const a = await hashPassword("same-password-123");
  const b = await hashPassword("same-password-123");
  assert.notEqual(a, b, "salts should differ");
  assert.equal(await verifyPassword(a, "same-password-123"), true);
  assert.equal(await verifyPassword(b, "same-password-123"), true);
});

test("never throws on a malformed stored hash, returns false", async () => {
  assert.equal(await verifyPassword("not-a-real-hash", "whatever"), false);
});

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`  ok   ${t.name}`);
    } catch (error) {
      failed++;
      console.error(`  FAIL ${t.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }
  console.log(`\nauth: ${tests.length - failed}/${tests.length} passed`);
  if (failed) process.exit(1);
}

void main();

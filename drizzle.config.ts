import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Direct Postgres connection string for drizzle-kit (not the Supabase API URL).
    url: process.env.DATABASE_URL ?? "",
  },
});

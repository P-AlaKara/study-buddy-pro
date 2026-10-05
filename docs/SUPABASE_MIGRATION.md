# Move Medley to the standalone Supabase project

Target project:

- Project ref: `lvqatsptuqaqvmivfjkj`
- API URL: `https://lvqatsptuqaqvmivfjkj.supabase.co`

This app has no end-user authentication. Browser requests use the project's
publishable key and the existing `anon` RLS policies. The case scoring server
function uses a secret key and must only receive that key at server runtime.

## 1. Collect the new project credentials

Open the target project in Supabase and use **Connect** (or **Project Settings →
API Keys**) to copy:

1. The publishable key (`sb_publishable_...`).
2. A secret key (`sb_secret_...`).
3. The database password from **Project Settings → Database**.

Never put the secret key in a `VITE_` variable. Values prefixed with `VITE_`
are shipped to the browser.

## 2. Update local environment variables

The repository currently has `.env` in Git's tracked file list. The new
`.gitignore` rule prevents future accidental additions, but ignore rules do not
untrack an existing file. Before pasting the new keys, run:

```sh
git rm --cached .env
git check-ignore .env
```

The first command removes `.env` from Git's index while leaving the local file
on disk. Because the old keys have existed in repository history, treat them as
exposed and revoke or rotate them after the cutover.

The project URL and ref in `.env` have already been changed. Replace the old
Lovable keys and add the new server key:

```dotenv
SUPABASE_PROJECT_ID="lvqatsptuqaqvmivfjkj"
SUPABASE_URL="https://lvqatsptuqaqvmivfjkj.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

VITE_SUPABASE_PROJECT_ID="lvqatsptuqaqvmivfjkj"
VITE_SUPABASE_URL="https://lvqatsptuqaqvmivfjkj.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

SUPABASE_DB_PASSWORD="the-new-project-database-password"
```

`SUPABASE_SERVICE_ROLE_KEY` remains supported as a legacy fallback, but the new
secret-key format is preferred. Remove or rename the current `sb_DB_PASSWORD`
entry; the CLI recognizes `SUPABASE_DB_PASSWORD`.

The real `.env` must not be committed. `.env.example` documents the required
names without containing credentials.

## 3. Link the Supabase CLI

From the repository root:

```sh
npx supabase login
npx supabase link --project-ref lvqatsptuqaqvmivfjkj
```

The link command prompts for the new database password. Do not place the
password directly in a shell command, terminal screenshot, or commit.

## 4. Apply the schema and seed data

This is a fresh target project, so do not run `db pull` first. The repository's
migrations are the source of truth.

Preview the migration set:

```sh
npx supabase db push --dry-run
```

Then apply it:

```sh
npx supabase db push
```

The migrations already contain the app's cases, quizzes, OSCEs, flashcards,
groups, achievements, demo students, and simulated activity history. The added
`20260923194320_seed_demo_students.sql` migration restores four profiles that
had originally been created outside Lovable's migration history.

Do **not** run `supabase db reset --linked`; that command destroys the remote
database.

## 5. Regenerate database types and validate

After the push:

```sh
npx supabase gen types typescript --linked > /tmp/medley-supabase-types.ts
npm run build
npm run dev
```

Compare the generated file with `src/integrations/supabase/types.ts` before
replacing it, because generated formatting and relationship names can vary by
CLI version.

Verify in Supabase's SQL editor:

```sql
select count(*) as students from public.students;
select count(*) as cases from public.cases;
select count(*) as xp_events from public.xp_events;
select count(*) as achievements from public.achievements;
```

Expected minimums are 4 students, 4 cases, non-zero XP events, and 12
achievements.

## 6. Configure the deployed app

Local `.env` values do not change an already deployed build. Add the same
variables to the hosting provider:

- Build/client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Server runtime: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`

Trigger a clean rebuild after changing them. Confirm the browser bundle never
contains `SUPABASE_SECRET_KEY` or a value beginning with `sb_secret_`.

## Preserving live data instead of rebuilding demo data

Replaying migrations is recommended for this prototype because its content and
demo history are seeded. If the Lovable database now contains user-created
profiles, notes, attempts, or decks that must be preserved, stop before `db
push` and make a logical backup/data-export plan first. A database dump requires
the old database connection string; the public Lovable API URL is not a Postgres
connection string.

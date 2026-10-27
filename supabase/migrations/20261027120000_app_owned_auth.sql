-- Production authentication migration.
--
-- Transitions the app from Supabase-Auth + a shared demo "student directory" to
-- application-owned accounts:
--   * app_users        - email + Argon2id password hash (identity we own)
--   * auth_sessions     - server-side session rows for app-signed JWT cookies
--   * students.user_id  - links the single profile a user owns to their account
--   * FK repoint        - Annie/OSCE tables move off auth.users onto app_users
--   * demo removal       - all seeded demo accounts and their data are cleared
--   * lockdown           - browser (anon/authenticated) loses direct table access;
--                          all protected access now flows through server functions
--                          using the service-role client.
--
-- Email verification / password reset are intentionally deferred (no email
-- infrastructure yet).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Accounts we own
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_length CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT app_users_status_valid CHECK (status IN ('active', 'disabled'))
);

-- Case-insensitive uniqueness; emails are stored already-normalized (lowercased)
-- by the application, and this index is the race-safe backstop.
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_key ON public.app_users (lower(email));

DROP TRIGGER IF EXISTS app_users_updated_at ON public.app_users;
CREATE TRIGGER app_users_updated_at BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_users TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Sessions (for app-signed JWT cookies; enables revocation / sign-out-all)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON public.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON public.auth_sessions (expires_at);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.auth_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Remove demo data. Every current account is a seeded demo profile.
--
--    We DELETE (not TRUNCATE) students so the schema's own ON DELETE actions
--    run: student-owned rows cascade away, while links from authored content
--    are nulled rather than destroyed. In particular quiz_questions.
--    related_flashcard_deck_id is ON DELETE SET NULL, so removing demo decks
--    keeps the authored question bank intact -- a TRUNCATE ... CASCADE would
--    ignore that and wipe the questions too.
-- ---------------------------------------------------------------------------
DELETE FROM public.students;

-- Annie / OSCE free-form demo data is self-contained (no authored content
-- references it) and was keyed to the old Supabase Auth users.
TRUNCATE
  public.annie_documents,
  public.annie_annotations,
  public.annie_quiz_attempts,
  public.annie_study_sessions,
  public.user_annie_settings,
  public.annie_page_overviews,
  public.osce_ai_sessions,
  public.osce_ai_usage
  CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Link the profile to the account. The table is now empty, so a NOT NULL
--    owner column and relaxed signup-optional fields are both safe.
-- ---------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL
    REFERENCES public.app_users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key ON public.students (user_id);

-- Data minimization: only email + name are set at signup; the rest is optional
-- and edited later from the Profile page.
ALTER TABLE public.students ALTER COLUMN university DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN year_of_study DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN medical_program DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Repoint Annie / OSCE ownership from auth.users to app_users.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT unnest(ARRAY[
      'annie_documents',
      'annie_annotations',
      'annie_quiz_attempts',
      'annie_study_sessions',
      'user_annie_settings',
      'osce_ai_sessions',
      'osce_ai_usage'
    ]) AS tbl
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      rec.tbl, rec.tbl || '_user_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) '
      || 'REFERENCES public.app_users(id) ON DELETE CASCADE',
      rec.tbl, rec.tbl || '_user_id_fkey'
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Lockdown (defense-in-depth). The browser talks only to our server
--    functions now; those use the service-role client, which bypasses RLS.
--    Revoking anon/authenticated privileges makes any stray direct browser
--    query fail closed, regardless of leftover permissive policies.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;

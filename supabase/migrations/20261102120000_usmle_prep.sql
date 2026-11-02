-- USMLE Prep feature.
--
-- Replaces the Study Groups feature with a coaching marketplace that connects
-- students preparing for the USMLE with coaches who run structured classes:
--   * app_users.role     - accounts are now explicitly 'student' or 'coach',
--                           chosen at registration.
--   * coaches            - a coach's public profile (bio, qualifications,
--                           expertise, availability), one per coach account.
--   * coach_classes      - classes a coach offers (schedule, step, capacity).
--   * class_enrollments  - which student is enrolled in which class.
--   * coach_reviews      - a student's rating + review of a coach.
--   * usmle_messages     - private direct messages between a coach and a student
--                           who share at least one enrollment.
--   * class_announcements- a coach's broadcast to every student in a class.
--
-- The Study Groups tables (and the group "team case" rooms built on them) are
-- dropped. As with the app-owned-auth migration, all browser access is locked
-- down: these tables are reachable only through server functions using the
-- service-role client, so no anon/authenticated grants or RLS policies are
-- created here (the lockdown migration already revoked those privileges).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Remove the Study Groups feature.
--
--    DROP ... CASCADE also clears the dependent foreign keys that pointed at
--    groups (quiz_sessions.group_id and case_rooms.group_id). We then drop the
--    now-unused quiz_sessions.group_id column. The case_rooms tables are left
--    in place: they belong to the weekly team-challenge lineage (still used by
--    case scoring and the Team leaderboard), not to Study Groups; their
--    group_id column simply becomes an unused nullable uuid.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.group_shared_resources CASCADE;
DROP TABLE IF EXISTS public.group_messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
ALTER TABLE public.quiz_sessions DROP COLUMN IF EXISTS group_id;

-- ---------------------------------------------------------------------------
-- 2. Account role, chosen at registration.
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'coach'));

-- ---------------------------------------------------------------------------
-- 3. Coach profiles. A coach account owns exactly one coach profile, mirroring
--    the students.user_id relationship.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  qualifications text NOT NULL DEFAULT '',
  expertise text[] NOT NULL DEFAULT '{}',
  availability text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coaches_name_length CHECK (char_length(name) BETWEEN 2 AND 120)
);
CREATE UNIQUE INDEX IF NOT EXISTS coaches_user_id_key ON public.coaches (user_id);

DROP TRIGGER IF EXISTS coaches_updated_at ON public.coaches;
CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.coaches TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Classes offered by a coach.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  usmle_step text NOT NULL DEFAULT 'Step 1'
    CHECK (usmle_step IN ('Step 1', 'Step 2 CK', 'Step 3')),
  schedule text NOT NULL DEFAULT '',
  capacity integer CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 1000),
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_classes_title_length CHECK (char_length(title) BETWEEN 2 AND 160)
);
CREATE INDEX IF NOT EXISTS coach_classes_coach_idx ON public.coach_classes (coach_id);

DROP TRIGGER IF EXISTS coach_classes_updated_at ON public.coach_classes;
CREATE TRIGGER coach_classes_updated_at BEFORE UPDATE ON public.coach_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coach_classes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.coach_classes TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Enrollments.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.coach_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_enrollments_unique UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS class_enrollments_class_idx ON public.class_enrollments (class_id);
CREATE INDEX IF NOT EXISTS class_enrollments_student_idx ON public.class_enrollments (student_id);

ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.class_enrollments TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Reviews / ratings. One review per student per coach.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_reviews_unique UNIQUE (coach_id, student_id)
);
CREATE INDEX IF NOT EXISTS coach_reviews_coach_idx ON public.coach_reviews (coach_id);

DROP TRIGGER IF EXISTS coach_reviews_updated_at ON public.coach_reviews;
CREATE TRIGGER coach_reviews_updated_at BEFORE UPDATE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.coach_reviews TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Private direct messages between a coach and a student.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usmle_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('coach', 'student')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usmle_messages_thread_idx
  ON public.usmle_messages (coach_id, student_id, created_at);

ALTER TABLE public.usmle_messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.usmle_messages TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Class announcements (coach broadcast to all enrolled students).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.coach_classes(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS class_announcements_class_idx
  ON public.class_announcements (class_id, created_at);

ALTER TABLE public.class_announcements ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.class_announcements TO service_role;

COMMIT;

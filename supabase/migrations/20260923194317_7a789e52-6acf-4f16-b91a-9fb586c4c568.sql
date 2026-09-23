CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  university text NOT NULL,
  country text NOT NULL DEFAULT 'Rwanda',
  year_of_study integer NOT NULL,
  medical_program text NOT NULL,
  current_level text,
  subjects_studying text[] NOT NULL DEFAULT '{}',
  current_rotation text,
  specialty_interests text[] NOT NULL DEFAULT '{}',
  weak_areas text[] NOT NULL DEFAULT '{}',
  study_goal text,
  daily_study_target_minutes integer NOT NULL DEFAULT 30,
  notification_prefs jsonb NOT NULL DEFAULT '{"study_reminders": true, "weekly_digest": false}'::jsonb,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT students_name_length CHECK (char_length(name) BETWEEN 2 AND 100),
  CONSTRAINT students_email_length CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT students_year_range CHECK (year_of_study BETWEEN 1 AND 8),
  CONSTRAINT students_daily_target_range CHECK (daily_study_target_minutes BETWEEN 5 AND 480)
);
GRANT INSERT ON public.students TO anon;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create a demo student" ON public.students FOR INSERT TO anon WITH CHECK (true);

CREATE VIEW public.student_directory AS
SELECT id, name, university, country, year_of_study, medical_program, current_level,
  subjects_studying, current_rotation, specialty_interests, weak_areas, study_goal,
  daily_study_target_minutes, notification_prefs, xp, level, streak_days, longest_streak, created_at
FROM public.students;
GRANT SELECT ON public.student_directory TO anon;
GRANT SELECT ON public.student_directory TO authenticated;
GRANT ALL ON public.student_directory TO service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.case_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.case_attempts TO service_role;
ALTER TABLE public.case_attempts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.osce_stations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.osce_stations TO service_role;
ALTER TABLE public.osce_stations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.osce_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.osce_attempts TO service_role;
ALTER TABLE public.osce_attempts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quiz_questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quiz_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.flashcard_decks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.flashcards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.flashcard_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.flashcard_reviews TO service_role;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.group_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.achievements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.student_achievements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.student_achievements TO service_role;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.xp_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.mastery_scores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.mastery_scores TO service_role;
ALTER TABLE public.mastery_scores ENABLE ROW LEVEL SECURITY;
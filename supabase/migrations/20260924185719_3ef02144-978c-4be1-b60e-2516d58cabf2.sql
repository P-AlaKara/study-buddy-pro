-- CASES
DROP POLICY IF EXISTS "Placeholder remains private" ON public.cases;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.case_attempts;

ALTER TABLE public.cases
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN teaser text NOT NULL DEFAULT '',
  ADD COLUMN specialty text NOT NULL DEFAULT '',
  ADD COLUMN organ_system text NOT NULL DEFAULT '',
  ADD COLUMN topic text NOT NULL DEFAULT '',
  ADD COLUMN year_level integer NOT NULL DEFAULT 3,
  ADD COLUMN difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  ADD COLUMN clinical_setting text NOT NULL DEFAULT 'ED' CHECK (clinical_setting IN ('ED','outpatient','ward','surgical','ICU','community','pediatrics','maternity')),
  ADD COLUMN estimated_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN xp_reward integer NOT NULL DEFAULT 100,
  ADD COLUMN mode text NOT NULL DEFAULT 'both' CHECK (mode IN ('solo','team','both')),
  ADD COLUMN is_weekly_challenge boolean NOT NULL DEFAULT false,
  ADD COLUMN challenge_start timestamptz,
  ADD COLUMN challenge_end timestamptz,
  ADD COLUMN completions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN patient jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN initial_presentation text NOT NULL DEFAULT '',
  ADD COLUMN history_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN examinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN investigations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN interpretation_task jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN differential_prompt text NOT NULL DEFAULT '',
  ADD COLUMN diagnosis_options text[] NOT NULL DEFAULT '{}',
  ADD COLUMN correct_diagnosis text NOT NULL DEFAULT '',
  ADD COLUMN correct_differentials text[] NOT NULL DEFAULT '{}',
  ADD COLUMN management_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN communication_task jsonb,
  ADD COLUMN outcomes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN debrief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN answer_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN scoring_weights jsonb NOT NULL DEFAULT '{"diagnostic_accuracy":30,"clinical_reasoning":25,"management":20,"investigations":10,"patient_safety":10,"communication":5}'::jsonb;

REVOKE ALL ON public.cases FROM anon, authenticated;
GRANT SELECT (id, created_at, title, teaser, specialty, organ_system, topic, year_level, difficulty, clinical_setting, estimated_minutes, xp_reward, mode, is_weekly_challenge, challenge_start, challenge_end, completions_count, is_published, patient, initial_presentation, history_categories, examinations, investigations, interpretation_task, differential_prompt, diagnosis_options, management_options, communication_task, scoring_weights) ON public.cases TO anon, authenticated;
GRANT ALL ON public.cases TO service_role;
CREATE POLICY "Published cases are browsable" ON public.cases FOR SELECT TO anon, authenticated USING (is_published);

-- ATTEMPTS
ALTER TABLE public.case_attempts
  ADD COLUMN student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ADD COLUMN mode text NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo','team')),
  ADD COLUMN room_id uuid,
  ADD COLUMN status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  ADD COLUMN current_stage text NOT NULL DEFAULT 'presentation',
  ADD COLUMN history_questions_asked jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN exams_performed jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN investigations_ordered jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN differential_submission jsonb,
  ADD COLUMN interpretation_answer text,
  ADD COLUMN final_diagnosis text,
  ADD COLUMN final_diagnosis_details jsonb,
  ADD COLUMN management_choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN management_reasoning text,
  ADD COLUMN communication_response jsonb,
  ADD COLUMN management_path_outcome text,
  ADD COLUMN score_breakdown jsonb,
  ADD COLUMN total_score integer,
  ADD COLUMN started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN completed_at timestamptz;
CREATE INDEX case_attempts_student_idx ON public.case_attempts(student_id, case_id);

GRANT SELECT, INSERT, UPDATE ON public.case_attempts TO anon, authenticated;
GRANT ALL ON public.case_attempts TO service_role;
CREATE POLICY "Demo attempts are readable" ON public.case_attempts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo attempts start fresh" ON public.case_attempts FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'in_progress' AND score_breakdown IS NULL AND total_score IS NULL AND completed_at IS NULL);
CREATE POLICY "Only open attempts can progress" ON public.case_attempts FOR UPDATE TO anon, authenticated
  USING (status = 'in_progress') WITH CHECK (status = 'in_progress' AND score_breakdown IS NULL AND total_score IS NULL);

CREATE OR REPLACE FUNCTION public.guard_case_attempt()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE stages text[] := ARRAY['presentation','history','exam','differential','investigations','interpretation','diagnosis','management','communication','outcome','debrief'];
BEGIN
  IF OLD.status = 'completed' THEN RAISE EXCEPTION 'Completed attempts are locked'; END IF;
  IF array_position(stages, NEW.current_stage) IS NULL THEN RAISE EXCEPTION 'Unknown stage'; END IF;
  IF array_position(stages, NEW.current_stage) < array_position(stages, OLD.current_stage) THEN RAISE EXCEPTION 'Stages cannot be reopened'; END IF;
  IF OLD.differential_submission IS NOT NULL AND NEW.differential_submission IS DISTINCT FROM OLD.differential_submission THEN RAISE EXCEPTION 'Differential already submitted'; END IF;
  IF OLD.final_diagnosis IS NOT NULL AND NEW.final_diagnosis IS DISTINCT FROM OLD.final_diagnosis THEN RAISE EXCEPTION 'Diagnosis already submitted'; END IF;
  IF OLD.interpretation_answer IS NOT NULL AND NEW.interpretation_answer IS DISTINCT FROM OLD.interpretation_answer THEN RAISE EXCEPTION 'Interpretation already submitted'; END IF;
  IF OLD.communication_response IS NOT NULL AND NEW.communication_response IS DISTINCT FROM OLD.communication_response THEN RAISE EXCEPTION 'Communication already submitted'; END IF;
  IF jsonb_array_length(OLD.management_choices) > 0 AND NEW.management_choices IS DISTINCT FROM OLD.management_choices THEN RAISE EXCEPTION 'Management already submitted'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER case_attempts_guard BEFORE UPDATE ON public.case_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_case_attempt();

-- WEEKLY CHALLENGES
CREATE TABLE public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  rules text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_challenges TO anon, authenticated;
GRANT ALL ON public.weekly_challenges TO service_role;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges are public" ON public.weekly_challenges FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  mode text NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo','team')),
  team_id uuid,
  team_name text,
  group_name text,
  score integer NOT NULL DEFAULT 0,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenge_participants TO anon, authenticated;
GRANT ALL ON public.challenge_participants TO service_role;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboards are public" ON public.challenge_participants FOR SELECT TO anon, authenticated USING (true);

-- CASE ROOMS
CREATE TABLE public.case_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Case room',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  shared_notes text NOT NULL DEFAULT '',
  differential_board jsonb NOT NULL DEFAULT '[]'::jsonb,
  timer_seconds integer NOT NULL DEFAULT 1800,
  created_by uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_rooms TO anon, authenticated;
GRANT ALL ON public.case_rooms TO service_role;
ALTER TABLE public.case_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms are open to demo students" ON public.case_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students open rooms" ON public.case_rooms FOR INSERT TO anon, authenticated WITH CHECK (status = 'active');
CREATE POLICY "Active rooms can be edited" ON public.case_rooms FOR UPDATE TO anon, authenticated USING (status = 'active') WITH CHECK (true);
CREATE TRIGGER case_rooms_updated_at BEFORE UPDATE ON public.case_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.case_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.case_rooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','investigation','management','progress')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_room_messages TO anon, authenticated;
GRANT ALL ON public.case_room_messages TO service_role;
ALTER TABLE public.case_room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room messages are readable" ON public.case_room_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students post messages" ON public.case_room_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.case_room_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.case_rooms(id) ON DELETE CASCADE,
  decision_type text NOT NULL CHECK (decision_type IN ('investigation','management')),
  option text NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, decision_type, option, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.case_room_votes TO anon, authenticated;
GRANT ALL ON public.case_room_votes TO service_role;
ALTER TABLE public.case_room_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are readable" ON public.case_room_votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students vote" ON public.case_room_votes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students unvote" ON public.case_room_votes FOR DELETE TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.case_room_messages, public.case_room_votes, public.case_rooms;
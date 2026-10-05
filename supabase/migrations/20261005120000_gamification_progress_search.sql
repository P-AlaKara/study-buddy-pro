-- Gamification, progress, notes, notifications and saved-library data.
-- The app is a shared demo, so policies deliberately follow the open demo model
-- established by the earlier migrations.

ALTER TABLE public.xp_events
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN source_type text,
  ADD COLUMN source_id uuid,
  ADD COLUMN xp_amount integer;
ALTER TABLE public.xp_events
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN source_type SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL,
  ALTER COLUMN xp_amount SET NOT NULL,
  ADD CONSTRAINT xp_events_source_type_check CHECK (source_type IN ('case','quiz','osce','flashcard','challenge','streak','group')),
  ADD CONSTRAINT xp_events_amount_check CHECK (xp_amount > 0),
  ADD CONSTRAINT xp_events_one_award UNIQUE (student_id, source_type, source_id);
CREATE INDEX xp_events_student_date_idx ON public.xp_events(student_id, created_at DESC);

ALTER TABLE public.achievements
  ADD COLUMN name text,
  ADD COLUMN description text,
  ADD COLUMN icon text,
  ADD COLUMN criteria jsonb;
ALTER TABLE public.achievements
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN icon SET NOT NULL,
  ALTER COLUMN criteria SET NOT NULL,
  ADD CONSTRAINT achievements_name_unique UNIQUE (name);

ALTER TABLE public.student_achievements
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN achievement_id uuid REFERENCES public.achievements(id) ON DELETE CASCADE,
  ADD COLUMN earned_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.student_achievements
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN achievement_id SET NOT NULL,
  ADD CONSTRAINT student_achievements_unique UNIQUE (student_id, achievement_id);

ALTER TABLE public.mastery_scores
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN subject_or_system text,
  ADD COLUMN competency text,
  ADD COLUMN level_label text,
  ADD COLUMN numeric_score integer,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mastery_scores
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN subject_or_system SET NOT NULL,
  ALTER COLUMN competency SET NOT NULL,
  ALTER COLUMN level_label SET NOT NULL,
  ALTER COLUMN numeric_score SET NOT NULL,
  ADD CONSTRAINT mastery_level_check CHECK (level_label IN ('strong','developing','weak')),
  ADD CONSTRAINT mastery_score_check CHECK (numeric_score BETWEEN 0 AND 100),
  ADD CONSTRAINT mastery_student_competency_unique UNIQUE (student_id, subject_or_system, competency);

ALTER TABLE public.notifications
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN type text,
  ADD COLUMN message text,
  ADD COLUMN is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN related_link text;
ALTER TABLE public.notifications
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN message SET NOT NULL;
CREATE INDEX notifications_student_date_idx ON public.notifications(student_id, created_at DESC);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('case','quiz_question','flashcard','osce_station')),
  content_id uuid NOT NULL,
  note_text text NOT NULL CHECK (char_length(note_text) BETWEEN 1 AND 4000),
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_student_date_idx ON public.notes(student_id, created_at DESC);

CREATE TABLE public.leaderboard_opt_outs (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('case','osce_station','resource')),
  content_id text NOT NULL,
  title text NOT NULL,
  related_link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, content_type, content_id)
);

GRANT SELECT ON public.xp_events TO anon, authenticated;
GRANT SELECT ON public.achievements, public.student_achievements, public.mastery_scores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes, public.saved_items TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.leaderboard_opt_outs TO anon, authenticated;
GRANT UPDATE (notification_prefs) ON public.students TO anon, authenticated;
GRANT ALL ON public.xp_events, public.achievements, public.student_achievements, public.mastery_scores,
  public.notifications, public.notes, public.leaderboard_opt_outs, public.saved_items TO service_role;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.xp_events;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.achievements;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.student_achievements;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.mastery_scores;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.notifications;
CREATE POLICY "XP events are readable" ON public.xp_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Achievements are readable" ON public.achievements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Earned achievements are readable" ON public.student_achievements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mastery is readable" ON public.mastery_scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Notifications are readable" ON public.notifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Notifications can be created" ON public.notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Notifications can be marked read" ON public.notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Demo notes are readable" ON public.notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students add notes" ON public.notes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students edit notes" ON public.notes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Demo students delete notes" ON public.notes FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Opt outs are readable" ON public.leaderboard_opt_outs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students opt out" ON public.leaderboard_opt_outs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students opt in" ON public.leaderboard_opt_outs FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Saved items are readable" ON public.saved_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students save items" ON public.saved_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students edit saved items" ON public.saved_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Demo students unsave items" ON public.saved_items FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Demo students update notification settings" ON public.students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.level_for_xp(total_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN total_xp >= 8300 THEN 10 WHEN total_xp >= 6600 THEN 9
    WHEN total_xp >= 5100 THEN 8 WHEN total_xp >= 3800 THEN 7
    WHEN total_xp >= 2700 THEN 6 WHEN total_xp >= 1800 THEN 5
    WHEN total_xp >= 1100 THEN 4 WHEN total_xp >= 600 THEN 3
    WHEN total_xp >= 250 THEN 2 ELSE 1 END
$$;

CREATE OR REPLACE FUNCTION public.refresh_student_progress(target_student uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer; current_streak integer := 0; best_streak integer := 0; cursor_day date; previous_day date;
BEGIN
  SELECT COALESCE(sum(xp_amount), 0) INTO total FROM public.xp_events WHERE student_id = target_student;
  FOR cursor_day IN SELECT DISTINCT created_at::date FROM public.xp_events WHERE student_id = target_student ORDER BY 1 DESC LOOP
    IF previous_day IS NULL THEN
      IF cursor_day < current_date - 1 THEN EXIT; END IF;
      current_streak := 1;
    ELSIF previous_day - cursor_day = 1 THEN current_streak := current_streak + 1;
    ELSE EXIT;
    END IF;
    previous_day := cursor_day;
  END LOOP;
  SELECT COALESCE(max(run_length), 0) INTO best_streak FROM (
    SELECT count(*)::integer run_length FROM (
      SELECT activity_day, activity_day - (row_number() OVER (ORDER BY activity_day))::integer AS island
      FROM (SELECT DISTINCT created_at::date activity_day FROM public.xp_events WHERE student_id = target_student) d
    ) islands GROUP BY island
  ) runs;
  UPDATE public.students SET xp = total, level = public.level_for_xp(total),
    streak_days = current_streak, longest_streak = GREATEST(longest_streak, best_streak)
  WHERE id = target_student;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_mastery(target_student uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.mastery_scores (student_id, subject_or_system, competency, numeric_score, level_label, updated_at)
  SELECT target_student, subject_or_system, competency, round(avg(score))::integer,
    CASE WHEN avg(score) >= 75 THEN 'strong' WHEN avg(score) >= 55 THEN 'developing' ELSE 'weak' END, now()
  FROM (
    SELECT c.organ_system subject_or_system, 'Clinical reasoning' competency, ca.total_score::numeric score
      FROM public.case_attempts ca JOIN public.cases c ON c.id = ca.case_id
      WHERE ca.student_id = target_student AND ca.status = 'completed' AND ca.total_score IS NOT NULL
    UNION ALL
    SELECT q.organ_system, COALESCE(NULLIF(q.clinical_competency,''), 'Knowledge'), qs.score::numeric
      FROM public.quiz_sessions qs CROSS JOIN LATERAL unnest(qs.question_ids) question_id
      JOIN public.quiz_questions q ON q.id = question_id
      WHERE qs.student_id = target_student AND qs.completed_at IS NOT NULL AND qs.score IS NOT NULL
    UNION ALL
    SELECT o.specialty, 'Clinical skills', oa.score::numeric
      FROM public.osce_attempts oa JOIN public.osce_stations o ON o.id = oa.station_id
      WHERE oa.student_id = target_student
    UNION ALL
    SELECT d.organ_system, 'Recall', CASE fr.last_rating WHEN 'easy' THEN 90 WHEN 'good' THEN 75 WHEN 'hard' THEN 55 ELSE 35 END
      FROM public.flashcard_reviews fr JOIN public.flashcards f ON f.id = fr.flashcard_id
      JOIN public.flashcard_decks d ON d.id = f.deck_id WHERE fr.student_id = target_student
  ) scores
  GROUP BY subject_or_system, competency
  ON CONFLICT (student_id, subject_or_system, competency) DO UPDATE SET
    numeric_score = EXCLUDED.numeric_score, level_label = EXCLUDED.level_label, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.check_student_achievements(target_student uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.student_achievements (student_id, achievement_id, earned_at)
  SELECT target_student, a.id, now() FROM public.achievements a
  WHERE CASE a.criteria->>'type'
    WHEN 'cases_completed' THEN (SELECT count(*) FROM public.case_attempts WHERE student_id=target_student AND status='completed') >= (a.criteria->>'count')::int
    WHEN 'streak_days' THEN (SELECT streak_days FROM public.students WHERE id=target_student) >= (a.criteria->>'count')::int
    WHEN 'organ_system_cases' THEN (SELECT count(*) FROM public.case_attempts ca JOIN public.cases c ON c.id=ca.case_id WHERE ca.student_id=target_student AND ca.status='completed' AND c.organ_system=a.criteria->>'system') >= (a.criteria->>'count')::int
    WHEN 'high_scoring_cases' THEN (SELECT count(*) FROM public.case_attempts WHERE student_id=target_student AND status='completed' AND total_score >= COALESCE((a.criteria->>'score')::int,80)) >= (a.criteria->>'count')::int
    WHEN 'pharmacology_quizzes' THEN (SELECT count(*) FROM public.quiz_sessions qs WHERE qs.student_id=target_student AND qs.completed_at IS NOT NULL AND qs.score >= COALESCE((a.criteria->>'score')::int,85) AND EXISTS (SELECT 1 FROM unnest(qs.question_ids) question_id JOIN public.quiz_questions q ON q.id=question_id WHERE q.subject='Pharmacology')) >= (a.criteria->>'count')::int
    WHEN 'osce_completed' THEN (SELECT count(*) FROM public.osce_attempts WHERE student_id=target_student) >= (a.criteria->>'count')::int
    WHEN 'perfect_differential' THEN EXISTS (SELECT 1 FROM public.case_attempts WHERE student_id=target_student AND status='completed' AND COALESCE((score_breakdown->>'diagnostic_accuracy')::int,0) >= 30)
    WHEN 'challenge_winner' THEN EXISTS (SELECT 1 FROM public.challenge_participants WHERE student_id=target_student AND rank=1)
    WHEN 'group_participation' THEN (SELECT count(*) FROM public.group_messages WHERE student_id=target_student) >= (a.criteria->>'count')::int
    ELSE false END
  ON CONFLICT (student_id, achievement_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.on_xp_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_type <> 'streak' THEN
    INSERT INTO public.xp_events (student_id, source_type, source_id, xp_amount, created_at)
    VALUES (NEW.student_id, 'streak', md5(NEW.student_id::text || NEW.created_at::date::text)::uuid, 10, NEW.created_at)
    ON CONFLICT (student_id, source_type, source_id) DO NOTHING;
  END IF;
  PERFORM public.refresh_student_progress(NEW.student_id);
  PERFORM public.recompute_mastery(NEW.student_id);
  PERFORM public.check_student_achievements(NEW.student_id);
  RETURN NEW;
END $$;
CREATE TRIGGER xp_event_progress AFTER INSERT ON public.xp_events FOR EACH ROW EXECUTE FUNCTION public.on_xp_event();

CREATE OR REPLACE FUNCTION public.award_activity_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward integer; kind text; sid uuid; source uuid; happened timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'case_attempts' THEN
    IF NEW.status <> 'completed' OR (TG_OP='UPDATE' AND OLD.status='completed') THEN RETURN NEW; END IF;
    SELECT GREATEST(20, round(c.xp_reward * COALESCE(NEW.total_score,0) / 100.0)) INTO reward FROM public.cases c WHERE c.id=NEW.case_id;
    kind:='case'; sid:=NEW.student_id; source:=NEW.id; happened:=COALESCE(NEW.completed_at,now());
  ELSIF TG_TABLE_NAME = 'quiz_sessions' THEN
    IF NEW.completed_at IS NULL OR (TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL) THEN RETURN NEW; END IF;
    reward:=20 + round(COALESCE(NEW.score,0) * 0.5); kind:='quiz'; sid:=NEW.student_id; source:=NEW.id; happened:=NEW.completed_at;
  ELSIF TG_TABLE_NAME = 'osce_attempts' THEN
    reward:=30 + round(COALESCE(NEW.score,0) * 0.5); kind:='osce'; sid:=NEW.student_id; source:=NEW.id; happened:=NEW.completed_at;
  ELSIF TG_TABLE_NAME = 'flashcard_reviews' THEN
    IF TG_OP='UPDATE' AND NEW.last_reviewed_at IS NOT DISTINCT FROM OLD.last_reviewed_at THEN RETURN NEW; END IF;
    reward:=5; kind:='flashcard'; sid:=NEW.student_id; source:=NEW.id; happened:=COALESCE(NEW.last_reviewed_at,now());
  ELSIF TG_TABLE_NAME = 'challenge_participants' THEN
    IF NEW.student_id IS NULL THEN RETURN NEW; END IF;
    reward:=CASE WHEN NEW.rank=1 THEN 150 ELSE 75 END; kind:='challenge'; sid:=NEW.student_id; source:=NEW.id; happened:=NEW.created_at;
  ELSE
    reward:=10; kind:='group'; sid:=NEW.student_id; source:=NEW.id; happened:=NEW.created_at;
  END IF;
  INSERT INTO public.xp_events(student_id,source_type,source_id,xp_amount,created_at)
    VALUES(sid,kind,source,reward,happened) ON CONFLICT (student_id,source_type,source_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER case_attempt_xp AFTER INSERT OR UPDATE ON public.case_attempts FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();
CREATE TRIGGER quiz_session_xp AFTER INSERT OR UPDATE ON public.quiz_sessions FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();
CREATE TRIGGER osce_attempt_xp AFTER INSERT ON public.osce_attempts FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();
CREATE TRIGGER flashcard_review_xp AFTER INSERT OR UPDATE ON public.flashcard_reviews FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();
CREATE TRIGGER challenge_participation_xp AFTER INSERT ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();
CREATE TRIGGER group_participation_xp AFTER INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.award_activity_xp();

CREATE OR REPLACE FUNCTION public.refresh_mastery_after_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_mastery(NEW.student_id);
  RETURN NEW;
END $$;
CREATE TRIGGER flashcard_review_mastery AFTER INSERT OR UPDATE ON public.flashcard_reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_mastery_after_review();

CREATE OR REPLACE FUNCTION public.notify_achievement_unlock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE achievement_name text;
BEGIN
  SELECT name INTO achievement_name FROM public.achievements WHERE id=NEW.achievement_id;
  INSERT INTO public.notifications(student_id,type,message,related_link,created_at)
  VALUES(NEW.student_id,'achievements','Achievement unlocked: ' || achievement_name,'/profile?tab=achievements',NEW.earned_at);
  RETURN NEW;
END $$;
CREATE TRIGGER achievement_unlock_notification AFTER INSERT ON public.student_achievements FOR EACH ROW EXECUTE FUNCTION public.notify_achievement_unlock();

INSERT INTO public.achievements (id,name,description,icon,criteria) VALUES
('a0000000-0000-4000-8000-000000000001','First Case Completed','Finish your first clinical case.','🩺','{"type":"cases_completed","count":1}'),
('a0000000-0000-4000-8000-000000000002','10 Cases','Complete ten clinical cases.','🔟','{"type":"cases_completed","count":10}'),
('a0000000-0000-4000-8000-000000000003','100 Cases','Complete one hundred clinical cases.','💯','{"type":"cases_completed","count":100}'),
('a0000000-0000-4000-8000-000000000004','7-Day Streak','Study on seven consecutive days.','🔥','{"type":"streak_days","count":7}'),
('a0000000-0000-4000-8000-000000000005','30-Day Streak','Keep learning for thirty consecutive days.','☀️','{"type":"streak_days","count":30}'),
('a0000000-0000-4000-8000-000000000006','Cardiology Explorer','Complete five cardiovascular cases.','🫀','{"type":"organ_system_cases","system":"Cardiovascular","count":5}'),
('a0000000-0000-4000-8000-000000000007','Diagnostic Detective','Score at least 80% on two cases.','🔎','{"type":"high_scoring_cases","score":80,"count":2}'),
('a0000000-0000-4000-8000-000000000008','Pharmacology Master','Score at least 85% on five quizzes.','💊','{"type":"pharmacology_quizzes","score":85,"count":5}'),
('a0000000-0000-4000-8000-000000000009','OSCE Challenger','Complete five OSCE stations.','🎭','{"type":"osce_completed","count":5}'),
('a0000000-0000-4000-8000-000000000010','Perfect Differential','Earn full diagnostic-accuracy marks in a case.','🧠','{"type":"perfect_differential"}'),
('a0000000-0000-4000-8000-000000000011','Weekly Challenge Winner','Take first place in a weekly challenge.','🏆','{"type":"challenge_winner"}'),
('a0000000-0000-4000-8000-000000000012','Team Player','Contribute four times to your study group.','🤝','{"type":"group_participation","count":4}')
ON CONFLICT (name) DO NOTHING;

-- Extra searchable content.
INSERT INTO public.cases (id,title,teaser,specialty,organ_system,topic,year_level,difficulty,clinical_setting,estimated_minutes,xp_reward,mode,patient,initial_presentation,differential_prompt,diagnosis_options,correct_diagnosis,correct_differentials,debrief,answer_key)
VALUES ('44444444-3333-4333-8333-333333333333','Confusion after a long ward stay','An older patient becomes acutely confused overnight after surgery.','Internal Medicine','Neurology','Delirium',4,'medium','ward',18,120,'both','{"name":"Agnes N.","age":71,"sex":"Female","location":"Musanze"}','Agnes is disoriented and trying to leave the ward on the second night after hip surgery.','Build a differential for acute confusion.',ARRAY['Delirium','Dementia','Stroke','Depression'],'Delirium',ARRAY['Delirium','Stroke'],'{"summary":"Delirium is an acute, fluctuating disturbance of attention and cognition.","teaching_points":["Search for reversible triggers.","Use non-drug measures first."],"pitfalls":["Assuming all confusion is dementia."]}','{"key_history":[],"key_exams":[],"key_investigations":[],"unnecessary_investigations":[],"interpretation":"Delirium","management_correct":[],"management_harmful":[],"communication_best":""}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.flashcard_decks (id,title,description,subject,topic,organ_system,year,difficulty,is_official,tags)
VALUES ('dddddddd-0000-4000-8000-000000000005','Neurology: localisation essentials','Fast pattern recognition for common neurological lesions.','Neurology','Neurological localisation','Neurology',4,'medium',true,'{neurology,localisation}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.flashcards (deck_id,type,front,back,position) VALUES
('dddddddd-0000-4000-8000-000000000005','basic','Upper motor neuron signs?','Weakness, spasticity, hyperreflexia and an extensor plantar response.',1),
('dddddddd-0000-4000-8000-000000000005','basic','Classic features of delirium?','Acute onset, fluctuating course, inattention and altered awareness.',2),
('dddddddd-0000-4000-8000-000000000005','basic','Which lobe contains Broca area?','The dominant frontal lobe.',3);

INSERT INTO public.quiz_questions (question_text,question_type,options,correct_answer,option_explanations,key_concept,clinical_pearl,subject,organ_system,topic,year,difficulty,clinical_competency,"references",related_flashcard_deck_id) VALUES
('Which feature best distinguishes delirium from dementia?','single_best_answer','[{"id":"a","text":"Fluctuating attention"},{"id":"b","text":"Memory loss"},{"id":"c","text":"Older age"},{"id":"d","text":"Sleep disturbance"}]','"a"','{"a":"Correct — attention fluctuates over hours.","b":"Both can impair memory.","c":"Age does not distinguish them.","d":"Both can disturb sleep."}','Delirium is acute and fluctuating.','Always look for infection, medicines, pain and retention.','Neurology','Neurology','Delirium',4,'medium','Clinical reasoning',ARRAY['NICE Delirium guideline'],'dddddddd-0000-4000-8000-000000000005'),
('Select all upper motor neuron signs.','multi_response','[{"id":"a","text":"Spasticity"},{"id":"b","text":"Hyperreflexia"},{"id":"c","text":"Fasciculations"},{"id":"d","text":"Extensor plantar response"}]','["a","b","d"]','{"a":"Correct.","b":"Correct.","c":"A lower motor neuron sign.","d":"Correct."}','UMN lesions remove descending inhibition.','Compare tone, power, reflexes and plantar responses side to side.','Neurology','Neurology','Motor system',3,'medium','Physical examination',ARRAY['Davidson Medicine'],'dddddddd-0000-4000-8000-000000000005'),
('A patient has expressive aphasia and right face-arm weakness. Where is the lesion?','short_vignette','[{"id":"a","text":"Left frontal lobe"},{"id":"b","text":"Right occipital lobe"},{"id":"c","text":"Cerebellum"},{"id":"d","text":"Spinal cord"}]','"a"','{"a":"Correct — dominant frontal cortex/MCA territory.","b":"Would cause visual field loss.","c":"Causes ataxia.","d":"Does not cause aphasia."}','Cortical signs help localisation.','Speech plus contralateral weakness suggests a dominant hemispheric stroke.','Neurology','Neurology','Stroke localisation',4,'hard','Clinical reasoning',ARRAY['Oxford Handbook of Clinical Medicine'],'dddddddd-0000-4000-8000-000000000005');

-- Realistic 3-week activity for every current demo student.
INSERT INTO public.case_attempts (id,student_id,case_id,status,current_stage,score_breakdown,total_score,started_at,completed_at)
SELECT md5(s.id::text || '-case-' || n)::uuid, s.id,
  (ARRAY['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid,'33333333-3333-4333-8333-333333333333'::uuid])[n],
  'completed','debrief',jsonb_build_object('diagnostic_accuracy',CASE WHEN n=1 THEN 30 ELSE 24 END,'clinical_reasoning',20,'investigations',9,'management',18,'patient_safety',9,'communication',5),
  CASE n WHEN 1 THEN 91 WHEN 2 THEN 82 ELSE 76 END, now()-(n*7||' days')::interval-interval '22 minutes', now()-(n*7||' days')::interval
FROM public.students s CROSS JOIN generate_series(1,3) n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quiz_sessions (id,student_id,mode,question_ids,answers,score,started_at,completed_at)
SELECT md5(s.id::text || '-quiz-' || n)::uuid,s.id,'quick',
  ARRAY(SELECT id FROM public.quiz_questions ORDER BY created_at LIMIT 5),'{}'::jsonb,
  68 + ((n*7 + s.year_of_study*3) % 29), now()-(n*4||' days')::interval-interval '9 minutes',now()-(n*4||' days')::interval
FROM public.students s CROSS JOIN generate_series(0,4) n ON CONFLICT (id) DO NOTHING;

INSERT INTO public.osce_attempts (id,student_id,station_id,mode,checklist_results,score,time_taken_seconds,completed_at)
SELECT md5(s.id::text || '-osce-' || n)::uuid,s.id,o.id,'practice','[]'::jsonb,
  58 + ((n*9+s.year_of_study*4)%35),430+n*35,now()-(n*6+2||' days')::interval
FROM public.students s CROSS JOIN generate_series(0,2) n CROSS JOIN LATERAL (SELECT id FROM public.osce_stations ORDER BY created_at OFFSET (n % 3) LIMIT 1) o
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.flashcard_reviews (id,student_id,flashcard_id,ease_factor,interval_days,repetitions,due_date,last_reviewed_at,last_rating,created_at)
SELECT md5(s.id::text || '-review-' || f.id::text)::uuid,s.id,f.id,2.5,3,2,now()+interval '1 day',
  now()-((row_number() OVER (PARTITION BY s.id ORDER BY f.created_at))::int % 18 || ' days')::interval,
  CASE WHEN (row_number() OVER (PARTITION BY s.id ORDER BY f.created_at))::int % 4=0 THEN 'hard' ELSE 'good' END,
  now()-interval '20 days'
FROM public.students s CROSS JOIN (SELECT id,created_at FROM public.flashcards ORDER BY created_at LIMIT 8) f
ON CONFLICT (student_id,flashcard_id) DO NOTHING;

INSERT INTO public.xp_events(student_id,source_type,source_id,xp_amount,created_at)
SELECT s.id,'streak',md5(s.id::text || '-seed-streak-' || n)::uuid,10,now()-(n||' days')::interval
FROM public.students s CROSS JOIN generate_series(0,6) n ON CONFLICT DO NOTHING;

INSERT INTO public.challenge_participants (id,challenge_id,student_id,display_name,mode,group_name,score,time_taken_seconds,rank,created_at)
SELECT md5(s.id::text || '-challenge')::uuid,'44444444-4444-4444-8444-444444444444',s.id,s.name,'solo',s.university || ' Year ' || s.year_of_study,
  72+s.year_of_study*3,1050-s.year_of_study*20,CASE WHEN row_number() OVER (ORDER BY s.created_at)=1 THEN 1 ELSE row_number() OVER (ORDER BY s.created_at)+2 END,now()-interval '2 days'
FROM public.students s ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_messages (group_id,student_id,message,created_at)
SELECT gm.group_id,gm.student_id,'Completed a seeded practice session — sharing my progress!',now()-interval '3 days'
FROM public.group_members gm;

INSERT INTO public.mastery_scores(student_id,subject_or_system,competency,level_label,numeric_score,updated_at)
SELECT s.id,v.system,v.competency,v.label,v.score,now() FROM public.students s CROSS JOIN (VALUES
('Cardiovascular','Clinical reasoning','strong',82),('Cardiovascular','Pharmacology','weak',48),('Cardiovascular','Data interpretation','developing',66),
('Neurology','Anatomy','developing',63),('Neurology','Clinical reasoning','strong',79),('Neurology','Pharmacology','weak',51),
('Infectious disease','Diagnosis','strong',85),('Infectious disease','Management','developing',69),('Infectious disease','Recall','strong',77)
) v(system,competency,label,score)
ON CONFLICT (student_id,subject_or_system,competency) DO UPDATE SET level_label=EXCLUDED.level_label,numeric_score=EXCLUDED.numeric_score,updated_at=now();

INSERT INTO public.notifications(student_id,type,message,is_read,created_at,related_link)
SELECT s.id,n.type,n.message,n.is_read,now()-n.age,n.link FROM public.students s CROSS JOIN (VALUES
('weekly_case','A new weekly case is ready: acute confusion on the ward.',false,interval '2 hours','/cases'),
('flashcards_due','You have flashcards ready for a quick review.',false,interval '1 day','/flashcards/review'),
('group_activity','Kigali Clinical Circle shared a new study resource.',true,interval '3 days','/groups'),
('study_goals','You reached your study goal four days this week.',true,interval '5 days','/profile')
) n(type,message,is_read,age,link);

INSERT INTO public.notes(student_id,content_type,content_id,note_text,is_shared,created_at)
SELECT s.id,'case','11111111-1111-4111-8111-111111111111','Remember: orthopnoea plus raised JVP strongly supports fluid overload.',false,now()-interval '6 days' FROM public.students s
UNION ALL
SELECT s.id,'osce_station',o.id,'Open with consent, wash hands, then signpost each examination step.',false,now()-interval '3 days' FROM public.students s CROSS JOIN LATERAL (SELECT id FROM public.osce_stations ORDER BY created_at LIMIT 1) o;

INSERT INTO public.saved_items(student_id,content_type,content_id,title,related_link,created_at)
SELECT s.id,'case','11111111-1111-4111-8111-111111111111','A breathless patient in the emergency unit','/cases/11111111-1111-4111-8111-111111111111',now()-interval '8 days' FROM public.students s
UNION ALL
SELECT s.id,'resource','dddddddd-0000-4000-8000-000000000005','Neurology: localisation essentials','/flashcards/dddddddd-0000-4000-8000-000000000005',now()-interval '2 days' FROM public.students s;

DO $$ DECLARE sid uuid; BEGIN
  FOR sid IN SELECT id FROM public.students LOOP
    PERFORM public.refresh_student_progress(sid);
    PERFORM public.recompute_mastery(sid);
    PERFORM public.check_student_achievements(sid);
  END LOOP;
END $$;

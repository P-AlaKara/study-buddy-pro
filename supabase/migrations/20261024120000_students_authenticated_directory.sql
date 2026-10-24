-- Study with Annie introduced a real Supabase Auth login. Once a student signs
-- in, the shared supabase-js client sends every request as the `authenticated`
-- role instead of `anon` -- including the demo student directory read in the
-- app shell. The students table only granted SELECT/INSERT to `anon`, so a
-- signed-in session could no longer read the directory and the profile
-- switcher collapsed to a single "? student". Mirror the public demo-directory
-- access for `authenticated` so the prototype behaves the same before and after
-- an Annie sign-in.

GRANT SELECT (
  id, name, university, country, year_of_study, medical_program, current_level,
  subjects_studying, current_rotation, specialty_interests, weak_areas,
  study_goal, daily_study_target_minutes, notification_prefs, xp, level,
  streak_days, longest_streak, created_at
) ON public.students TO authenticated;
GRANT INSERT ON public.students TO authenticated;

CREATE POLICY "Demo student directory is public to members"
  ON public.students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members create a starter demo student"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (xp = 0 AND level = 1 AND streak_days = 0 AND longest_streak = 0 AND country IS NOT NULL);

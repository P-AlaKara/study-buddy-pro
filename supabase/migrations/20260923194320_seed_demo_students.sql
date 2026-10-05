-- The original Lovable database received these demo profiles outside migration
-- history. Keep them here so a fresh Supabase project can replay every later
-- foreign-keyed seed without depending on the old managed database.
INSERT INTO public.students (
  id, name, email, university, country, year_of_study, medical_program,
  current_level, subjects_studying, current_rotation, specialty_interests,
  weak_areas, study_goal, daily_study_target_minutes, notification_prefs,
  xp, level, streak_days, longest_streak, created_at
) VALUES
(
  '69fac236-6a12-4e78-8553-6fd963f45854', 'Eric Niyonsenga',
  'eric.demo@example.com', 'University of Rwanda', 'Rwanda', 2, 'MBBS',
  'Pre-clinical', ARRAY['Anatomy','Physiology','Biochemistry'], NULL,
  ARRAY['Surgery','Orthopaedics'], ARRAY['Neuroanatomy','Biochemistry'],
  'Review a little every day', 30,
  '{"weekly_digest":false,"study_reminders":true}'::jsonb,
  480, 2, 3, 6, '2026-09-23T19:43:58.298028+00:00'
),
(
  'ff417a97-c94a-4fa2-8a3c-aa0bd1c8d0bf', 'Nadia Mukamana',
  'nadia.demo@example.com', 'University of Global Health Equity', 'Rwanda', 5, 'MBBS',
  'Clinical years', ARRAY['Paediatrics','Obstetrics & Gynaecology','Public Health'],
  'Paediatrics', ARRAY['Paediatrics','Global Health'],
  ARRAY['Neonatal care','Obstetrics'], 'Prepare for OSCEs this term', 60,
  '{"weekly_digest":true,"study_reminders":false}'::jsonb,
  2180, 8, 12, 21, '2026-09-23T19:43:58.298028+00:00'
),
(
  'c20e0dae-0f4f-47fe-a552-5202bee40584', 'Patrick Habimana',
  'patrick.demo@example.com', 'University of Rwanda', 'Rwanda', 3, 'MBBS',
  'Early clinical', ARRAY['Microbiology','Pathology','Clinical Skills'],
  'Family Medicine', ARRAY['Family Medicine','Infectious Disease'],
  ARRAY['Microbiology','History taking'], 'Practice one case each week', 40,
  '{"weekly_digest":false,"study_reminders":true}'::jsonb,
  820, 4, 5, 10, '2026-09-23T19:43:58.298028+00:00'
),
(
  '79582600-ce0b-4881-b5d5-147bbb87b747', 'Aline Uwimana',
  'aline.demo@example.com', 'University of Rwanda', 'Rwanda', 4, 'MBBS',
  'Clinical years', ARRAY['Internal Medicine','Pharmacology','Pathology'],
  'Internal Medicine', ARRAY['Cardiology','Emergency Medicine'],
  ARRAY['Pharmacology','ECG interpretation'],
  'Build confidence in clinical reasoning', 45,
  '{"weekly_digest":true,"study_reminders":true}'::jsonb,
  1290, 3, 7, 14, '2026-09-23T19:43:58.298028+00:00'
)
ON CONFLICT (id) DO NOTHING;

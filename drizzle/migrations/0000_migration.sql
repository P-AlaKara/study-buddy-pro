alter table public.notifications
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists type text not null default 'info',
  add column if not exists message text not null default '',
  add column if not exists is_read boolean not null default false,
  add column if not exists related_link text;

alter table public.achievements
  add column if not exists name text not null default '',
  add column if not exists description text not null default '',
  add column if not exists icon text not null default 'trophy',
  add column if not exists criteria jsonb not null default '{}'::jsonb;

alter table public.student_achievements
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists achievement_id uuid references public.achievements(id) on delete cascade,
  add column if not exists earned_at timestamptz not null default now();

alter table public.xp_events
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists xp_amount integer not null default 0,
  add column if not exists source_type text not null default 'other',
  add column if not exists source_id uuid;

alter table public.mastery_scores
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists subject_or_system text not null default '',
  add column if not exists competency text not null default '',
  add column if not exists level_label text not null default 'Novice',
  add column if not exists numeric_score numeric not null default 0;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  note_text text not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  title text not null default '',
  related_link text,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_opt_outs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  sentiment text,
  source text,
  liked text,
  improve text,
  wanted text,
  page text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.saved_items enable row level security;
alter table public.leaderboard_opt_outs enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "anon all notes" on public.notes;
create policy "anon all notes" on public.notes for all to anon using (true) with check (true);
drop policy if exists "anon all saved_items" on public.saved_items;
create policy "anon all saved_items" on public.saved_items for all to anon using (true) with check (true);
drop policy if exists "anon all leaderboard_opt_outs" on public.leaderboard_opt_outs;
create policy "anon all leaderboard_opt_outs" on public.leaderboard_opt_outs for all to anon using (true) with check (true);
drop policy if exists "anon insert feedback" on public.feedback;
create policy "anon insert feedback" on public.feedback for insert to anon with check (true);

grant select, insert, update, delete on public.notes to anon;
grant select, insert, update, delete on public.saved_items to anon;
grant select, insert, update, delete on public.leaderboard_opt_outs to anon;
grant insert on public.feedback to anon;

insert into public.achievements (name, description, icon, criteria)
select * from (values
  ('First Steps', 'Complete your first activity', 'footprints', '{"type":"activity_count","count":1}'::jsonb),
  ('Case Solver', 'Complete your first clinical case', 'stethoscope', '{"type":"cases","count":1}'::jsonb),
  ('Case Master', 'Complete 5 clinical cases', 'brain', '{"type":"cases","count":5}'::jsonb),
  ('Quiz Whiz', 'Finish 10 quiz sessions', 'zap', '{"type":"quizzes","count":10}'::jsonb),
  ('Sharpshooter', 'Score 100% on a quiz', 'target', '{"type":"quiz_perfect","count":1}'::jsonb),
  ('Card Collector', 'Review 50 flashcards', 'layers', '{"type":"reviews","count":50}'::jsonb),
  ('OSCE Ready', 'Complete your first OSCE station', 'clipboard-check', '{"type":"osce","count":1}'::jsonb),
  ('Team Player', 'Join a study group', 'users', '{"type":"groups","count":1}'::jsonb),
  ('On Fire', 'Reach a 7-day streak', 'flame', '{"type":"streak","count":7}'::jsonb),
  ('Unstoppable', 'Reach a 30-day streak', 'rocket', '{"type":"streak","count":30}'::jsonb),
  ('Rising Star', 'Reach level 5', 'star', '{"type":"level","count":5}'::jsonb),
  ('Legend', 'Earn 5000 XP', 'trophy', '{"type":"xp","count":5000}'::jsonb)
) as v(name, description, icon, criteria)
where not exists (select 1 from public.achievements limit 1);
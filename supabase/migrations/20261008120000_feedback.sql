-- User feedback captured from the in-app feedback button and the timed
-- "are you enjoying the app?" prompt. The app is a shared demo, so the policies
-- follow the open demo model established by the earlier migrations: anyone may
-- submit feedback, but it is deliberately NOT readable by anon/authenticated
-- (only service_role / the Supabase dashboard can read it).

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  liked text CHECK (liked IS NULL OR char_length(liked) <= 4000),
  improve text CHECK (improve IS NULL OR char_length(improve) <= 4000),
  wanted text CHECK (wanted IS NULL OR char_length(wanted) <= 4000),
  source text NOT NULL DEFAULT 'button' CHECK (source IN ('button', 'prompt')),
  page text CHECK (page IS NULL OR char_length(page) <= 300),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_not_empty CHECK (
    coalesce(char_length(btrim(liked)), 0)
      + coalesce(char_length(btrim(improve)), 0)
      + coalesce(char_length(btrim(wanted)), 0) > 0
  )
);
CREATE INDEX feedback_created_idx ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT TO anon, authenticated
  WITH CHECK (true);

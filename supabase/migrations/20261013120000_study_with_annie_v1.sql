-- Study with Annie V1: private PDF notes, preprocessing, annotations and sessions.
CREATE TYPE public.annie_document_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE public.annie_annotation_type AS ENUM ('highlight', 'note', 'bookmark');
CREATE TYPE public.annie_quiz_result AS ENUM ('correct', 'partially_correct', 'incorrect', 'skipped');

CREATE TABLE public.annie_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  file_path text NOT NULL UNIQUE,
  page_count integer CHECK (page_count > 0),
  status public.annie_document_status NOT NULL DEFAULT 'processing',
  processing_error text,
  processing_attempts integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.annie_page_texts (
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  text text NOT NULL,
  layout_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (document_id, page)
);

CREATE TABLE public.annie_quiz_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  text text NOT NULL,
  prompt text NOT NULL,
  difficulty integer NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, page, text)
);

CREATE TABLE public.annie_commentary_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  text text NOT NULL,
  type text NOT NULL CHECK (type IN ('explain', 'common_mistake', 'analogy', 'context')),
  beyond_notes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.annie_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.annie_annotation_type NOT NULL,
  page integer NOT NULL CHECK (page > 0),
  geometry jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text,
  content text CHECK (content IS NULL OR char_length(content) <= 4000),
  selected_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.annie_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.annie_quiz_candidates(id) ON DELETE CASCADE,
  result public.annie_quiz_result NOT NULL,
  user_answer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_annie_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mood text NOT NULL DEFAULT 'friendly' CHECK (mood IN ('stern', 'friendly', 'cheeky')),
  chattiness text NOT NULL DEFAULT 'normal' CHECK (chattiness IN ('quiet', 'normal', 'chatty')),
  quizzes_enabled boolean NOT NULL DEFAULT true,
  commentary_enabled boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'sepia')),
  silenced_until timestamptz,
  silenced_forever boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.annie_study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{"attempted":0,"correct":0,"pages":[]}'::jsonb
);

CREATE INDEX annie_documents_user_updated_idx
  ON public.annie_documents(user_id, last_opened_at DESC NULLS LAST, created_at DESC);
CREATE INDEX annie_annotations_document_user_idx
  ON public.annie_annotations(document_id, user_id, page);
CREATE INDEX annie_attempts_candidate_user_idx
  ON public.annie_quiz_attempts(candidate_id, user_id, created_at DESC);
CREATE INDEX annie_sessions_user_document_idx
  ON public.annie_study_sessions(user_id, document_id, started_at DESC);

CREATE TRIGGER annie_documents_updated_at
  BEFORE UPDATE ON public.annie_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER annie_annotations_updated_at
  BEFORE UPDATE ON public.annie_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_annie_settings_updated_at
  BEFORE UPDATE ON public.user_annie_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.annie_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_page_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_quiz_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_commentary_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_annie_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annie_study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage Annie documents" ON public.annie_documents
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners read Annie page text" ON public.annie_page_texts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.annie_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Owners read Annie quiz candidates" ON public.annie_quiz_candidates
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.annie_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Owners read Annie commentary" ON public.annie_commentary_candidates
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.annie_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Owners manage Annie annotations" ON public.annie_annotations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.annie_documents d WHERE d.id = document_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "Owners manage Annie attempts" ON public.annie_quiz_attempts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1
      FROM public.annie_quiz_candidates q
      JOIN public.annie_documents d ON d.id = q.document_id
      WHERE q.id = candidate_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "Owners manage Annie settings" ON public.user_annie_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners manage Annie sessions" ON public.annie_study_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.annie_documents d WHERE d.id = document_id AND d.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annie_documents TO authenticated;
GRANT SELECT ON public.annie_page_texts, public.annie_quiz_candidates, public.annie_commentary_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annie_annotations, public.annie_quiz_attempts,
  public.user_annie_settings, public.annie_study_sessions TO authenticated;
GRANT ALL ON public.annie_documents, public.annie_page_texts, public.annie_quiz_candidates,
  public.annie_commentary_candidates, public.annie_annotations, public.annie_quiz_attempts,
  public.user_annie_settings, public.annie_study_sessions TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('annie-notes', 'annie-notes', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Owners read Annie PDFs" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'annie-notes' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Owners upload Annie PDFs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'annie-notes' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Owners delete Annie PDFs" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'annie-notes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

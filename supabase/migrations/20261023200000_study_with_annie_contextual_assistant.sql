-- Study with Annie: additive reading progress and cached page overviews.
ALTER TABLE public.annie_documents
  ADD COLUMN IF NOT EXISTS last_page integer NOT NULL DEFAULT 1 CHECK (last_page > 0);

CREATE TABLE IF NOT EXISTS public.annie_page_overviews (
  document_id uuid NOT NULL REFERENCES public.annie_documents(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 1200),
  learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, page)
);

ALTER TABLE public.annie_page_overviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read Annie page overviews" ON public.annie_page_overviews
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.annie_documents d
      WHERE d.id = document_id AND d.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.annie_page_overviews TO authenticated;
GRANT ALL ON public.annie_page_overviews TO service_role;


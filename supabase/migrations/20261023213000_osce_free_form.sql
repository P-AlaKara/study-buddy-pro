-- Authenticated, owner-scoped persistence for hybrid Guided/Free-form OSCE sessions.
CREATE TABLE public.osce_ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id text NOT NULL,
  osce_mode text NOT NULL CHECK (osce_mode IN ('learn', 'practice', 'exam')),
  session_seed bigint NOT NULL,
  engine_state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  ai_used boolean NOT NULL DEFAULT false,
  llm_call_count integer NOT NULL DEFAULT 0 CHECK (llm_call_count BETWEEN 0 AND 50),
  inflight_request_id uuid,
  final_result jsonb,
  ai_feedback jsonb,
  ai_feedback_status text NOT NULL DEFAULT 'not_requested'
    CHECK (ai_feedback_status IN ('not_requested', 'pending', 'complete', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.osce_ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.osce_ai_sessions(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  source_mode text NOT NULL CHECK (source_mode IN ('guided', 'free_form', 'nudge', 'system')),
  input_kind text CHECK (input_kind IS NULL OR input_kind IN ('question', 'statement', 'clinical_action', 'unclear')),
  student_text text NOT NULL DEFAULT '' CHECK (char_length(student_text) <= 1200),
  patient_response text NOT NULL DEFAULT '',
  interaction_rating text CHECK (interaction_rating IS NULL OR interaction_rating IN ('good', 'neutral', 'bad')),
  avatar_expression text,
  matched_card_ids text[] NOT NULL DEFAULT '{}',
  facts_disclosed text[] NOT NULL DEFAULT '{}',
  objectives_satisfied text[] NOT NULL DEFAULT '{}',
  objectives_penalised text[] NOT NULL DEFAULT '{}',
  cue_pickups text[] NOT NULL DEFAULT '{}',
  curveball_response_card_id text,
  evaluation_reason text,
  time_cost_seconds integer NOT NULL DEFAULT 0 CHECK (time_cost_seconds BETWEEN 0 AND 35),
  elapsed_second integer NOT NULL DEFAULT 0 CHECK (elapsed_second >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, client_request_id),
  UNIQUE (session_id, sequence)
);

CREATE TABLE public.osce_ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.osce_ai_sessions(id) ON DELETE CASCADE,
  call_kind text NOT NULL CHECK (call_kind IN ('interaction', 'nudge', 'feedback')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX osce_ai_sessions_owner_updated_idx
  ON public.osce_ai_sessions(user_id, updated_at DESC);
CREATE INDEX osce_ai_interactions_session_sequence_idx
  ON public.osce_ai_interactions(session_id, sequence);
CREATE INDEX osce_ai_usage_owner_recent_idx
  ON public.osce_ai_usage(user_id, created_at DESC);

CREATE TRIGGER osce_ai_sessions_updated_at
  BEFORE UPDATE ON public.osce_ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER osce_ai_interactions_updated_at
  BEFORE UPDATE ON public.osce_ai_interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.osce_ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osce_ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osce_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read OSCE AI sessions" ON public.osce_ai_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read OSCE AI interactions" ON public.osce_ai_interactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.osce_ai_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Owners read OSCE AI usage" ON public.osce_ai_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.osce_ai_sessions, public.osce_ai_interactions, public.osce_ai_usage
  TO authenticated;
GRANT ALL ON public.osce_ai_sessions, public.osce_ai_interactions, public.osce_ai_usage
  TO service_role;

-- Serialises every mutation for a session. A stale lock can be reclaimed after
-- a provider/runtime failure so a session cannot remain permanently wedged.
CREATE OR REPLACE FUNCTION public.acquire_osce_ai_request(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_request_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean;
BEGIN
  UPDATE public.osce_ai_sessions
  SET inflight_request_id = p_request_id
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND revision = p_expected_revision
    AND (
      inflight_request_id IS NULL
      OR inflight_request_id = p_request_id
      OR updated_at < now() - interval '45 seconds'
    )
  RETURNING true INTO acquired;

  RETURN COALESCE(acquired, false);
END;
$$;

-- Enforces both provider-call limits under database locks, including calls
-- made concurrently from different sessions belonging to the same user.
CREATE OR REPLACE FUNCTION public.reserve_osce_ai_call(
  p_session_id uuid,
  p_user_id uuid,
  p_call_kind text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_count integer;
  hourly_count integer;
BEGIN
  IF p_call_kind NOT IN ('interaction', 'nudge', 'feedback') THEN
    RAISE EXCEPTION 'invalid_call_kind';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT llm_call_count INTO session_count
  FROM public.osce_ai_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF session_count >= 50 THEN RAISE EXCEPTION 'session_call_limit'; END IF;

  SELECT count(*)::integer INTO hourly_count
  FROM public.osce_ai_usage
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '1 hour';

  IF hourly_count >= 120 THEN RAISE EXCEPTION 'hourly_call_limit'; END IF;

  INSERT INTO public.osce_ai_usage(user_id, session_id, call_kind)
  VALUES (p_user_id, p_session_id, p_call_kind);

  UPDATE public.osce_ai_sessions
  SET llm_call_count = llm_call_count + 1
  WHERE id = p_session_id AND user_id = p_user_id
  RETURNING llm_call_count INTO session_count;

  RETURN session_count;
END;
$$;

-- Commits an authoritative engine revision and its ordered interaction in one
-- transaction. The interaction upsert also completes a previously persisted
-- pending Free-form input without creating duplicate credit.
CREATE OR REPLACE FUNCTION public.commit_osce_ai_state(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_request_id uuid,
  p_engine_state jsonb,
  p_interaction jsonb,
  p_ai_used boolean DEFAULT false,
  p_complete boolean DEFAULT false,
  p_final_result jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_revision integer;
BEGIN
  UPDATE public.osce_ai_sessions
  SET
    engine_state = p_engine_state,
    revision = revision + 1,
    ai_used = ai_used OR p_ai_used,
    inflight_request_id = NULL,
    status = CASE WHEN p_complete THEN 'complete' ELSE status END,
    final_result = CASE WHEN p_complete THEN p_final_result ELSE final_result END,
    ended_at = CASE WHEN p_complete THEN COALESCE(ended_at, now()) ELSE ended_at END
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND revision = p_expected_revision
    AND inflight_request_id = p_request_id
  RETURNING revision INTO next_revision;

  IF next_revision IS NULL THEN
    RAISE EXCEPTION 'revision_or_lock_conflict' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.osce_ai_interactions (
    session_id,
    client_request_id,
    sequence,
    source_mode,
    input_kind,
    student_text,
    patient_response,
    interaction_rating,
    avatar_expression,
    matched_card_ids,
    facts_disclosed,
    objectives_satisfied,
    objectives_penalised,
    cue_pickups,
    curveball_response_card_id,
    evaluation_reason,
    time_cost_seconds,
    elapsed_second,
    status,
    error_code
  ) VALUES (
    p_session_id,
    p_request_id,
    (p_interaction->>'sequence')::integer,
    p_interaction->>'sourceMode',
    NULLIF(p_interaction->>'inputKind', ''),
    COALESCE(p_interaction->>'studentText', ''),
    COALESCE(p_interaction->>'patientResponse', ''),
    NULLIF(p_interaction->>'interactionRating', ''),
    NULLIF(p_interaction->>'avatarExpression', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'matchedCardIds', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'factsDisclosed', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'objectivesSatisfied', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'objectivesPenalised', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'cuePickups', '[]'::jsonb))),
    NULLIF(p_interaction->>'curveballResponseCardId', ''),
    NULLIF(p_interaction->>'evaluationReason', ''),
    COALESCE((p_interaction->>'timeCostSeconds')::integer, 0),
    COALESCE((p_interaction->>'elapsedSecond')::integer, 0),
    COALESCE(NULLIF(p_interaction->>'status', ''), 'complete'),
    NULLIF(p_interaction->>'errorCode', '')
  )
  ON CONFLICT (session_id, client_request_id) DO UPDATE SET
    sequence = EXCLUDED.sequence,
    source_mode = EXCLUDED.source_mode,
    input_kind = EXCLUDED.input_kind,
    student_text = EXCLUDED.student_text,
    patient_response = EXCLUDED.patient_response,
    interaction_rating = EXCLUDED.interaction_rating,
    avatar_expression = EXCLUDED.avatar_expression,
    matched_card_ids = EXCLUDED.matched_card_ids,
    facts_disclosed = EXCLUDED.facts_disclosed,
    objectives_satisfied = EXCLUDED.objectives_satisfied,
    objectives_penalised = EXCLUDED.objectives_penalised,
    cue_pickups = EXCLUDED.cue_pickups,
    curveball_response_card_id = EXCLUDED.curveball_response_card_id,
    evaluation_reason = EXCLUDED.evaluation_reason,
    time_cost_seconds = EXCLUDED.time_cost_seconds,
    elapsed_second = EXCLUDED.elapsed_second,
    status = EXCLUDED.status,
    error_code = EXCLUDED.error_code;

  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_osce_ai_request(uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_osce_ai_call(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_osce_ai_state(uuid, uuid, integer, uuid, jsonb, jsonb, boolean, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_osce_ai_request(uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_osce_ai_call(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_osce_ai_state(uuid, uuid, integer, uuid, jsonb, jsonb, boolean, boolean, jsonb) TO service_role;

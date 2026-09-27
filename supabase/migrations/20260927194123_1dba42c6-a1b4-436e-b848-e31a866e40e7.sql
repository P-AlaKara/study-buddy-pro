DROP POLICY IF EXISTS "Placeholder remains private" ON public.osce_stations;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.osce_attempts;

ALTER TABLE public.osce_stations
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN category text NOT NULL DEFAULT 'history_taking' CHECK (category IN ('history_taking','physical_exam','communication','counseling','breaking_bad_news','procedures','emergency_assessment','data_interpretation','prescribing','patient_education','ethics','consent','handover','clinical_reasoning')),
  ADD COLUMN specialty text NOT NULL DEFAULT '',
  ADD COLUMN topic text NOT NULL DEFAULT '',
  ADD COLUMN year integer NOT NULL DEFAULT 3,
  ADD COLUMN difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 8,
  ADD COLUMN candidate_instructions text NOT NULL DEFAULT '',
  ADD COLUMN patient_instructions jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN examiner_checklist jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN global_assessment_criteria jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN hints text[] NOT NULL DEFAULT '{}',
  ADD COLUMN suggested_structure text[] NOT NULL DEFAULT '{}',
  ADD COLUMN learning_points text[] NOT NULL DEFAULT '{}',
  ADD COLUMN resources jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN is_published boolean NOT NULL DEFAULT true;
GRANT SELECT ON public.osce_stations TO anon, authenticated;
GRANT ALL ON public.osce_stations TO service_role;
CREATE POLICY "Published stations are browsable" ON public.osce_stations FOR SELECT TO anon, authenticated USING (is_published);

ALTER TABLE public.osce_attempts
  ADD COLUMN student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN station_id uuid NOT NULL REFERENCES public.osce_stations(id) ON DELETE CASCADE,
  ADD COLUMN mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice','exam','peer')),
  ADD COLUMN checklist_results jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  ADD COLUMN time_taken_seconds integer NOT NULL DEFAULT 0 CHECK (time_taken_seconds >= 0),
  ADD COLUMN completed_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT ON public.osce_attempts TO anon, authenticated;
GRANT ALL ON public.osce_attempts TO service_role;
CREATE POLICY "OSCE attempts are readable" ON public.osce_attempts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students record OSCE attempts" ON public.osce_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.osce_circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('single','5_station','10_station','custom')),
  station_ids uuid[] NOT NULL CHECK (cardinality(station_ids) BETWEEN 1 AND 20),
  created_by_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.osce_circuits TO anon, authenticated;
GRANT ALL ON public.osce_circuits TO service_role;
ALTER TABLE public.osce_circuits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circuits are readable" ON public.osce_circuits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students build circuits" ON public.osce_circuits FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.osce_circuit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES public.osce_circuits(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  per_station_results jsonb NOT NULL DEFAULT '[]',
  overall_result text NOT NULL DEFAULT '',
  competency_breakdown jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.osce_circuit_attempts TO anon, authenticated;
GRANT ALL ON public.osce_circuit_attempts TO service_role;
ALTER TABLE public.osce_circuit_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circuit results are readable" ON public.osce_circuit_attempts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students record circuit results" ON public.osce_circuit_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.peer_osce_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.osce_stations(id) ON DELETE CASCADE,
  candidate_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  patient_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  examiner_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.peer_osce_sessions TO anon, authenticated;
GRANT ALL ON public.peer_osce_sessions TO service_role;
ALTER TABLE public.peer_osce_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Peer sessions are readable" ON public.peer_osce_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students start peer sessions" ON public.peer_osce_sessions FOR INSERT TO anon, authenticated WITH CHECK (status = 'active');
CREATE POLICY "Active peer sessions can change" ON public.peer_osce_sessions FOR UPDATE TO anon, authenticated USING (status = 'active') WITH CHECK (true);

INSERT INTO public.osce_stations (title, category, specialty, topic, year, difficulty, duration_minutes, candidate_instructions, patient_instructions, examiner_checklist, global_assessment_criteria, hints, suggested_structure, learning_points, resources) VALUES
('Chest pain in a 56-year-old man', 'history_taking', 'Internal Medicine', 'Acute coronary syndrome', 3, 'medium', 8,
'You are a medical intern at a district hospital emergency unit in Kigali. Mr Emmanuel Habimana, 56, has come in with chest pain. Take a focused history. You do not need to examine the patient. At the end, tell the examiner your most likely diagnosis and two immediate steps.',
'{"background":"You are Emmanuel Habimana, 56, a secondary-school headteacher in Kigali. Married, three children.","opening":"Doctor, I have this heavy pain in my chest and I am frightened.","symptoms":"Central, heavy, pressing chest pain that started 90 minutes ago while climbing stairs at school. It has not gone away with rest. Severity 8/10. It spreads to your left arm and jaw. You feel sweaty and a little sick.","history":"High blood pressure for 6 years — you stopped your tablets (amlodipine) 4 months ago because you felt fine. Father died suddenly at 60. You smoked 10 cigarettes a day for 25 years and still smoke. You drink 2–3 beers at weekends. No known diabetes, but you have not been checked for years.","emotional_state":"Anxious and restless; you keep asking whether this is a heart attack. Calm down if the doctor explains things clearly.","reveal_on_ask":["Pain radiates to left arm and jaw — only if asked about spread","Sweating and nausea — only if asked about associated symptoms","You stopped your blood pressure tablets — only if asked about medicines","Father died suddenly at 60 — only if asked about family history","You still smoke — only if asked about smoking","No pain on breathing in and no recent long journeys — only if asked","No allergies"]}',
'[{"id":"h1","item":"Introduces self, confirms patient identity and gains consent","marks":1,"domain":"communication"},{"id":"h2","item":"Opens with an open question and lets the patient talk","marks":1,"domain":"communication"},{"id":"h3","item":"Establishes site, onset and character of the pain","marks":2,"domain":"history"},{"id":"h4","item":"Asks about radiation (arm, jaw)","marks":1,"domain":"history"},{"id":"h5","item":"Asks about duration, severity and relation to exertion/rest","marks":2,"domain":"history"},{"id":"h6","item":"Asks about associated symptoms: sweating, nausea, breathlessness, palpitations, syncope","marks":2,"domain":"history"},{"id":"h7","item":"Screens for differentials: pleuritic pain, recent immobility, tearing pain to back, reflux","marks":2,"domain":"reasoning"},{"id":"h8","item":"Takes past medical history including hypertension and diabetes","marks":1,"domain":"history"},{"id":"h9","item":"Takes drug history and identifies stopped antihypertensive; asks about allergies","marks":2,"domain":"safety"},{"id":"h10","item":"Asks family history of heart disease or sudden death","marks":1,"domain":"history"},{"id":"h11","item":"Asks smoking and alcohol history","marks":1,"domain":"history"},{"id":"h12","item":"Acknowledges patient anxiety with empathy","marks":1,"domain":"communication"},{"id":"h13","item":"Summarises the history back to the patient","marks":1,"domain":"communication"},{"id":"h14","item":"States acute coronary syndrome as most likely diagnosis","marks":2,"domain":"reasoning"},{"id":"h15","item":"Names urgent next steps: 12-lead ECG within 10 minutes and aspirin 300 mg (if no allergy)","marks":2,"domain":"safety","safety":true}]',
'[{"domain":"Communication","descriptor":"Clear, empathetic, patient-centred; avoids jargon"},{"domain":"Organisation","descriptor":"Logical flow from presenting complaint to risk factors"},{"domain":"Clinical reasoning","descriptor":"Recognises a time-critical diagnosis and acts on it"},{"domain":"Overall","descriptor":"Fail / Borderline / Pass / Good pass"}]',
'{"Use SOCRATES for the pain","Ask what medicines he should be taking — not only what he takes","Remember the dangerous differentials: aortic dissection and pulmonary embolism"}',
'{"Introduction and consent","Open question, then SOCRATES","Associated symptoms","Red-flag differentials","Past history, drugs, allergies","Family and social history","Ideas, concerns, expectations","Summary, diagnosis and immediate plan"}',
'{"Ongoing exertional chest pain with radiation and sweating is ACS until proven otherwise","An ECG within 10 minutes of arrival is the single most important first step","Always ask about stopped medicines — non-adherence is a common hidden risk factor","Screen for dissection before giving antithrombotic therapy"}',
'[{"title":"WHO HEARTS technical package","type":"Guideline"},{"title":"Rwanda national guidelines for cardiovascular disease","type":"Guideline"},{"title":"SOCRATES pain history mnemonic","type":"Revision note"}]'),

('Respiratory examination', 'physical_exam', 'Internal Medicine', 'Community-acquired pneumonia', 2, 'easy', 8,
'You are a student on the medical ward at Butaro District Hospital. Ms Claudine Uwase, 34, was admitted with fever and cough. Perform a respiratory examination and tell the examiner your findings and likely diagnosis.',
'{"background":"You are Claudine Uwase, 34, a market trader. You have had fever and a cough with yellow sputum for 4 days.","opening":"Good morning, doctor.","symptoms":"Mild pain on the right side of your chest when you breathe in deeply. Feel tired.","history":"No previous lung disease. HIV negative last year.","emotional_state":"Tired but cooperative. Wince slightly when you breathe deeply.","reveal_on_ask":["Right-sided chest pain on deep breathing — if asked about pain","Examiner signs to give when examined: RR 24, SpO2 93% on air, temp 38.6°C","Reduced expansion, dull percussion, bronchial breathing and crackles at the right base","Increased vocal resonance at the right base; no clubbing, no lymphadenopathy, trachea central"]}',
'[{"id":"e1","item":"Washes hands, introduces self, confirms identity and consent","marks":1,"domain":"safety"},{"id":"e2","item":"Positions patient at 45° and exposes chest appropriately, respecting dignity","marks":1,"domain":"communication"},{"id":"e3","item":"General inspection from end of bed (distress, oxygen, sputum pot, respiratory rate)","marks":2,"domain":"exam"},{"id":"e4","item":"Examines hands: clubbing, cyanosis, flap, pulse","marks":1,"domain":"exam"},{"id":"e5","item":"Examines face, eyes and mouth for pallor and central cyanosis","marks":1,"domain":"exam"},{"id":"e6","item":"Checks trachea position and lymph nodes","marks":1,"domain":"exam"},{"id":"e7","item":"Assesses chest expansion front and back","marks":2,"domain":"exam"},{"id":"e8","item":"Percusses comparing sides, including axillae","marks":2,"domain":"exam"},{"id":"e9","item":"Auscultates all zones comparing sides","marks":2,"domain":"exam"},{"id":"e10","item":"Tests vocal resonance or tactile fremitus","marks":1,"domain":"exam"},{"id":"e11","item":"Checks for ankle oedema / sacral oedema","marks":1,"domain":"exam"},{"id":"e12","item":"Thanks patient and helps them re-dress","marks":1,"domain":"communication"},{"id":"e13","item":"Presents findings clearly: right basal consolidation","marks":2,"domain":"reasoning"},{"id":"e14","item":"Suggests right lower lobe pneumonia and requests chest X-ray, sputum, oxygen saturation monitoring","marks":2,"domain":"reasoning"},{"id":"e15","item":"Recognises SpO2 93% and raised RR as markers needing oxygen/close review","marks":1,"domain":"safety","safety":true}]',
'[{"domain":"Technique","descriptor":"Systematic, fluent, compares sides"},{"domain":"Patient care","descriptor":"Explains each step, maintains dignity and comfort"},{"domain":"Presentation","descriptor":"Concise, positive and relevant negatives"},{"domain":"Overall","descriptor":"Fail / Borderline / Pass / Good pass"}]',
'{"Inspection, palpation, percussion, auscultation — front then back","Always compare left with right","Dullness + bronchial breathing + increased resonance = consolidation"}',
'{"WIPER: wash, introduce, position, expose, reassure","End-of-bed inspection","Hands, face, neck","Anterior chest: inspect, palpate, percuss, auscultate","Posterior chest, same sequence","Oedema and finish","Present findings and plan"}',
'{"Consolidation gives dullness, bronchial breathing and increased vocal resonance","Stony dullness with reduced resonance suggests effusion instead","Report vital signs — hypoxia changes management","Use CURB-65 to judge severity"}',
'[{"title":"Macleod''s Clinical Examination — respiratory chapter","type":"Textbook"},{"title":"CURB-65 severity score","type":"Tool"}]'),

('Counselling after a positive HIV test', 'counseling', 'Family Medicine', 'HIV diagnosis and ART initiation', 4, 'hard', 10,
'You are a doctor at a health centre in Musanze. Mr Jean Paul Niyonzima, 28, had a routine HIV test at his request. The result is positive (confirmed by the national algorithm). Share the result, counsel him, and agree next steps. You do not need to take a full history.',
'{"background":"You are Jean Paul Niyonzima, 28, a motorcycle taxi driver. You have a girlfriend, Aline, of 1 year, and plan to marry. You asked for the test because a friend recently tested positive.","opening":"So, doctor, is my result ready?","symptoms":"You feel completely well.","history":"No illnesses. You once had a painful sore on the penis 2 years ago that healed. You do not always use condoms.","emotional_state":"Shocked and silent at first, then tearful. You fear your family will reject you and you ask: ''Am I going to die?'' You become calmer if the doctor pauses, shows empathy and explains that treatment works.","reveal_on_ask":["Your girlfriend Aline has not been tested — if asked about partners","You are worried about telling Aline and your mother — if asked about concerns","You drink alcohol most evenings — if asked about lifestyle","You are willing to start treatment today once you understand it is lifelong and effective","You have no cough, fever or weight loss — if screened for TB"]}',
'[{"id":"c1","item":"Introduces self, confirms identity, ensures privacy and confidentiality","marks":1,"domain":"communication"},{"id":"c2","item":"Checks what the patient understands and whether he is ready for the result","marks":1,"domain":"communication"},{"id":"c3","item":"Gives a warning shot then delivers the result clearly without jargon","marks":2,"domain":"communication"},{"id":"c4","item":"Pauses and allows silence and emotional reaction","marks":2,"domain":"communication"},{"id":"c5","item":"Responds empathetically to distress and the question about dying","marks":2,"domain":"communication"},{"id":"c6","item":"Explains HIV is a manageable long-term condition with ART; U=U","marks":2,"domain":"reasoning"},{"id":"c7","item":"Explores concerns about family, partner and stigma","marks":1,"domain":"communication"},{"id":"c8","item":"Discusses partner notification and offers partner testing","marks":2,"domain":"safety","safety":true},{"id":"c9","item":"Advises consistent condom use to protect partner","marks":1,"domain":"safety","safety":true},{"id":"c10","item":"Screens for TB symptoms","marks":1,"domain":"safety","safety":true},{"id":"c11","item":"Offers same-day ART initiation and explains adherence","marks":2,"domain":"reasoning"},{"id":"c12","item":"Mentions baseline tests (e.g. viral load plan, creatinine, hepatitis B) and follow-up","marks":1,"domain":"reasoning"},{"id":"c13","item":"Addresses alcohol use and links to support / peer groups","marks":1,"domain":"communication"},{"id":"c14","item":"Checks understanding (teach-back) and agrees a clear plan","marks":1,"domain":"communication"},{"id":"c15","item":"Offers a follow-up appointment and contact for questions","marks":1,"domain":"communication"}]',
'[{"domain":"Rapport","descriptor":"Warm, non-judgemental, confidential"},{"domain":"Information giving","descriptor":"Small chunks, checks understanding, no jargon"},{"domain":"Emotional handling","descriptor":"Uses silence, names emotion, responds to cues"},{"domain":"Overall","descriptor":"Fail / Borderline / Pass / Good pass"}]',
'{"Use SPIKES to share difficult news","Silence is a skill — count to five after giving the result","Don''t forget partner testing and TB screening"}',
'{"Setting and introduction (privacy)","Perception: what does he know?","Invitation: is he ready?","Knowledge: warning shot, then result","Emotions: pause, empathise","Strategy: ART today, partner testing, condoms, TB screen, support","Teach-back and follow-up"}',
'{"SPIKES provides structure for delivering difficult news","Rwanda follows a test-and-treat approach: offer same-day ART","U=U: an undetectable viral load means HIV is not sexually transmitted","Partner notification and TB screening are safety-critical steps"}',
'[{"title":"Rwanda national HIV guidelines (RBC)","type":"Guideline"},{"title":"SPIKES protocol for breaking bad news","type":"Framework"},{"title":"WHO consolidated HIV guidelines","type":"Guideline"}]');
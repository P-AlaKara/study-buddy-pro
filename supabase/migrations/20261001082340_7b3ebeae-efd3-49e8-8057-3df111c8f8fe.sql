
DROP POLICY IF EXISTS "Placeholder remains private" ON public.quiz_questions;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.flashcards;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.flashcard_reviews;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.groups;
DROP POLICY IF EXISTS "Placeholder remains private" ON public.group_members;

-- QUIZ QUESTIONS
ALTER TABLE public.quiz_questions
  ADD COLUMN question_text text NOT NULL DEFAULT '',
  ADD COLUMN question_type text NOT NULL DEFAULT 'single_best_answer' CHECK (question_type IN ('single_best_answer','multi_response','image','image_hotspot','matching','sequencing','short_vignette')),
  ADD COLUMN options jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN correct_answer jsonb NOT NULL DEFAULT '""',
  ADD COLUMN option_explanations jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN key_concept text NOT NULL DEFAULT '',
  ADD COLUMN clinical_pearl text NOT NULL DEFAULT '',
  ADD COLUMN subject text NOT NULL DEFAULT 'General',
  ADD COLUMN organ_system text NOT NULL DEFAULT 'General',
  ADD COLUMN topic text NOT NULL DEFAULT 'General',
  ADD COLUMN year integer NOT NULL DEFAULT 1,
  ADD COLUMN difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  ADD COLUMN clinical_competency text NOT NULL DEFAULT '',
  ADD COLUMN media_url text,
  ADD COLUMN "references" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN related_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN related_flashcard_deck_id uuid;
GRANT SELECT ON public.quiz_questions TO anon, authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
CREATE POLICY "Quiz questions are readable" ON public.quiz_questions FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.quiz_sessions
  ADD COLUMN student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN mode text NOT NULL DEFAULT 'quick' CHECK (mode IN ('quick','topic','adaptive','timed','mistakes','bookmarked','group')),
  ADD COLUMN group_id uuid,
  ADD COLUMN question_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN answers jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN score integer,
  ADD COLUMN started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN completed_at timestamptz;
GRANT SELECT, INSERT, UPDATE ON public.quiz_sessions TO anon, authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;
CREATE POLICY "Quiz sessions are readable" ON public.quiz_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students start quiz sessions" ON public.quiz_sessions FOR INSERT TO anon, authenticated WITH CHECK (completed_at IS NULL);
CREATE POLICY "Open quiz sessions can be finished" ON public.quiz_sessions FOR UPDATE TO anon, authenticated USING (completed_at IS NULL) WITH CHECK (true);

CREATE TABLE public.bookmarked_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, question_id));
GRANT SELECT, INSERT, DELETE ON public.bookmarked_questions TO anon, authenticated;
GRANT ALL ON public.bookmarked_questions TO service_role;
ALTER TABLE public.bookmarked_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bookmarks are readable" ON public.bookmarked_questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students bookmark" ON public.bookmarked_questions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students unbookmark" ON public.bookmarked_questions FOR DELETE TO anon, authenticated USING (true);

-- FLASHCARDS
ALTER TABLE public.flashcard_decks
  ADD COLUMN title text NOT NULL DEFAULT 'Untitled deck',
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN subject text NOT NULL DEFAULT 'General',
  ADD COLUMN topic text NOT NULL DEFAULT '',
  ADD COLUMN organ_system text NOT NULL DEFAULT '',
  ADD COLUMN year integer NOT NULL DEFAULT 1,
  ADD COLUMN difficulty text NOT NULL DEFAULT 'medium',
  ADD COLUMN is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN owner_student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER flashcard_decks_updated_at BEFORE UPDATE ON public.flashcard_decks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.flashcard_decks TO anon, authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
CREATE POLICY "Decks are readable" ON public.flashcard_decks FOR SELECT TO anon, authenticated USING (is_published OR owner_student_id IS NOT NULL);
CREATE POLICY "Demo students create personal decks" ON public.flashcard_decks FOR INSERT TO anon, authenticated WITH CHECK (NOT is_official AND owner_student_id IS NOT NULL);
CREATE POLICY "Personal decks can be edited" ON public.flashcard_decks FOR UPDATE TO anon, authenticated USING (NOT is_official) WITH CHECK (NOT is_official);
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_deck_fk FOREIGN KEY (related_flashcard_deck_id) REFERENCES public.flashcard_decks(id) ON DELETE SET NULL;

ALTER TABLE public.flashcards
  ADD COLUMN deck_id uuid NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  ADD COLUMN type text NOT NULL DEFAULT 'basic' CHECK (type IN ('basic','cloze','image','image_identification','anatomy_labeling','ecg','histology')),
  ADD COLUMN front text NOT NULL DEFAULT '',
  ADD COLUMN back text NOT NULL DEFAULT '',
  ADD COLUMN cloze_text text,
  ADD COLUMN image_url text,
  ADD COLUMN position integer NOT NULL DEFAULT 0;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO anon, authenticated;
GRANT ALL ON public.flashcards TO service_role;
CREATE POLICY "Cards are readable" ON public.flashcards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Cards added to personal decks" ON public.flashcards FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND NOT d.is_official));
CREATE POLICY "Cards edited in personal decks" ON public.flashcards FOR UPDATE TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND NOT d.is_official)) WITH CHECK (EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND NOT d.is_official));
CREATE POLICY "Cards removed from personal decks" ON public.flashcards FOR DELETE TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND NOT d.is_official));

ALTER TABLE public.flashcard_reviews
  ADD COLUMN student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  ADD COLUMN ease_factor numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN interval_days numeric NOT NULL DEFAULT 1,
  ADD COLUMN repetitions integer NOT NULL DEFAULT 0,
  ADD COLUMN due_date timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_reviewed_at timestamptz,
  ADD COLUMN last_rating text CHECK (last_rating IN ('again','hard','good','easy')),
  ADD CONSTRAINT flashcard_reviews_unique UNIQUE (student_id, flashcard_id);
GRANT SELECT, INSERT, UPDATE ON public.flashcard_reviews TO anon, authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;
CREATE POLICY "Reviews are readable" ON public.flashcard_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students record reviews" ON public.flashcard_reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students reschedule reviews" ON public.flashcard_reviews FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (ease_factor >= 1.3);

CREATE TABLE public.saved_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, deck_id));
GRANT SELECT, INSERT, DELETE ON public.saved_decks TO anon, authenticated;
GRANT ALL ON public.saved_decks TO service_role;
ALTER TABLE public.saved_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Saved decks are readable" ON public.saved_decks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students save decks" ON public.saved_decks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students unsave decks" ON public.saved_decks FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.suggested_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('quiz','case','osce')),
  source_id uuid NOT NULL,
  suggested_flashcard_id uuid REFERENCES public.flashcards(id) ON DELETE SET NULL,
  front text NOT NULL,
  back text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','added','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.suggested_flashcards TO anon, authenticated;
GRANT ALL ON public.suggested_flashcards TO service_role;
ALTER TABLE public.suggested_flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suggestions are readable" ON public.suggested_flashcards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Suggestions are created pending" ON public.suggested_flashcards FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "Pending suggestions can be resolved" ON public.suggested_flashcards FOR UPDATE TO anon, authenticated USING (status = 'pending') WITH CHECK (status IN ('added','dismissed'));

-- GROUPS
ALTER TABLE public.groups
  ADD COLUMN name text NOT NULL DEFAULT 'Study group',
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN invite_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 6)),
  ADD COLUMN created_by_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD CONSTRAINT groups_invite_code_unique UNIQUE (invite_code);
GRANT SELECT, INSERT ON public.groups TO anon, authenticated;
GRANT ALL ON public.groups TO service_role;
CREATE POLICY "Groups are readable" ON public.groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students create groups" ON public.groups FOR INSERT TO anon, authenticated WITH CHECK (length(name) BETWEEN 2 AND 80);
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_group_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE public.group_members
  ADD COLUMN group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD COLUMN student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','team_lead','admin')),
  ADD CONSTRAINT group_members_unique UNIQUE (group_id, student_id);
GRANT SELECT, INSERT, DELETE ON public.group_members TO anon, authenticated;
GRANT ALL ON public.group_members TO service_role;
CREATE POLICY "Members are readable" ON public.group_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo students join groups" ON public.group_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo students leave groups" ON public.group_members FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.group_messages TO anon, authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group messages are readable" ON public.group_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Members post messages" ON public.group_messages FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = group_messages.group_id AND m.student_id = group_messages.student_id));

CREATE TABLE public.group_shared_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('deck','case','note','link')),
  resource_ref text NOT NULL,
  title text NOT NULL DEFAULT '',
  shared_by_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.group_shared_resources TO anon, authenticated;
GRANT ALL ON public.group_shared_resources TO service_role;
ALTER TABLE public.group_shared_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared resources are readable" ON public.group_shared_resources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Members share resources" ON public.group_shared_resources FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = group_shared_resources.group_id AND m.student_id = group_shared_resources.shared_by_student_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- SEED: DECKS
INSERT INTO public.flashcard_decks (id, title, description, subject, topic, organ_system, year, difficulty, is_official, owner_student_id, tags) VALUES
('dddddddd-0000-4000-8000-000000000001','Cardiovascular drugs essentials','Mechanisms, side effects and classic exam traps for heart drugs.','Pharmacology','Cardiovascular drugs','Cardiovascular',3,'medium',true,NULL,'{pharmacology,cardiology}'),
('dddddddd-0000-4000-8000-000000000002','ECG and cardiac physiology','Waves, intervals and rhythms you must recognise.','Physiology','Cardiac cycle and ECG','Cardiovascular',2,'medium',true,NULL,'{ecg,physiology}'),
('dddddddd-0000-4000-8000-000000000003','Malaria and tropical infections','Parasite life cycle, severe malaria and treatment in Rwanda.','Pathology','Infectious disease','Haematology',3,'hard',true,NULL,'{malaria,infection}'),
('dddddddd-0000-4000-8000-000000000004','My renal and electrolyte notes','Aline''s quick notes for the renal block.','Physiology','Renal physiology','Renal',3,'medium',false,'79582600-ce0b-4881-b5d5-147bbb87b747','{renal,personal}');

INSERT INTO public.flashcards (deck_id, type, front, back, cloze_text, image_url, position) VALUES
('dddddddd-0000-4000-8000-000000000001','basic','Mechanism of action of furosemide?','Inhibits the Na-K-2Cl co-transporter in the thick ascending limb of the loop of Henle.',NULL,NULL,1),
('dddddddd-0000-4000-8000-000000000001','cloze','ACE inhibitor cough','ACE inhibitors cause a dry cough because they block the breakdown of bradykinin.','ACE inhibitors cause a dry cough because they block the breakdown of {{c1::bradykinin}}.',NULL,2),
('dddddddd-0000-4000-8000-000000000001','basic','Antidote for warfarin over-anticoagulation with bleeding?','Vitamin K (IV) plus prothrombin complex concentrate or fresh frozen plasma.',NULL,NULL,3),
('dddddddd-0000-4000-8000-000000000001','cloze','Digoxin toxicity vision','Digoxin toxicity classically causes yellow-green vision (xanthopsia).','Digoxin toxicity classically causes {{c1::yellow-green}} vision.',NULL,4),
('dddddddd-0000-4000-8000-000000000001','basic','Which beta-blockers reduce mortality in heart failure?','Bisoprolol, carvedilol and metoprolol succinate (start low, go slow).',NULL,NULL,5),
('dddddddd-0000-4000-8000-000000000001','ecg','Name the rhythm shown. Which drug class controls the rate?','Normal sinus rhythm - labelled P wave, QRS complex and T wave. (Rate control drugs are used for AF, not sinus rhythm.)',NULL,'https://commons.wikimedia.org/wiki/Special:FilePath/SinusRhythmLabels.svg?width=640',6),
('dddddddd-0000-4000-8000-000000000002','ecg','Identify the labelled waves and intervals on this trace.','P wave = atrial depolarisation; QRS = ventricular depolarisation; T wave = ventricular repolarisation; PR interval 120-200 ms.',NULL,'https://commons.wikimedia.org/wiki/Special:FilePath/SinusRhythmLabels.svg?width=640',1),
('dddddddd-0000-4000-8000-000000000002','ecg','What rhythm is this?','Atrial fibrillation - irregularly irregular rhythm with no discernible P waves.',NULL,'https://commons.wikimedia.org/wiki/Special:FilePath/Afib_ecg.jpg?width=640',2),
('dddddddd-0000-4000-8000-000000000002','cloze','Normal QRS duration','A normal QRS complex is shorter than 120 ms.','A normal QRS complex is shorter than {{c1::120 ms}}.',NULL,3),
('dddddddd-0000-4000-8000-000000000002','basic','What is the Frank-Starling law?','Stroke volume rises with increased end-diastolic volume (preload), up to a limit.',NULL,NULL,4),
('dddddddd-0000-4000-8000-000000000002','cloze','First heart sound','S1 is caused by closure of the mitral and tricuspid valves.','S1 is caused by closure of the {{c1::mitral and tricuspid}} valves.',NULL,5),
('dddddddd-0000-4000-8000-000000000003','histology','Identify the parasite stage in this blood film.','Plasmodium falciparum ring forms (trophozoites) inside red cells.',NULL,'https://commons.wikimedia.org/wiki/Special:FilePath/Plasmodium_falciparum_01.png?width=640',1),
('dddddddd-0000-4000-8000-000000000003','basic','First-line treatment for severe malaria?','IV (or IM) artesunate, then complete a full course of oral artemisinin combination therapy.',NULL,NULL,2),
('dddddddd-0000-4000-8000-000000000003','cloze','Hypoglycaemia in malaria','Always check blood glucose in severe malaria - hypoglycaemia is common, especially in children.','Always check {{c1::blood glucose}} in severe malaria.',NULL,3),
('dddddddd-0000-4000-8000-000000000003','basic','Vector that transmits malaria?','The female Anopheles mosquito.',NULL,NULL,4),
('dddddddd-0000-4000-8000-000000000003','basic','Name three features of severe malaria.','Impaired consciousness, repeated convulsions, severe anaemia, respiratory distress, hypoglycaemia, shock, high parasitaemia.',NULL,NULL,5),
('dddddddd-0000-4000-8000-000000000004','basic','Where is most sodium reabsorbed in the nephron?','Proximal convoluted tubule (about 65%).',NULL,NULL,1),
('dddddddd-0000-4000-8000-000000000004','cloze','ADH action','ADH inserts aquaporin-2 channels in the collecting duct.','ADH inserts {{c1::aquaporin-2}} channels in the collecting duct.',NULL,2),
('dddddddd-0000-4000-8000-000000000004','basic','ECG sign of hyperkalaemia?','Tall peaked T waves, then wide QRS and loss of P waves.',NULL,NULL,3),
('dddddddd-0000-4000-8000-000000000004','image_identification','Which chamber pumps blood to the body?','The left ventricle.',NULL,'https://commons.wikimedia.org/wiki/Special:FilePath/Diagram_of_the_human_heart_(cropped).svg?width=640',4),
('dddddddd-0000-4000-8000-000000000004','cloze','Normal GFR','Normal GFR is about 120 ml/min.','Normal GFR is about {{c1::120}} ml/min.',NULL,5);

-- SEED: QUIZ QUESTIONS
INSERT INTO public.quiz_questions (question_text, question_type, options, correct_answer, option_explanations, key_concept, clinical_pearl, subject, organ_system, topic, year, difficulty, clinical_competency, media_url, "references", related_case_id, related_flashcard_deck_id)
SELECT x.q, x.t, x.o, x.a, x.e, x.k, x.p, x.s, x.os, x.tp, x.y, x.d, x.c, x.m, ARRAY(SELECT jsonb_array_elements_text(coalesce(x.r,'[]'))), x.rc, x.rd
FROM jsonb_to_recordset($j$[
{"q":"A 64-year-old with acute pulmonary oedema needs rapid offloading of fluid. Which drug acts on the thick ascending limb of the loop of Henle?","t":"single_best_answer","o":[{"id":"a","text":"Furosemide"},{"id":"b","text":"Hydrochlorothiazide"},{"id":"c","text":"Spironolactone"},{"id":"d","text":"Acetazolamide"}],"a":"a","e":{"a":"Correct - loop diuretic blocking NKCC2 in the thick ascending limb.","b":"Thiazides act on the distal convoluted tubule.","c":"Spironolactone antagonises aldosterone in the collecting duct.","d":"Acetazolamide inhibits carbonic anhydrase in the proximal tubule."},"k":"Loop diuretics inhibit the Na-K-2Cl co-transporter.","p":"Monitor potassium - loop diuretics cause hypokalaemia.","s":"Pharmacology","os":"Cardiovascular","tp":"Diuretics","y":3,"d":"easy","c":"Prescribing","r":["BNF: Loop diuretics","Rwanda Standard Treatment Guidelines"],"rc":"11111111-1111-4111-8111-111111111111","rd":"dddddddd-0000-4000-8000-000000000001"},
{"q":"Which drug is MOST likely to cause a dry persistent cough?","t":"single_best_answer","o":[{"id":"a","text":"Losartan"},{"id":"b","text":"Enalapril"},{"id":"c","text":"Amlodipine"},{"id":"d","text":"Atenolol"}],"a":"b","e":{"a":"ARBs do not raise bradykinin, so are a good switch for ACE-inhibitor cough.","b":"Correct - ACE inhibitors block bradykinin breakdown.","c":"Amlodipine causes ankle oedema and flushing.","d":"Beta-blockers cause fatigue and bradycardia, not cough."},"k":"ACE inhibitors increase bradykinin levels.","p":"Switch to an ARB if cough is troublesome.","s":"Pharmacology","os":"Cardiovascular","tp":"Antihypertensives","y":3,"d":"easy","c":"Prescribing","r":["BNF: ACE inhibitors"],"rd":"dddddddd-0000-4000-8000-000000000001"},
{"q":"Select ALL drugs proven to reduce mortality in heart failure with reduced ejection fraction.","t":"multi_response","o":[{"id":"a","text":"Bisoprolol"},{"id":"b","text":"Furosemide"},{"id":"c","text":"Spironolactone"},{"id":"d","text":"Enalapril"},{"id":"e","text":"Digoxin"}],"a":["a","c","d"],"e":{"a":"Correct - beta-blockers reduce mortality.","b":"Relieves symptoms only; no mortality benefit.","c":"Correct - mineralocorticoid antagonists reduce mortality.","d":"Correct - ACE inhibitors reduce mortality.","e":"Reduces admissions but not mortality."},"k":"Prognostic vs symptomatic therapy in HFrEF.","p":"Start beta-blockers once the patient is euvolaemic.","s":"Pharmacology","os":"Cardiovascular","tp":"Heart failure drugs","y":4,"d":"medium","c":"Clinical reasoning","r":["ESC Heart Failure Guidelines 2021"],"rc":"11111111-1111-4111-8111-111111111111","rd":"dddddddd-0000-4000-8000-000000000001"},
{"q":"Match each drug to its typical adverse effect.","t":"matching","o":{"left":[{"id":"l1","text":"Amlodipine"},{"id":"l2","text":"Digoxin"},{"id":"l3","text":"Amiodarone"},{"id":"l4","text":"Metformin"}],"right":[{"id":"r1","text":"Ankle oedema"},{"id":"r2","text":"Yellow-green vision"},{"id":"r3","text":"Thyroid dysfunction"},{"id":"r4","text":"Lactic acidosis"}]},"a":{"l1":"r1","l2":"r2","l3":"r3","l4":"r4"},"e":{"l1":"Calcium channel blockers dilate arterioles, causing oedema.","l2":"Xanthopsia is a classic sign of digoxin toxicity.","l3":"Amiodarone contains iodine and affects the thyroid.","l4":"Rare but serious, especially with renal impairment."},"k":"Classic drug adverse effects.","p":"Check TFTs and LFTs before starting amiodarone.","s":"Pharmacology","os":"Multisystem","tp":"Adverse drug reactions","y":3,"d":"medium","c":"Prescribing","r":["BNF"]},
{"q":"What is the first-line treatment for severe malaria in an adult in Rwanda?","t":"single_best_answer","o":[{"id":"a","text":"Oral artemether-lumefantrine"},{"id":"b","text":"IV artesunate"},{"id":"c","text":"Oral chloroquine"},{"id":"d","text":"IV ceftriaxone"}],"a":"b","e":{"a":"Used for uncomplicated malaria, or to complete treatment after IV therapy.","b":"Correct - IV artesunate reduces mortality compared with quinine.","c":"Widespread resistance; not recommended.","d":"Antibiotic - may be added if bacterial sepsis is suspected, but does not treat malaria."},"k":"Severe malaria needs parenteral artesunate.","p":"Give at least 3 doses IV before switching to a full oral ACT course.","s":"Pharmacology","os":"Haematology","tp":"Antimalarials","y":4,"d":"easy","c":"Emergency management","r":["WHO Guidelines for Malaria 2023","Rwanda Malaria Treatment Guidelines"],"rc":"22222222-2222-4222-8222-222222222222","rd":"dddddddd-0000-4000-8000-000000000003"},
{"q":"Which drug reverses opioid-induced respiratory depression?","t":"single_best_answer","o":[{"id":"a","text":"Flumazenil"},{"id":"b","text":"Naloxone"},{"id":"c","text":"Atropine"},{"id":"d","text":"N-acetylcysteine"}],"a":"b","e":{"a":"Reverses benzodiazepines.","b":"Correct - competitive opioid receptor antagonist.","c":"Used for bradycardia and organophosphate poisoning.","d":"Antidote for paracetamol overdose."},"k":"Antidotes for common poisonings.","p":"Naloxone is short-acting - watch for re-sedation.","s":"Pharmacology","os":"Neurology","tp":"Antidotes","y":3,"d":"easy","c":"Emergency management","r":["Toxbase"]},
{"q":"Put the steps of managing anaphylaxis in the correct order.","t":"sequencing","o":[{"id":"a","text":"Give IM adrenaline 0.5 mg"},{"id":"b","text":"Call for help and assess ABC"},{"id":"c","text":"Give IV fluids for hypotension"},{"id":"d","text":"Repeat adrenaline after 5 minutes if no improvement"}],"a":["b","a","c","d"],"e":{"b":"Recognise and call for help first.","a":"IM adrenaline is the single most important treatment.","c":"Fluids support circulation.","d":"Repeat if there is no response."},"k":"Adrenaline first in anaphylaxis.","p":"Antihistamines and steroids are NOT first-line.","s":"Pharmacology","os":"Immunology","tp":"Emergency drugs","y":4,"d":"medium","c":"Emergency management","r":["Resuscitation Council UK Anaphylaxis 2021"]},
{"q":"A patient on warfarin has INR 8 with no bleeding. What is the most appropriate first step?","t":"short_vignette","o":[{"id":"a","text":"Continue warfarin, recheck in a week"},{"id":"b","text":"Stop warfarin and give oral vitamin K"},{"id":"c","text":"Give fresh frozen plasma urgently"},{"id":"d","text":"Start heparin"}],"a":"b","e":{"a":"Unsafe - high bleeding risk.","b":"Correct - withhold and give low-dose oral vitamin K when INR > 8.","c":"Reserved for major bleeding.","d":"Would increase bleeding risk."},"k":"Managing over-anticoagulation.","p":"Always look for the cause - new antibiotics are a common trigger.","s":"Pharmacology","os":"Haematology","tp":"Anticoagulants","y":4,"d":"medium","c":"Prescribing","r":["BNF: Warfarin"],"rd":"dddddddd-0000-4000-8000-000000000001"},
{"q":"Which drug is used for rate control in atrial fibrillation?","t":"single_best_answer","o":[{"id":"a","text":"Bisoprolol"},{"id":"b","text":"Amoxicillin"},{"id":"c","text":"Furosemide"},{"id":"d","text":"Simvastatin"}],"a":"a","e":{"a":"Correct - beta-blockers are first-line rate control.","b":"Antibiotic.","c":"Diuretic.","d":"Lipid lowering."},"k":"Rate vs rhythm control.","p":"Assess stroke risk with CHA2DS2-VASc.","s":"Pharmacology","os":"Cardiovascular","tp":"Antiarrhythmics","y":4,"d":"easy","c":"Prescribing","r":["NICE AF guideline"],"rd":"dddddddd-0000-4000-8000-000000000002"},
{"q":"Select ALL drugs that commonly cause hyperkalaemia.","t":"multi_response","o":[{"id":"a","text":"Spironolactone"},{"id":"b","text":"Ramipril"},{"id":"c","text":"Furosemide"},{"id":"d","text":"Trimethoprim"}],"a":["a","b","d"],"e":{"a":"Correct - potassium-sparing.","b":"Correct - reduces aldosterone.","c":"Causes hypokalaemia.","d":"Correct - blocks ENaC like amiloride."},"k":"Drugs affecting potassium.","p":"Check U&E within 1-2 weeks of starting ACE inhibitors.","s":"Pharmacology","os":"Renal","tp":"Electrolytes","y":3,"d":"medium","c":"Prescribing","r":["BNF"],"rd":"dddddddd-0000-4000-8000-000000000004"},
{"q":"What does the P wave on an ECG represent?","t":"image","o":[{"id":"a","text":"Atrial depolarisation"},{"id":"b","text":"Ventricular depolarisation"},{"id":"c","text":"Ventricular repolarisation"},{"id":"d","text":"Atrial repolarisation"}],"a":"a","e":{"a":"Correct.","b":"That is the QRS complex.","c":"That is the T wave.","d":"Hidden within the QRS complex."},"k":"ECG waveform components.","p":"Absent P waves with an irregular rhythm suggests AF.","s":"Physiology","os":"Cardiovascular","tp":"ECG","y":2,"d":"easy","c":"Data interpretation","m":"https://commons.wikimedia.org/wiki/Special:FilePath/SinusRhythmLabels.svg?width=640","r":["Hampton: The ECG Made Easy"],"rd":"dddddddd-0000-4000-8000-000000000002"},
{"q":"Click the chamber that pumps oxygenated blood into the aorta.","t":"image_hotspot","o":{"regions":[{"id":"ra","label":"Right atrium","x":8,"y":8,"w":40,"h":38},{"id":"la","label":"Left atrium","x":52,"y":8,"w":40,"h":38},{"id":"rv","label":"Right ventricle","x":8,"y":52,"w":40,"h":40},{"id":"lv","label":"Left ventricle","x":52,"y":52,"w":40,"h":40}]},"a":"lv","e":{"ra":"Receives deoxygenated blood from the venae cavae.","la":"Receives oxygenated blood from the pulmonary veins.","rv":"Pumps blood to the lungs.","lv":"Correct - thickest wall, pumps to the aorta."},"k":"Cardiac chambers and circulation.","p":"Left ventricular failure causes pulmonary oedema.","s":"Anatomy","os":"Cardiovascular","tp":"Heart anatomy","y":1,"d":"easy","c":"Basic science","r":["Gray's Anatomy for Students"],"rc":"11111111-1111-4111-8111-111111111111"},
{"q":"Which law states that stroke volume increases with end-diastolic volume?","t":"single_best_answer","o":[{"id":"a","text":"Poiseuille's law"},{"id":"b","text":"Frank-Starling law"},{"id":"c","text":"Laplace's law"},{"id":"d","text":"Fick's law"}],"a":"b","e":{"a":"Describes flow through a tube.","b":"Correct.","c":"Relates wall tension to pressure and radius.","d":"Describes diffusion."},"k":"Preload and contractility.","p":"In failing hearts the curve flattens - more fluid causes congestion.","s":"Physiology","os":"Cardiovascular","tp":"Cardiac output","y":2,"d":"easy","c":"Basic science","r":["Guyton and Hall Physiology"],"rd":"dddddddd-0000-4000-8000-000000000002"},
{"q":"Put these events of the cardiac cycle in order, starting from late diastole.","t":"sequencing","o":[{"id":"a","text":"Atrial contraction"},{"id":"b","text":"Isovolumetric contraction"},{"id":"c","text":"Ventricular ejection"},{"id":"d","text":"Isovolumetric relaxation"}],"a":["a","b","c","d"],"e":{"a":"Tops up ventricular filling.","b":"All valves closed, pressure rises.","c":"Aortic valve opens.","d":"All valves closed again, pressure falls."},"k":"Phases of the cardiac cycle.","p":"Loss of atrial kick in AF reduces cardiac output by up to 20%.","s":"Physiology","os":"Cardiovascular","tp":"Cardiac cycle","y":2,"d":"medium","c":"Basic science","r":["Guyton and Hall Physiology"],"rd":"dddddddd-0000-4000-8000-000000000002"},
{"q":"Where in the nephron is most filtered sodium reabsorbed?","t":"single_best_answer","o":[{"id":"a","text":"Proximal convoluted tubule"},{"id":"b","text":"Loop of Henle"},{"id":"c","text":"Distal convoluted tubule"},{"id":"d","text":"Collecting duct"}],"a":"a","e":{"a":"Correct - around 65%.","b":"About 25%.","c":"About 5%.","d":"Fine-tuning under aldosterone."},"k":"Segmental sodium handling.","p":"This is why proximal diuretics are weak - distal segments compensate.","s":"Physiology","os":"Renal","tp":"Renal physiology","y":2,"d":"easy","c":"Basic science","r":["Guyton and Hall Physiology"],"rd":"dddddddd-0000-4000-8000-000000000004"},
{"q":"Match each hormone to its main action.","t":"matching","o":{"left":[{"id":"l1","text":"ADH"},{"id":"l2","text":"Aldosterone"},{"id":"l3","text":"ANP"},{"id":"l4","text":"Renin"}],"right":[{"id":"r1","text":"Water reabsorption in collecting duct"},{"id":"r2","text":"Sodium reabsorption, potassium excretion"},{"id":"r3","text":"Natriuresis and vasodilation"},{"id":"r4","text":"Converts angiotensinogen to angiotensin I"}]},"a":{"l1":"r1","l2":"r2","l3":"r3","l4":"r4"},"e":{"l1":"Inserts aquaporin-2.","l2":"Acts on principal cells.","l3":"Released from stretched atria.","l4":"Released from juxtaglomerular cells."},"k":"Hormonal control of fluid balance.","p":"High BNP/ANP supports a diagnosis of heart failure.","s":"Physiology","os":"Renal","tp":"Fluid balance","y":2,"d":"medium","c":"Basic science","r":["Guyton and Hall Physiology"],"rd":"dddddddd-0000-4000-8000-000000000004"},
{"q":"Which change shifts the oxygen-haemoglobin dissociation curve to the RIGHT?","t":"single_best_answer","o":[{"id":"a","text":"Hypothermia"},{"id":"b","text":"Alkalosis"},{"id":"c","text":"Raised 2,3-BPG"},{"id":"d","text":"Fetal haemoglobin"}],"a":"c","e":{"a":"Shifts left.","b":"Shifts left.","c":"Correct - releases oxygen more easily to tissues.","d":"HbF has higher affinity - shifts left."},"k":"Factors affecting oxygen affinity.","p":"Remember CADET face Right: CO2, Acid, 2,3-DPG, Exercise, Temperature.","s":"Physiology","os":"Respiratory","tp":"Gas transport","y":2,"d":"medium","c":"Basic science","r":["West's Respiratory Physiology"]},
{"q":"Select ALL features of normal sinus rhythm.","t":"multi_response","o":[{"id":"a","text":"P wave before every QRS"},{"id":"b","text":"Rate 60-100 bpm"},{"id":"c","text":"QRS longer than 120 ms"},{"id":"d","text":"Regular R-R interval"}],"a":["a","b","d"],"e":{"a":"Correct.","b":"Correct.","c":"A wide QRS suggests bundle branch block or ventricular origin.","d":"Correct."},"k":"Recognising sinus rhythm.","p":"Always check rate, rhythm and axis in that order.","s":"Physiology","os":"Cardiovascular","tp":"ECG","y":2,"d":"easy","c":"Data interpretation","r":["Hampton: The ECG Made Easy"],"rd":"dddddddd-0000-4000-8000-000000000002"},
{"q":"A 23-year-old with 6 weeks of amenorrhoea has sudden pelvic pain and shoulder-tip pain. What is the most likely diagnosis?","t":"short_vignette","o":[{"id":"a","text":"Ruptured ectopic pregnancy"},{"id":"b","text":"Urinary tract infection"},{"id":"c","text":"Appendicitis"},{"id":"d","text":"Ovarian cyst without rupture"}],"a":"a","e":{"a":"Correct - shoulder-tip pain suggests blood irritating the diaphragm.","b":"Would cause dysuria and frequency.","c":"Possible, but amenorrhoea and shoulder pain point to ectopic.","d":"Usually less dramatic and without shoulder pain."},"k":"Every woman of reproductive age with abdominal pain needs a pregnancy test.","p":"Haemodynamic instability means theatre, not more scans.","s":"Pathology","os":"Reproductive","tp":"Ectopic pregnancy","y":5,"d":"easy","c":"Clinical reasoning","r":["RCOG Green-top Guideline 21"],"rc":"33333333-3333-4333-8333-333333333333"},
{"q":"Which Plasmodium species causes the most severe malaria?","t":"single_best_answer","o":[{"id":"a","text":"P. vivax"},{"id":"b","text":"P. falciparum"},{"id":"c","text":"P. malariae"},{"id":"d","text":"P. ovale"}],"a":"b","e":{"a":"Can relapse from liver hypnozoites but is rarely fatal.","b":"Correct - infects red cells of all ages and causes sequestration.","c":"Associated with nephrotic syndrome.","d":"Relapsing, generally mild."},"k":"P. falciparum and cytoadherence.","p":"P. falciparum is the dominant species in Rwanda.","s":"Pathology","os":"Haematology","tp":"Malaria","y":3,"d":"easy","c":"Basic science","r":["WHO World Malaria Report"],"rc":"22222222-2222-4222-8222-222222222222","rd":"dddddddd-0000-4000-8000-000000000003"},
{"q":"Select ALL criteria that define severe malaria in a child.","t":"multi_response","o":[{"id":"a","text":"Impaired consciousness"},{"id":"b","text":"Hypoglycaemia"},{"id":"c","text":"Mild fever"},{"id":"d","text":"Respiratory distress"},{"id":"e","text":"Severe anaemia"}],"a":["a","b","d","e"],"e":{"a":"Correct - cerebral malaria.","b":"Correct - glucose below 2.2 mmol/L.","c":"Fever alone does not define severity.","d":"Correct - often due to acidosis.","e":"Correct - Hb below 5 g/dL."},"k":"Recognising severe malaria.","p":"Check glucose in every drowsy child with fever.","s":"Pathology","os":"Haematology","tp":"Malaria","y":4,"d":"medium","c":"Emergency assessment","r":["WHO Severe Malaria 2014"],"rc":"22222222-2222-4222-8222-222222222222","rd":"dddddddd-0000-4000-8000-000000000003"},
{"q":"What is the most common cause of death from myocardial infarction in the first 24 hours?","t":"single_best_answer","o":[{"id":"a","text":"Ventricular arrhythmia"},{"id":"b","text":"Papillary muscle rupture"},{"id":"c","text":"Dressler syndrome"},{"id":"d","text":"Ventricular aneurysm"}],"a":"a","e":{"a":"Correct - ventricular fibrillation.","b":"Typically occurs 3-5 days later.","c":"Weeks later - autoimmune pericarditis.","d":"Months later."},"k":"Timeline of MI complications.","p":"Early defibrillator access saves lives after MI.","s":"Pathology","os":"Cardiovascular","tp":"Myocardial infarction","y":3,"d":"medium","c":"Clinical reasoning","r":["Robbins Basic Pathology"]},
{"q":"Match each type of necrosis to its classic setting.","t":"matching","o":{"left":[{"id":"l1","text":"Coagulative"},{"id":"l2","text":"Liquefactive"},{"id":"l3","text":"Caseous"},{"id":"l4","text":"Fat"}],"right":[{"id":"r1","text":"Myocardial infarct"},{"id":"r2","text":"Brain infarct"},{"id":"r3","text":"Tuberculosis"},{"id":"r4","text":"Acute pancreatitis"}]},"a":{"l1":"r1","l2":"r2","l3":"r3","l4":"r4"},"e":{"l1":"Cell outlines preserved.","l2":"Enzymatic digestion in the brain.","l3":"Cheese-like granulomas.","l4":"Lipases cause saponification."},"k":"Patterns of necrosis.","p":"Caseating granulomas mean TB until proven otherwise.","s":"Pathology","os":"Multisystem","tp":"Cell injury","y":2,"d":"medium","c":"Basic science","r":["Robbins Basic Pathology"]},
{"q":"Put the stages of acute inflammation in order.","t":"sequencing","o":[{"id":"a","text":"Vasodilation"},{"id":"b","text":"Increased vascular permeability"},{"id":"c","text":"Neutrophil margination and emigration"},{"id":"d","text":"Phagocytosis"}],"a":["a","b","c","d"],"e":{"a":"Causes redness and heat.","b":"Causes swelling.","c":"Neutrophils leave vessels.","d":"Microbes are cleared."},"k":"Vascular then cellular events of inflammation.","p":"Neutrophilia suggests acute bacterial infection.","s":"Pathology","os":"Immunology","tp":"Inflammation","y":2,"d":"easy","c":"Basic science","r":["Robbins Basic Pathology"]},
{"q":"A child with sickle cell disease is at increased risk of infection from which organism?","t":"single_best_answer","o":[{"id":"a","text":"Streptococcus pneumoniae"},{"id":"b","text":"Clostridium difficile"},{"id":"c","text":"Candida albicans"},{"id":"d","text":"Giardia lamblia"}],"a":"a","e":{"a":"Correct - functional asplenia raises risk from encapsulated bacteria.","b":"Linked to antibiotic use.","c":"Linked to immunosuppression.","d":"Waterborne parasite."},"k":"Asplenia and encapsulated organisms.","p":"Children with sickle cell need penicillin prophylaxis and vaccines.","s":"Pathology","os":"Haematology","tp":"Haemoglobinopathies","y":3,"d":"medium","c":"Clinical reasoning","r":["Robbins Basic Pathology"]},
{"q":"Which nerve is at risk in a fracture of the surgical neck of the humerus?","t":"single_best_answer","o":[{"id":"a","text":"Radial nerve"},{"id":"b","text":"Axillary nerve"},{"id":"c","text":"Ulnar nerve"},{"id":"d","text":"Median nerve"}],"a":"b","e":{"a":"At risk in midshaft fractures.","b":"Correct - wraps around the surgical neck.","c":"At risk at the medial epicondyle.","d":"At risk in supracondylar fractures."},"k":"Nerve relations of the humerus.","p":"Test sensation over the regimental badge area.","s":"Anatomy","os":"Musculoskeletal","tp":"Upper limb","y":1,"d":"easy","c":"Basic science","r":["Gray's Anatomy for Students"]},
{"q":"Match each cranial nerve to its function.","t":"matching","o":{"left":[{"id":"l1","text":"CN III"},{"id":"l2","text":"CN VII"},{"id":"l3","text":"CN X"},{"id":"l4","text":"CN XII"}],"right":[{"id":"r1","text":"Most eye movements and pupil constriction"},{"id":"r2","text":"Facial expression"},{"id":"r3","text":"Parasympathetic supply to heart and gut"},{"id":"r4","text":"Tongue movement"}]},"a":{"l1":"r1","l2":"r2","l3":"r3","l4":"r4"},"e":{"l1":"Oculomotor.","l2":"Facial.","l3":"Vagus.","l4":"Hypoglossal."},"k":"Cranial nerve functions.","p":"A blown pupil with ptosis suggests CN III compression.","s":"Anatomy","os":"Neurology","tp":"Cranial nerves","y":1,"d":"medium","c":"Basic science","r":["Gray's Anatomy for Students"]},
{"q":"Which enzyme is deficient in G6PD deficiency, and which pathway does it control?","t":"single_best_answer","o":[{"id":"a","text":"Glucose-6-phosphate dehydrogenase - pentose phosphate pathway"},{"id":"b","text":"Hexokinase - glycolysis"},{"id":"c","text":"Pyruvate kinase - glycolysis"},{"id":"d","text":"Glycogen phosphorylase - glycogenolysis"}],"a":"a","e":{"a":"Correct - red cells cannot make NADPH to protect against oxidants.","b":"Hexokinase deficiency is rare.","c":"Causes a different haemolytic anaemia.","d":"McArdle disease (muscle)."},"k":"NADPH protects red cells from oxidative damage.","p":"Primaquine can trigger haemolysis - test G6PD first.","s":"Biochemistry","os":"Haematology","tp":"Metabolism","y":1,"d":"medium","c":"Basic science","r":["Lippincott Biochemistry"],"rd":"dddddddd-0000-4000-8000-000000000003"},
{"q":"Put the steps of glycolysis regulation in order of the pathway: which enzyme acts FIRST to LAST?","t":"sequencing","o":[{"id":"a","text":"Hexokinase"},{"id":"b","text":"Phosphofructokinase-1"},{"id":"c","text":"Pyruvate kinase"}],"a":["a","b","c"],"e":{"a":"Traps glucose as glucose-6-phosphate.","b":"Rate-limiting step.","c":"Final step producing pyruvate."},"k":"Irreversible steps of glycolysis.","p":"PFK-1 is the main control point - inhibited by ATP and citrate.","s":"Biochemistry","os":"Multisystem","tp":"Metabolism","y":1,"d":"medium","c":"Basic science","r":["Lippincott Biochemistry"]},
{"q":"Select ALL fat-soluble vitamins.","t":"multi_response","o":[{"id":"a","text":"Vitamin A"},{"id":"b","text":"Vitamin C"},{"id":"c","text":"Vitamin D"},{"id":"d","text":"Vitamin K"},{"id":"e","text":"Vitamin B12"}],"a":["a","c","d"],"e":{"a":"Correct.","b":"Water-soluble.","c":"Correct.","d":"Correct.","e":"Water-soluble."},"k":"Fat-soluble vitamins: A, D, E, K.","p":"Fat malabsorption (e.g. cholestasis) causes vitamin K deficiency and bleeding.","s":"Biochemistry","os":"Gastrointestinal","tp":"Vitamins","y":1,"d":"easy","c":"Basic science","r":["Lippincott Biochemistry"]}
]$j$::jsonb) AS x(q text, t text, o jsonb, a jsonb, e jsonb, k text, p text, s text, os text, tp text, y int, d text, c text, m text, r jsonb, rc uuid, rd uuid);

-- SEED: GROUP
INSERT INTO public.groups (id, name, description, invite_code, created_by_student_id) VALUES
('eeeeeeee-0000-4000-8000-000000000001','Kigali Clinical Circle','Year 3-5 students revising cardiology and tropical medicine together every Friday.','KGL123','79582600-ce0b-4881-b5d5-147bbb87b747');
INSERT INTO public.group_members (group_id, student_id, role) VALUES
('eeeeeeee-0000-4000-8000-000000000001','79582600-ce0b-4881-b5d5-147bbb87b747','team_lead'),
('eeeeeeee-0000-4000-8000-000000000001','69fac236-6a12-4e78-8553-6fd963f45854','member'),
('eeeeeeee-0000-4000-8000-000000000001','c20e0dae-0f4f-47fe-a552-5202bee40584','member');
INSERT INTO public.group_messages (group_id, student_id, message, created_at) VALUES
('eeeeeeee-0000-4000-8000-000000000001','79582600-ce0b-4881-b5d5-147bbb87b747','Muraho everyone! I shared my renal deck - please add cards if you spot gaps.', now() - interval '2 days'),
('eeeeeeee-0000-4000-8000-000000000001','69fac236-6a12-4e78-8553-6fd963f45854','Thanks Aline. Can we do the heart failure case as a team on Friday?', now() - interval '1 day 20 hours'),
('eeeeeeee-0000-4000-8000-000000000001','c20e0dae-0f4f-47fe-a552-5202bee40584','Yes! I keep forgetting which HF drugs reduce mortality. Group quiz first?', now() - interval '1 day 18 hours'),
('eeeeeeee-0000-4000-8000-000000000001','79582600-ce0b-4881-b5d5-147bbb87b747','Deal - quiz at 5pm, case at 6pm.', now() - interval '1 day 17 hours');
INSERT INTO public.group_shared_resources (group_id, resource_type, resource_ref, title, shared_by_student_id) VALUES
('eeeeeeee-0000-4000-8000-000000000001','deck','dddddddd-0000-4000-8000-000000000004','My renal and electrolyte notes','79582600-ce0b-4881-b5d5-147bbb87b747'),
('eeeeeeee-0000-4000-8000-000000000001','case','11111111-1111-4111-8111-111111111111','A breathless patient in the emergency unit','69fac236-6a12-4e78-8553-6fd963f45854');

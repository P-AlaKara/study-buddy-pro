import type { MedicalCase, ResultCondition } from "../schema.js";

/*
 * Patient states the responses track:
 * - BLEEDING: no fluid resuscitation by minute 10; the haemoperitoneum is
 *   growing and she is sliding into haemorrhagic shock.
 * - RESUSCITATED: the first fluid bolus is running.
 */
const BLEEDING: ResultCondition = { afterDeterioration: ["ectopic_no_resuscitation"] };
const RESUSCITATED: ResultCondition = { afterActions: ["start_fluid_resuscitation"] };

export const theMissedPeriod: MedicalCase = {
  id: "a1000000-0000-4000-8000-000000000004",
  slug: "case_004",
  title: "The Missed Period",
  difficulty: 3,
  specialty: ["Obstetrics & Gynaecology", "Emergency", "General Surgery"],
  setting: "ER, 7:05 AM",
  intro:
    "ER, 7:05 AM. A 27-year-old teacher is helped in by a colleague, bent double with right-sided lower abdominal pain. She nearly fainted in the taxi. Triage has written 'query appendix'.",
  reviewStatus: "needs_clinician_review",
  patient: {
    name: "Claudine",
    age: 27,
    sex: "Female",
    avatar: {
      skinTone: "medium_brown",
      hair: "short_natural",
      outfit: "yellow_cardigan",
      ageCues: "young_adult",
    },
    personality:
      "Precise and self-contained; apologises for the fuss, downplays symptoms, and goes quiet when the pain surges.",
    chiefComplaint: "Sudden right-sided lower abdominal pain and feeling faint.",
    presentingTags: ["Lower abdominal pain", "Faint", "Pale"],
    initialExpression: "in_pain",
  },
  vitalsTimeline: [
    { tMinute: 0, hr: 108, bp: "98/62", rr: 22, spo2: 98, temp: 37.0 },
    { tMinute: 10, hr: 124, bp: "80/52", rr: 26, spo2: 98, temp: 36.9 },
    { tMinute: 28, hr: 142, bp: "62/40", rr: 32, spo2: 94, temp: 36.6 },
  ],
  deteriorationRules: [
    {
      id: "ectopic_no_resuscitation",
      ifNotDoneBy: 10,
      action: "start_fluid_resuscitation",
      effect: { hr: 16, systolicBp: -18, diastolicBp: -10, rr: 4 },
      alertLine:
        "Her pressure's dropped to 80 and she's gone grey — she's bleeding from somewhere. Do we have access?",
      source: "nurse",
      triggersEvent: "haemorrhagic_shock_develops",
      lossAtMinute: 28,
    },
    {
      id: "ectopic_no_gynae_call",
      ifNotDoneBy: 20,
      action: "call_gynaecology",
      effect: { hr: 10, systolicBp: -12, diastolicBp: -8, spo2: -2 },
      alertLine:
        "She's getting worse and nobody has called gynae or booked a theatre. Who's taking her?",
      source: "nurse",
      triggersEvent: "surgical_delay",
      lossAtMinute: 36,
    },
  ],
  actions: [
    {
      id: "ask_pain_onset",
      category: "ask",
      label: "Ask how the pain began",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "It came on suddenly about two hours ago, low down on the right. Sharp, then a dull ache that won't go. When I stood up to get the taxi everything went black for a second.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content: "Two hours ago… sudden, on the right. I keep… going dizzy. Sorry.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["ectopic_pregnancy", "appendicitis", "ovarian_torsion", "ruptured_ovarian_cyst"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "ask_menstrual_history",
      category: "ask",
      label: "Ask about her last period",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "My last proper period was… about seven weeks ago. I'm usually regular — every 28 days. I put it down to the stress of exam marking.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Seven weeks… I'm usually regular. I thought it was stress." },
        },
      ],
      clueTier: "buried",
      supports: ["ectopic_pregnancy"],
      against: ["appendicitis"],
      triggersEvent: "missed_period_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_shoulder_tip_pain",
      category: "ask",
      label: "Ask about pain anywhere else",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "That's strange — when I lie flat I get a sharp pain in the tip of my right shoulder. I haven't hurt it.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content: "My shoulder… the right tip. Worse lying flat. I don't understand it.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["appendicitis", "pelvic_inflammatory_disease"],
      triggersEvent: "shoulder_tip_pain_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_vaginal_bleeding",
      category: "ask",
      label: "Ask about vaginal bleeding or discharge",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "Just some dark brown spotting for the last two days. Nothing like a period, and no discharge.",
      },
      clueTier: "buried",
      supports: ["ectopic_pregnancy"],
      against: ["appendicitis", "pelvic_inflammatory_disease"],
      triggersEvent: "spotting_revealed",
    },
    {
      id: "ask_gi_symptoms",
      category: "ask",
      label: "Ask about appetite, nausea and bowels",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I've felt sick since it started and I couldn't face breakfast. I had one loose stool this morning.",
      },
      clueTier: "red_herring",
      supports: ["appendicitis"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "ask_sexual_history",
      category: "ask",
      label: "Take a sexual and contraceptive history",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Ask in private; be matter-of-fact.",
      result: {
        type: "patient_reply",
        content:
          "I have a partner and we're not using anything at the moment. Two years ago I was treated for chlamydia — the clinic said it had got into my tubes.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Not using anything. I had… chlamydia, two years ago. In the tubes." },
        },
      ],
      clueTier: "buried",
      supports: ["ectopic_pregnancy", "pelvic_inflammatory_disease"],
      against: [],
      triggersEvent: "tubal_risk_revealed",
      isKeyClue: true,
    },
    {
      id: "check_vitals",
      category: "examine",
      label: "Check vital signs",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. She is pale with cool hands and apologises for 'making a fuss'.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. She is grey, clammy and drowsy with a thready radial pulse — class III haemorrhagic shock.",
          },
        },
        {
          when: RESUSCITATED,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. The bolus has brought some colour back, but she is still tachycardic and the pain is unchanged.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["pelvic_inflammatory_disease"],
      triggersEvent: "",
      isCritical: true,
    },
    {
      id: "check_postural_bp",
      category: "examine",
      label: "Check a postural blood pressure",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Have someone beside her; she may faint.",
      result: {
        type: "text",
        content:
          "Lying: {bp} mmHg, HR {hr}. Sitting up: {sbp-22}/{dbp-10} mmHg with HR {hr+18} — she goes grey and has to lie back down. A significant postural drop: she is volume depleted.",
      },
      clueTier: "buried",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["pelvic_inflammatory_disease", "appendicitis"],
      triggersEvent: "postural_drop_found",
    },
    {
      id: "examine_general",
      category: "examine",
      label: "General examination",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Pale conjunctivae and nail beds, cool peripheries, capillary refill 3 seconds. No fever, no rash, no lymphadenopathy.",
      },
      clueTier: "obvious",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["pelvic_inflammatory_disease"],
      triggersEvent: "",
    },
    {
      id: "examine_abdomen",
      category: "examine",
      label: "Examine the abdomen",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Tenderness across the whole lower abdomen, worst on the right, with voluntary guarding. Rovsing's sign is negative and the tenderness is not localised to McBurney's point. The abdomen is mildly distended.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "The whole abdomen is now rigid and distended with rebound tenderness everywhere — generalised peritonism from blood, not a localised appendix.",
          },
        },
      ],
      clueTier: "contradicting",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["appendicitis"],
      triggersEvent: "diffuse_peritonism_found",
    },
    {
      id: "bimanual_exam",
      category: "examine",
      label: "Gentle bimanual pelvic examination",
      timeCostMin: 3,
      moneyCost: 0,
      riskNote: "Be gentle: vigorous examination can worsen bleeding from a ruptured tube.",
      result: {
        type: "text",
        content:
          "Marked cervical motion tenderness. The right adnexa is exquisitely tender with a fullness you can just define. The uterus feels slightly bulky; the os is closed with a little dark blood.",
      },
      clueTier: "buried",
      supports: ["ectopic_pregnancy", "pelvic_inflammatory_disease", "ovarian_torsion"],
      against: ["appendicitis"],
      triggersEvent: "adnexal_tenderness_found",
      isKeyClue: true,
    },
    {
      id: "urine_pregnancy_test",
      category: "test",
      label: "Urine pregnancy test",
      timeCostMin: 2,
      moneyCost: 5,
      riskNote: "",
      result: {
        type: "lab_table",
        content: "The bedside urine hCG is positive. She says quietly that she didn't know.",
        labs: [{ test: "Urine hCG", result: "Positive", reference: "Negative", flag: "critical" }],
      },
      clueTier: "contradicting",
      supports: ["ectopic_pregnancy"],
      against: ["appendicitis", "ovarian_torsion", "pelvic_inflammatory_disease"],
      triggersEvent: "pregnancy_confirmed",
      isKeyClue: true,
    },
    {
      id: "serum_hcg",
      category: "test",
      label: "Serum β-hCG",
      timeCostMin: 8,
      moneyCost: 60,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "Serum β-hCG is well above the level at which an intrauterine pregnancy should be visible on ultrasound.",
        labs: [{ test: "Serum β-hCG", result: "4,820 IU/L", reference: "<5", flag: "critical" }],
      },
      clueTier: "buried",
      supports: ["ectopic_pregnancy"],
      against: ["appendicitis", "ovarian_torsion", "pelvic_inflammatory_disease"],
      triggersEvent: "pregnancy_confirmed",
      isKeyClue: true,
    },
    {
      id: "order_fbc_group",
      category: "test",
      label: "FBC, group and cross-match",
      timeCostMin: 6,
      moneyCost: 90,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "Haemoglobin is low for a young woman with a two-hour history: she has been bleeding. Blood is grouped and two units are cross-matched.",
        labs: [
          { test: "Haemoglobin", result: "9.6 g/dL", reference: "12.0–15.5", flag: "low" },
          { test: "WBC", result: "11.8 ×10⁹/L", reference: "4.0–11.0", flag: "high" },
          { test: "Platelets", result: "262 ×10⁹/L", reference: "150–400", flag: "normal" },
          { test: "Blood group", result: "O RhD positive", reference: "", flag: "normal" },
          { test: "Lactate", result: "2.4 mmol/L", reference: "0.5–2.2", flag: "high" },
        ],
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "Haemoglobin has fallen further and lactate is climbing — ongoing haemorrhage with poor perfusion. Two units are cross-matched.",
            labs: [
              { test: "Haemoglobin", result: "7.4 g/dL", reference: "12.0–15.5", flag: "critical" },
              { test: "WBC", result: "13.1 ×10⁹/L", reference: "4.0–11.0", flag: "high" },
              { test: "Platelets", result: "248 ×10⁹/L", reference: "150–400", flag: "normal" },
              { test: "Blood group", result: "O RhD positive", reference: "", flag: "normal" },
              { test: "Lactate", result: "4.8 mmol/L", reference: "0.5–2.2", flag: "critical" },
            ],
          },
        },
      ],
      clueTier: "obvious",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: [],
      triggersEvent: "anaemia_found",
    },
    {
      id: "bedside_ultrasound",
      category: "test",
      label: "Bedside (FAST) ultrasound",
      timeCostMin: 5,
      moneyCost: 120,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Free fluid in the pelvis and in the hepatorenal space. The uterus is empty — no intrauterine gestational sac. In a pregnant woman with pain, this is a ruptured ectopic until proven otherwise.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "A large volume of free fluid fills the pelvis, both paracolic gutters and the hepatorenal space; the uterus is empty. Massive haemoperitoneum.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["ectopic_pregnancy", "ruptured_ovarian_cyst"],
      against: ["appendicitis", "pelvic_inflammatory_disease", "ovarian_torsion"],
      triggersEvent: "free_fluid_found",
      isKeyClue: true,
    },
    {
      id: "transvaginal_ultrasound",
      category: "test",
      label: "Formal transvaginal ultrasound",
      timeCostMin: 14,
      moneyCost: 220,
      riskNote: "Fourteen minutes away from the resuscitation bay.",
      result: {
        type: "text",
        content:
          "Empty uterus with a thickened endometrium. A 3 cm inhomogeneous mass in the right adnexa, separate from the ovary, with free fluid in the pouch of Douglas: ruptured right tubal ectopic pregnancy.",
      },
      clueTier: "buried",
      supports: ["ectopic_pregnancy"],
      against: [
        "appendicitis",
        "ovarian_torsion",
        "ruptured_ovarian_cyst",
        "pelvic_inflammatory_disease",
      ],
      triggersEvent: "ectopic_confirmed",
      isKeyClue: true,
    },
    {
      id: "order_urinalysis",
      category: "test",
      label: "Urine dipstick and microscopy",
      timeCostMin: 3,
      moneyCost: 10,
      riskNote: "",
      result: {
        type: "lab_table",
        content: "A trace of blood; no leucocytes or nitrites. Not a urinary cause.",
        labs: [
          { test: "Blood", result: "Trace", reference: "Negative", flag: "normal" },
          {
            test: "Leucocytes / nitrites",
            result: "Negative",
            reference: "Negative",
            flag: "normal",
          },
        ],
      },
      clueTier: "red_herring",
      supports: [],
      against: [],
      triggersEvent: "",
    },
    {
      id: "order_ct_abdomen",
      category: "test",
      label: "CT abdomen and pelvis",
      timeCostMin: 20,
      moneyCost: 420,
      riskNote: "Radiation to an early pregnancy and a long trip away from resuscitation.",
      result: {
        type: "text",
        content:
          "The scan shows a large haemoperitoneum and a normal appendix — findings a two-minute bedside test and a five-minute ultrasound had already given you, twenty minutes and a radiation dose ago.",
      },
      clueTier: "none",
      supports: ["ectopic_pregnancy"],
      against: ["appendicitis"],
      triggersEvent: "ct_delay",
      isUnnecessary: true,
      harmful: true,
    },
    {
      id: "start_monitoring",
      category: "treat",
      label: "Start continuous monitoring",
      timeCostMin: 1,
      moneyCost: 10,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Continuous ECG, pulse oximetry and frequent blood pressure monitoring are started. The monitor shows {rhythm} at {hr} bpm, BP {bp}, SpO₂ {spo2}%.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "monitoring_started",
      isCritical: true,
    },
    {
      id: "gain_iv_access",
      category: "treat",
      label: "Gain two large-bore IV lines",
      timeCostMin: 2,
      moneyCost: 25,
      riskNote: "Minor cannulation risks.",
      result: {
        type: "text",
        content:
          "Two large-bore cannulas are secured in the antecubital fossae and blood is sent for FBC, group and cross-match.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "iv_access_ready",
      isCritical: true,
    },
    {
      id: "start_fluid_resuscitation",
      category: "treat",
      label: "Give a warmed crystalloid bolus",
      timeCostMin: 2,
      moneyCost: 25,
      riskNote: "Permissive targets: enough to perfuse, not enough to dilute and dislodge clot.",
      result: {
        type: "text",
        content:
          "A warmed 500 mL crystalloid bolus runs in under pressure. HR {hr}, BP {bp}: better, but only blood and a surgeon will fix the source.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "Two rapid warmed boluses are given through both lines. Her pressure climbs to {bp} and she opens her eyes — but she has already lost a lot of blood.",
          },
          vitalsEffect: { hr: -12, systolicBp: 14, diastolicBp: 8 },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "resuscitation_started",
      isCritical: true,
      vitalsEffect: { hr: -8, systolicBp: 8, diastolicBp: 4 },
    },
    {
      id: "transfuse_blood",
      category: "treat",
      label: "Activate major haemorrhage and transfuse",
      timeCostMin: 3,
      moneyCost: 350,
      riskNote: "Transfusion reactions; give anti-D later if RhD negative.",
      result: {
        type: "text",
        content:
          "The major haemorrhage protocol is activated and the first unit of O-negative blood is running while cross-matched units are prepared. HR {hr}, BP {bp}.",
      },
      variants: [
        {
          when: RESUSCITATED,
          result: {
            content:
              "With crystalloid already in, blood is started: the first unit of O-negative runs while cross-matched units follow. HR {hr}, BP {bp}.",
          },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "transfusion_started",
      isCritical: true,
      vitalsEffect: { hr: -10, systolicBp: 10, diastolicBp: 6 },
    },
    {
      id: "call_gynaecology",
      category: "treat",
      label: "Call gynaecology for emergency laparoscopy",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "The gynaecology registrar accepts her on the picture of a positive pregnancy test, pain and shock, and books the emergency theatre for laparoscopy.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "The gynaecology team comes straight down. With a shocked patient and a positive pregnancy test she goes directly to theatre for laparotomy.",
          },
        },
        {
          when: { afterActions: ["bedside_ultrasound"] },
          result: {
            content:
              "The gynaecology registrar reviews the free fluid on your bedside scan and takes her straight to theatre for laparoscopic salpingectomy.",
          },
        },
      ],
      clueTier: "none",
      supports: ["ectopic_pregnancy"],
      against: [],
      triggersEvent: "surgical_pathway_activated",
      isCritical: true,
      safeWhen: {
        anyActionIds: [
          "urine_pregnancy_test",
          "serum_hcg",
          "bedside_ultrasound",
          "transvaginal_ultrasound",
        ],
        explanation:
          "Call gynaecology as soon as pregnancy is confirmed in a woman with pain and signs of bleeding; do not wait for a formal scan.",
      },
    },
    {
      id: "give_analgesia",
      category: "treat",
      label: "Give titrated IV analgesia",
      timeCostMin: 2,
      moneyCost: 30,
      riskNote: "Watch the blood pressure; small titrated doses.",
      result: {
        type: "text",
        content:
          "Small titrated doses of IV morphine with an antiemetic bring the pain from 9/10 to 4/10. She stops apologising.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "pain_controlled",
      vitalsEffect: { hr: -4 },
    },
    {
      id: "give_methotrexate",
      category: "treat",
      label: "Give methotrexate for the ectopic",
      timeCostMin: 3,
      moneyCost: 90,
      riskNote: "Medical management is only for stable, unruptured ectopics with low hCG.",
      result: {
        type: "text",
        content:
          "Methotrexate is given. It will take days to work; she is bleeding into her abdomen now and needs an operation, not a drug.",
      },
      clueTier: "none",
      supports: ["ectopic_pregnancy"],
      against: [],
      triggersEvent: "wrong_treatment_methotrexate",
      harmful: true,
    },
    {
      id: "refer_for_appendicectomy",
      category: "treat",
      label: "Refer to the surgeons for appendicectomy",
      timeCostMin: 12,
      moneyCost: 0,
      riskNote: "Wrong team, wrong operation, long delay.",
      result: {
        type: "text",
        content:
          "The surgical registrar reviews her, asks for a pregnancy test and a gynaecology opinion, and twelve minutes have passed while she keeps bleeding.",
      },
      clueTier: "none",
      supports: ["appendicitis"],
      against: [],
      triggersEvent: "wrong_team_delay",
      harmful: true,
    },
    {
      id: "give_antibiotics_pid",
      category: "treat",
      label: "Start antibiotics for pelvic infection",
      timeCostMin: 2,
      moneyCost: 45,
      riskNote: "Treats a diagnosis she does not have while the real one progresses.",
      result: {
        type: "text",
        content:
          "IV antibiotics for presumed pelvic inflammatory disease are given. She is afebrile, has no discharge, and is still bleeding.",
      },
      clueTier: "none",
      supports: ["pelvic_inflammatory_disease"],
      against: [],
      triggersEvent: "wrong_treatment_antibiotics",
      harmful: true,
    },
    {
      id: "discharge_with_analgesia",
      category: "treat",
      label: "Discharge with analgesia and a surgical clinic letter",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Catastrophic risk from an untreated ruptured ectopic pregnancy.",
      result: {
        type: "text",
        content:
          "Claudine collapses in the car park. The ruptured tube bleeds freely into her abdomen and she cannot be resuscitated.",
      },
      clueTier: "none",
      supports: ["appendicitis"],
      against: [],
      triggersEvent: "patient_lost_after_discharge",
      harmful: true,
      immediateFailure: true,
    },
  ],
  differential: [
    {
      id: "ectopic_pregnancy",
      label: "Ruptured ectopic pregnancy",
      isCorrect: true,
      isTempting: false,
    },
    { id: "appendicitis", label: "Acute appendicitis", isCorrect: false, isTempting: true },
    { id: "ovarian_torsion", label: "Ovarian torsion", isCorrect: false, isTempting: false },
    {
      id: "ruptured_ovarian_cyst",
      label: "Ruptured haemorrhagic ovarian cyst",
      isCorrect: false,
      isTempting: false,
    },
    {
      id: "pelvic_inflammatory_disease",
      label: "Pelvic inflammatory disease",
      isCorrect: false,
      isTempting: false,
    },
  ],
  hints: [
    {
      tier: 1,
      cost: 0,
      text: "A woman who nearly fainted with a low blood pressure is bleeding until you prove otherwise. Get access and fluids going while you think.",
    },
    {
      tier: 2,
      cost: 5,
      text: "Every woman of reproductive age with abdominal pain is pregnant until the test says she isn't. Ask about her last period — and her shoulder.",
    },
    {
      tier: 3,
      cost: 10,
      text: "Positive pregnancy test plus pain plus shock is a ruptured ectopic. Blood, a bedside scan for free fluid and gynaecology for theatre — now.",
    },
  ],
  solution: {
    diagnosis: "Ruptured right tubal ectopic pregnancy with haemorrhagic shock",
    diagnosisId: "ectopic_pregnancy",
    keyTreatment: [
      "gain_iv_access",
      "start_fluid_resuscitation",
      "transfuse_blood",
      "call_gynaecology",
    ],
    teachingPoints: [
      "Do a pregnancy test in every woman of reproductive age with abdominal pain or collapse before any other diagnosis is accepted.",
      "Shoulder-tip pain, a postural drop and free fluid on bedside ultrasound point to intraperitoneal bleeding; a ruptured ectopic needs blood and a surgeon, not methotrexate.",
      "Resuscitate and refer in parallel: a positive test with pain and shock is enough to call gynaecology, and formal imaging must never delay theatre.",
    ],
    whyNotTempting:
      "Appendicitis can cause right-sided pain, nausea and a raised white count, but it does not explain a missed period, a positive pregnancy test, shoulder-tip pain, a postural drop, a falling haemoglobin or free fluid in the abdomen. The 'query appendix' label on the triage card anchored the whole team.",
    harmfulActionDebrief: {
      order_ct_abdomen:
        "CT exposed an early pregnancy to radiation and took a shocked patient away from resuscitation for twenty minutes to show what bedside tests had already shown.",
      give_methotrexate:
        "Methotrexate is only for haemodynamically stable, unruptured ectopic pregnancies with a low hCG; in a bleeding patient it delays the operation she needs.",
      refer_for_appendicectomy:
        "Referring to the wrong team for the wrong operation cost twelve minutes of bleeding before anyone asked about pregnancy.",
      give_antibiotics_pid:
        "Treating presumed pelvic infection in an afebrile, shocked patient with a positive pregnancy test ignored the bleeding that was killing her.",
      discharge_with_analgesia:
        "Discharging a tachycardic, hypotensive woman with lower abdominal pain and a missed period left a ruptured ectopic to bleed unobserved.",
    },
  },
  scoring: {
    base: 100,
    perMinutePenaltyAfter: 18,
    perMinutePenalty: -1,
    perUnnecessaryTest: -3,
    perHarmfulAction: -20,
    bonusKeyClueFoundEarly: 10,
    earlyClueCutoffMinute: 7,
    incorrectDiagnosisPenalty: -40,
    perMissedKeyTreatment: -5,
  },
  assets: [],
  mockComparisonPercent: 49,
};

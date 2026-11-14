import { ecgAnnotation } from "../ecg.js";
import type { MedicalCase, ResultCondition } from "../schema.js";

/*
 * Patient states the responses track:
 * - EXTENDING: no rate control by minute 12; the dissection is propagating
 *   (worse pain, spreading pulse deficit and malperfusion).
 * - BLEEDING: no surgical call by minute 18; blood is tracking into the
 *   pericardium (falling pressure, muffled heart sounds, low-voltage ECG
 *   with alternans, haemopericardium on CT, tamponade on echo).
 * - RATE_CONTROLLED: IV beta-blockade has been given.
 */
const EXTENDING: ResultCondition = { afterDeterioration: ["dissection_no_rate_control"] };
const BLEEDING: ResultCondition = { afterDeterioration: ["dissection_no_surgical_call"] };
const RATE_CONTROLLED: ResultCondition = { afterActions: ["give_beta_blocker"] };

export const theTearingPain: MedicalCase = {
  id: "a1000000-0000-4000-8000-000000000002",
  slug: "case_002",
  title: "The Tearing Pain",
  difficulty: 3,
  specialty: ["Emergency", "Cardiology", "Cardiothoracic Surgery"],
  setting: "ER, 6:12 PM",
  intro:
    "ER, 6:12 PM. A 58-year-old man grips the trolley rail, drenched in sweat. The chest pain struck without warning and now tears through to his back.",
  reviewStatus: "clinician_reviewed",
  patient: {
    name: "Daniel",
    age: 58,
    sex: "Male",
    avatar: {
      skinTone: "medium_brown",
      hair: "short_grey",
      outfit: "rust_button_down",
      ageCues: "middle_aged",
    },
    personality: "Direct and stoic, but unable to hide severe pain; answers in clipped phrases.",
    chiefComplaint: "Sudden severe chest pain radiating to the back.",
    presentingTags: ["Chest pain", "Back pain", "Sweating"],
    initialExpression: "in_pain",
  },
  vitalsTimeline: [
    { tMinute: 0, hr: 112, bp: "198/112 (right arm)", rr: 24, spo2: 96, temp: 36.7 },
    { tMinute: 12, hr: 126, bp: "214/118 (right arm)", rr: 28, spo2: 94, temp: 36.7 },
    { tMinute: 24, hr: 138, bp: "86/52", rr: 32, spo2: 90, temp: 36.6 },
  ],
  deteriorationRules: [
    {
      id: "dissection_no_rate_control",
      ifNotDoneBy: 12,
      action: "give_beta_blocker",
      effect: { hr: 14, systolicBp: 16, diastolicBp: 6, rr: 4, spo2: -2 },
      alertLine:
        "His pressure is still over 210 and the pain is worse. We need to reduce aortic shear now.",
      source: "nurse",
      triggersEvent: "dissection_extending",
      lossAtMinute: 24,
    },
    {
      id: "dissection_no_surgical_call",
      ifNotDoneBy: 18,
      action: "call_cardiothoracic_surgery",
      effect: { systolicBp: -28, diastolicBp: -18, hr: 10, spo2: -3 },
      alertLine:
        "He looks grey and the pressure is dropping — could this be rupturing or tamponade?",
      source: "nurse",
      triggersEvent: "tamponade_warning",
      lossAtMinute: 26,
    },
  ],
  actions: [
    {
      id: "ask_pain_character",
      category: "ask",
      label: "Ask him to describe the pain",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "It was instant — the worst pain of my life. It feels like something is tearing from my chest straight between my shoulder blades.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Still… tearing. Through to my back. I feel — faint." },
        },
        {
          when: { afterActions: ["give_opioid_analgesia"] },
          result: {
            content:
              "It came on instantly — the worst pain of my life, tearing from my chest to between my shoulder blades. The morphine's taken the edge off, but it's still there.",
          },
        },
        {
          when: EXTENDING,
          result: {
            content:
              "Instant — like something tearing from my chest to between my shoulder blades. And it's getting worse… moving lower down my back.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["aortic_dissection"],
      against: ["acid_reflux"],
      triggersEvent: "abrupt_tearing_pain_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_hypertension",
      category: "ask",
      label: "Ask about blood pressure history",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I've had high blood pressure for years. I ran out of tablets a couple of months ago and never went back.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "High pressure… for years. Stopped the tablets… couple of months." },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection", "acute_coronary_syndrome"],
      against: [],
      triggersEvent: "hypertension_risk_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_neurologic_symptoms",
      category: "ask",
      label: "Ask about weakness, speech, or fainting",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "My left hand went numb for a minute in the ambulance. I nearly blacked out when the pain started.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Dizzy… everything's going grey. Left hand's… numb again." },
        },
        {
          when: EXTENDING,
          result: {
            content:
              "My left hand went numb in the ambulance — and now my left leg feels heavy too. I nearly blacked out when the pain started.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acid_reflux"],
      triggersEvent: "transient_malperfusion_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_acs_features",
      category: "ask",
      label: "Ask about cardiac symptoms",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I'm sweating and nauseated, but the pain doesn't feel heavy or tight. It went to my back immediately.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Sweaty… sick. Not a squeeze — it tore… straight to my back." },
        },
      ],
      clueTier: "obvious",
      supports: ["acute_coronary_syndrome", "aortic_dissection"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "ask_reflux",
      category: "ask",
      label: "Ask about meals and reflux",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I get ordinary heartburn after spicy food, but never pain like this. Antacid didn't touch it.",
      },
      variants: [
        {
          when: BLEEDING,
          result: { content: "Heartburn… sometimes. Never like this. Antacid did nothing." },
        },
      ],
      clueTier: "red_herring",
      supports: ["acid_reflux"],
      against: [],
      triggersEvent: "",
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
          "HR {hr}, right-arm BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. He is pale and diaphoretic.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "HR {hr}, right-arm BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. He is grey and clammy with distended neck veins, and his pressure is falling.",
          },
        },
        {
          when: RATE_CONTROLLED,
          result: {
            content:
              "HR {hr}, right-arm BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. With rate control he is calmer, though still sweaty and in pain.",
          },
        },
        {
          when: EXTENDING,
          result: {
            content:
              "HR {hr}, right-arm BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. The pain is worse; he is pale, drenched in sweat and cannot lie still.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["aortic_dissection", "acute_coronary_syndrome"],
      against: ["acid_reflux"],
      triggersEvent: "",
      isCritical: true,
    },
    {
      id: "check_both_arm_bp",
      category: "examine",
      label: "Measure blood pressure in both arms",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Right arm: {bp} mmHg. Left arm: {sbp-34}/{dbp-16} mmHg — a 34 mmHg systolic difference.",
      },
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome", "acid_reflux"],
      triggersEvent: "interarm_bp_difference_found",
      isKeyClue: true,
    },
    {
      id: "auscultate_heart",
      category: "examine",
      label: "Auscultate the heart",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "There is a new high-pitched early diastolic murmur at the left sternal edge, consistent with acute aortic regurgitation.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "Heart sounds are now quiet and distant. The early diastolic murmur of aortic regurgitation is only just audible at the left sternal edge, and the JVP is raised.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome", "acid_reflux"],
      triggersEvent: "aortic_regurgitation_found",
      isKeyClue: true,
    },
    {
      id: "check_pulses",
      category: "examine",
      label: "Compare peripheral pulses",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "The left radial pulse is weaker and slightly delayed compared with the right. Femoral pulses remain palpable.",
      },
      variants: [
        {
          when: EXTENDING,
          result: {
            content:
              "The left radial pulse is now barely palpable, and the left femoral pulse is weaker than the right — the dissection is extending.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome", "acid_reflux"],
      triggersEvent: "pulse_deficit_found",
      isKeyClue: true,
    },
    {
      id: "perform_neuro_exam",
      category: "examine",
      label: "Perform a focused neurological exam",
      timeCostMin: 3,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Power and speech are currently normal; light-touch sensation is mildly reduced in the left hand.",
      },
      variants: [
        {
          when: EXTENDING,
          result: {
            content:
              "Speech is normal. Light-touch sensation is reduced in the left hand, and left grip is now weaker (4/5) — evolving malperfusion.",
          },
        },
      ],
      clueTier: "none",
      supports: ["aortic_dissection"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "order_ecg",
      category: "test",
      label: "12-lead ECG",
      timeCostMin: 3,
      moneyCost: 45,
      riskNote: "",
      result: {
        type: "ecg",
        content:
          "{rhythm} at {hr} bpm with left ventricular hypertrophy by voltage criteria and lateral ST depression with T-wave inversion (strain pattern). There is no regional ST elevation to suggest STEMI.",
        ecg: { preset: "lvh_strain" },
        annotation: ecgAnnotation(
          ["V5", "V6"],
          13,
          "LVH with lateral strain; no regional ST elevation",
        ),
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "{rhythm} at {hr} bpm. QRS voltages are now much lower than expected for his hypertrophy, with beat-to-beat electrical alternans — suggestive of a pericardial effusion. No regional ST elevation.",
            ecg: { preset: "lvh_effusion" },
            annotation: ecgAnnotation(["rhythm"], 14, "Low voltage with electrical alternans"),
          },
        },
      ],
      clueTier: "contradicting",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome"],
      triggersEvent: "ecg_not_stemi",
      isKeyClue: true,
    },
    {
      id: "order_troponin",
      category: "test",
      label: "Troponin and baseline bloods",
      timeCostMin: 6,
      moneyCost: 95,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "Troponin is mildly elevated, which is not specific for coronary occlusion in this critically ill patient.",
        labs: [
          { test: "High-sensitivity troponin", result: "42 ng/L", reference: "<14", flag: "high" },
          { test: "Haemoglobin", result: "13.8 g/dL", reference: "13.0–17.0", flag: "normal" },
          { test: "Creatinine", result: "102 µmol/L", reference: "60–110", flag: "normal" },
          { test: "Lactate", result: "2.6 mmol/L", reference: "0.5–2.2", flag: "high" },
        ],
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "Troponin is mildly raised, but haemoglobin is falling and lactate is climbing — bleeding and poor perfusion, not coronary occlusion.",
            labs: [
              {
                test: "High-sensitivity troponin",
                result: "58 ng/L",
                reference: "<14",
                flag: "high",
              },
              { test: "Haemoglobin", result: "11.9 g/dL", reference: "13.0–17.0", flag: "low" },
              { test: "Creatinine", result: "131 µmol/L", reference: "60–110", flag: "high" },
              { test: "Lactate", result: "4.6 mmol/L", reference: "0.5–2.2", flag: "critical" },
            ],
          },
        },
        {
          when: EXTENDING,
          result: {
            content:
              "Troponin is mildly elevated, which is not specific for coronary occlusion. Lactate and creatinine are rising as the dissection extends.",
            labs: [
              {
                test: "High-sensitivity troponin",
                result: "47 ng/L",
                reference: "<14",
                flag: "high",
              },
              { test: "Haemoglobin", result: "13.6 g/dL", reference: "13.0–17.0", flag: "normal" },
              { test: "Creatinine", result: "118 µmol/L", reference: "60–110", flag: "high" },
              { test: "Lactate", result: "3.2 mmol/L", reference: "0.5–2.2", flag: "high" },
            ],
          },
        },
      ],
      clueTier: "red_herring",
      supports: ["acute_coronary_syndrome", "aortic_dissection"],
      against: ["acid_reflux"],
      triggersEvent: "troponin_mildly_raised",
    },
    {
      id: "order_cxr",
      category: "test",
      label: "Portable chest X-ray",
      timeCostMin: 4,
      moneyCost: 85,
      riskNote: "Low-dose ionising radiation.",
      result: {
        type: "image",
        content:
          "The superior mediastinum is widened with an enlarged, indistinct aortic contour, and the heart is enlarged. There is no focal lung opacity.",
        assetId: "dissection_cxr_wide_mediastinum",
        annotation: {
          xPercent: 54,
          yPercent: 32,
          radiusPercent: 17,
          label: "Widened superior mediastinum",
        },
      },
      clueTier: "contradicting",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome", "acid_reflux"],
      triggersEvent: "widened_mediastinum_found",
      isKeyClue: true,
    },
    {
      id: "order_ct_aorta",
      category: "test",
      label: "CT aortic angiogram",
      timeCostMin: 16,
      moneyCost: 520,
      riskNote: "Ionising radiation and iodinated contrast exposure.",
      result: {
        type: "image",
        content:
          "An intimal flap arises in the ascending aorta and continues into the descending thoracic aorta: acute Stanford type A (DeBakey I) aortic dissection.",
        assetId: "dissection_ct_flap",
        annotation: {
          xPercent: 55,
          yPercent: 50,
          radiusPercent: 19,
          label: "Intimal flap in the ascending and descending aorta",
        },
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "The intimal flap runs from the ascending into the descending aorta, and fluid now surrounds the heart (haemopericardium): type A dissection with impending tamponade.",
            assetId: "dissection_ct_haemopericardium",
            annotation: {
              xPercent: 50,
              yPercent: 37,
              radiusPercent: 16,
              label: "Flap in the ascending aorta with surrounding pericardial fluid",
            },
          },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome", "acid_reflux"],
      triggersEvent: "type_a_dissection_confirmed",
      isKeyClue: true,
    },
    {
      id: "order_bedside_echo",
      category: "test",
      label: "Bedside echocardiogram",
      timeCostMin: 8,
      moneyCost: 220,
      riskNote: "A negative study cannot exclude dissection.",
      result: {
        type: "text",
        content:
          "A dilated aortic root and moderate aortic regurgitation are seen. There is a small pericardial effusion without tamponade physiology.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "A dilated aortic root with moderate aortic regurgitation. The pericardial effusion is now moderate, with right ventricular diastolic collapse — tamponade physiology.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["aortic_dissection"],
      against: ["acute_coronary_syndrome"],
      triggersEvent: "aortic_root_abnormality_found",
    },
    {
      id: "order_d_dimer",
      category: "test",
      label: "D-dimer",
      timeCostMin: 6,
      moneyCost: 60,
      riskNote: "Low specificity here; may delay definitive imaging.",
      result: {
        type: "lab_table",
        content:
          "D-dimer is elevated but does not distinguish acute aortic syndrome from other emergencies.",
        labs: [{ test: "D-dimer", result: "2,900 ng/mL FEU", reference: "<500", flag: "high" }],
      },
      clueTier: "none",
      supports: ["aortic_dissection", "pulmonary_embolism"],
      against: [],
      triggersEvent: "",
      isUnnecessary: true,
    },
    {
      id: "order_coronary_angiography",
      category: "test",
      label: "Send directly for coronary angiography",
      timeCostMin: 22,
      moneyCost: 900,
      riskNote: "Dangerous delay and invasive arterial procedure when dissection is suspected.",
      result: {
        type: "text",
        content:
          "Transfer toward the catheter lab delays aortic imaging while his pain and pulse deficit worsen.",
      },
      clueTier: "none",
      supports: ["acute_coronary_syndrome"],
      against: [],
      triggersEvent: "wrong_pathway_cath_lab",
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
          "Continuous ECG, pulse oximetry and frequent blood pressure monitoring are started. The monitor shows {rhythm} at {hr} bpm, right-arm BP {bp}, SpO₂ {spo2}%.",
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
        content: "Two large-bore IV cannulas are secured; blood is sent for group and cross-match.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "iv_access_ready",
      isCritical: true,
    },
    {
      id: "give_opioid_analgesia",
      category: "treat",
      label: "Give titrated IV opioid analgesia",
      timeCostMin: 2,
      moneyCost: 35,
      riskNote: "Monitor consciousness, breathing, and blood pressure.",
      result: {
        type: "text",
        content:
          "Titrated IV morphine eases his distress (pain 9/10 → 5/10) and blunts the sympathetic surge: HR {hr}, BP {bp}.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "pain_controlled",
      vitalsEffect: { hr: -4, systolicBp: -6, rr: -2 },
    },
    {
      id: "give_beta_blocker",
      category: "treat",
      label: "Start IV beta-blockade",
      timeCostMin: 3,
      moneyCost: 120,
      riskNote: "Titrate with close monitoring; assess for contraindications.",
      result: {
        type: "text",
        content:
          "IV esmolol is titrated: heart rate falls to {hr} bpm (target ≤60) and right-arm pressure to {bp}. Systolic is still above the 100–120 target; with the rate controlled, a vasodilator can now be added safely.",
      },
      variants: [
        {
          when: { afterActions: ["give_vasodilator_alone"] },
          result: {
            content:
              "IV esmolol blunts the reflex tachycardia from the vasodilator: heart rate falls to {hr} bpm (target ≤60) and right-arm pressure to {bp}.",
          },
        },
      ],
      clueTier: "none",
      supports: ["aortic_dissection"],
      against: [],
      triggersEvent: "aortic_impulse_control_started",
      isCritical: true,
      vitalsEffect: { hr: -38, systolicBp: -46, diastolicBp: -22 },
    },
    {
      id: "give_vasodilator_alone",
      category: "treat",
      label: "Start an IV vasodilator (GTN infusion)",
      timeCostMin: 2,
      moneyCost: 80,
      riskNote:
        "Without prior rate control, reflex tachycardia increases shear on the aortic wall.",
      result: {
        type: "text",
        content:
          "GTN lowers the pressure to {bp}, but reflex tachycardia to {hr} bpm increases the force on the injured aortic wall.",
      },
      variants: [
        {
          when: RATE_CONTROLLED,
          result: {
            content:
              "With the rate already controlled, the GTN infusion brings right-arm pressure down to {bp} without reflex tachycardia (HR {hr}).",
          },
          vitalsEffect: { hr: 2, systolicBp: -30, diastolicBp: -14 },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "reflex_tachycardia",
      penalizeWhenUnsafe: true,
      safeWhen: {
        allActionIds: ["give_beta_blocker"],
        explanation:
          "Add a vasodilator only after beta-blockade has controlled the heart rate; otherwise reflex tachycardia increases aortic wall shear.",
      },
      vitalsEffect: { hr: 16, systolicBp: -12 },
    },
    {
      id: "call_cardiothoracic_surgery",
      category: "treat",
      label: "Call cardiothoracic surgery urgently",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "The cardiothoracic team accepts him on the clinical picture and activates the emergency theatre pathway for suspected type A dissection, asking for CT aortography on the way.",
      },
      variants: [
        {
          when: BLEEDING,
          result: {
            content:
              "The cardiothoracic team comes straight down: with falling pressure and a likely haemopericardium, he is taken directly to theatre.",
          },
        },
        {
          when: { afterActions: ["order_ct_aorta"] },
          result: {
            content:
              "The cardiothoracic surgeon reviews the CT and accepts him for emergency type A repair; theatre is being prepared.",
          },
        },
      ],
      clueTier: "none",
      supports: ["aortic_dissection"],
      against: [],
      triggersEvent: "surgical_pathway_activated",
      isCritical: true,
      safeWhen: {
        anyActionIds: ["order_ct_aorta", "order_cxr", "check_both_arm_bp"],
        explanation:
          "Early surgical discussion is appropriate as soon as type A dissection is strongly suspected; do not wait for every result.",
      },
    },
    {
      id: "give_acs_antithrombotics",
      category: "treat",
      label: "Give aspirin and therapeutic heparin",
      timeCostMin: 2,
      moneyCost: 55,
      riskNote: "Can worsen bleeding into the aortic wall, pericardium, or rupture site.",
      result: {
        type: "text",
        content:
          "Antithrombotic treatment is given for presumed ACS. His pressure drops to {bp} as the risk of catastrophic haemorrhage rises sharply.",
      },
      clueTier: "none",
      supports: ["acute_coronary_syndrome"],
      against: [],
      triggersEvent: "anticoagulation_harm",
      harmful: true,
      vitalsEffect: { systolicBp: -14, diastolicBp: -8, hr: 8 },
    },
    {
      id: "give_thrombolysis",
      category: "treat",
      label: "Give thrombolysis for presumed STEMI",
      timeCostMin: 3,
      moneyCost: 680,
      riskNote: "Potentially fatal in aortic dissection.",
      result: {
        type: "text",
        content:
          "Thrombolysis triggers catastrophic bleeding from the dissected aorta. Daniel becomes profoundly hypotensive and arrests.",
      },
      clueTier: "none",
      supports: ["acute_coronary_syndrome"],
      against: [],
      triggersEvent: "fatal_thrombolysis",
      harmful: true,
      immediateFailure: true,
    },
    {
      id: "give_ppi",
      category: "treat",
      label: "Give antacid and observe",
      timeCostMin: 8,
      moneyCost: 12,
      riskNote: "Dangerous delay of definitive treatment.",
      result: {
        type: "text",
        content:
          "The antacid has no effect. His pain continues while definitive imaging and impulse control are delayed.",
      },
      clueTier: "none",
      supports: ["acid_reflux"],
      against: [],
      triggersEvent: "reflux_treatment_delay",
      harmful: true,
    },
    {
      id: "discharge_reflux",
      category: "treat",
      label: "Discharge with presumed reflux",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Catastrophic risk from untreated type A dissection.",
      result: {
        type: "text",
        content:
          "Daniel collapses before leaving the department as the untreated dissection ruptures.",
      },
      clueTier: "none",
      supports: ["acid_reflux"],
      against: [],
      triggersEvent: "patient_lost_after_discharge",
      harmful: true,
      immediateFailure: true,
    },
  ],
  differential: [
    {
      id: "aortic_dissection",
      label: "Acute aortic dissection",
      isCorrect: true,
      isTempting: false,
    },
    {
      id: "acute_coronary_syndrome",
      label: "Acute coronary syndrome / STEMI",
      isCorrect: false,
      isTempting: true,
    },
    { id: "acid_reflux", label: "Gastro-oesophageal reflux", isCorrect: false, isTempting: false },
    { id: "pulmonary_embolism", label: "Pulmonary embolism", isCorrect: false, isTempting: false },
    { id: "pericarditis", label: "Acute pericarditis", isCorrect: false, isTempting: false },
  ],
  hints: [
    {
      tier: 1,
      cost: 0,
      text: "Before treating a common chest-pain diagnosis, look for the feature that would make its standard treatment dangerous.",
    },
    {
      tier: 2,
      cost: 5,
      text: "Compare both arms, listen for a new diastolic murmur, and pay attention to the pain's onset and destination.",
    },
    {
      tier: 3,
      cost: 10,
      text: "This is an acute aortic syndrome until proven otherwise. Control impulse and involve surgery while confirming the anatomy.",
    },
  ],
  solution: {
    diagnosis: "Acute Stanford type A aortic dissection with aortic regurgitation",
    diagnosisId: "aortic_dissection",
    keyTreatment: [
      "start_monitoring",
      "give_opioid_analgesia",
      "give_beta_blocker",
      "call_cardiothoracic_surgery",
    ],
    teachingPoints: [
      "Abrupt maximal pain radiating to the back, pulse or blood-pressure asymmetry, and a new aortic regurgitation murmur are high-risk dissection features.",
      "Use IV beta-blockade first to reduce heart rate and aortic shear; add vasodilator only after adequate rate control if pressure remains high.",
      "Stanford type A dissection needs immediate cardiothoracic surgical management; antithrombotics or thrombolysis given for presumed MI can be fatal.",
    ],
    whyNotTempting:
      "ACS can cause severe chest pain, sweating, and a troponin rise, but it does not explain an abrupt tearing pain to the back, a large inter-arm pressure difference, pulse deficit, new aortic regurgitation, widened mediastinum, and a non-STEMI ECG.",
    harmfulActionDebrief: {
      order_coronary_angiography:
        "Treating the presentation as routine ACS delayed definitive aortic imaging and surgical activation.",
      give_vasodilator_alone:
        "Vasodilation before beta-blockade provoked reflex tachycardia and increased shear on the dissected aorta.",
      give_acs_antithrombotics:
        "Aspirin and heparin can worsen haemorrhage into the aortic wall or pericardium when dissection is present.",
      give_thrombolysis:
        "Thrombolysis is a potentially fatal error in aortic dissection because it can precipitate uncontrollable bleeding or rupture.",
      give_ppi:
        "Reflux treatment ignored multiple vascular red flags and delayed life-saving impulse control and surgery.",
      discharge_reflux:
        "Discharging sudden maximal chest pain with vascular findings left a type A dissection untreated.",
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
  assets: [
    {
      id: "dissection_cxr_wide_mediastinum",
      filename: "type-a-dissection-cxr.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:AoDiss_ChestXRay.jpg",
      author: "J. Heuser",
      license: "CC BY-SA 3.0 Unported",
      requiredAttributionText:
        "Chest radiograph of a Stanford type A aortic dissection by J. Heuser, via Wikimedia Commons (CC BY-SA 3.0); numeric labels removed.",
      altText:
        "Frontal chest radiograph showing a widened superior mediastinum with an enlarged, ill-defined aortic contour and an enlarged heart.",
      isPlaceholder: false,
    },
    {
      id: "dissection_ct_flap",
      filename: "type-a-dissection-ct.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:TypeAdissection.png",
      author: "James Heilman, MD",
      license: "CC BY-SA 3.0 Unported",
      requiredAttributionText:
        "Type A aortic dissection CT by James Heilman, MD, via Wikimedia Commons (CC BY-SA 3.0); arrows removed.",
      altText:
        "Axial contrast-enhanced chest CT showing an intimal flap in both the ascending and the descending thoracic aorta.",
      isPlaceholder: false,
    },
    {
      id: "dissection_ct_haemopericardium",
      filename: "type-a-dissection-haemopericardium-ct.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Dissection2018WithPericardial.jpg",
      author: "James Heilman, MD",
      license: "CC BY-SA 4.0 International",
      requiredAttributionText:
        "Type A dissection with pericardial effusion CT by James Heilman, MD, via Wikimedia Commons (CC BY-SA 4.0); arrows removed.",
      altText:
        "Axial CT angiogram showing an intimal flap in the ascending and descending aorta with fluid surrounding the heart.",
      isPlaceholder: false,
    },
  ],
  mockComparisonPercent: 54,
};

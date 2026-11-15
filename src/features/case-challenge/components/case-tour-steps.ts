import type { ActionCategory } from "../schema.js";
import type { GamePhase } from "../engine.js";
import type { AmbroseExpression } from "./dr-ambrose.js";

/**
 * The first-run tour of the case encounter, in the order a student actually
 * meets each part of the screen: who the patient is → the monitor → the
 * handover → the clock → acting → reading results → recording reasoning →
 * help → scoring → committing → the debrief.
 *
 * Copy only lives here; `case-tour.tsx` owns the mechanics. Wrap a phrase in
 * `**double asterisks**` to bold it.
 */

export interface TourContext {
  phase: GamePhase;
  /** Below `lg`: side panels fold into sheets and the top bar carries more. */
  compact: boolean;
}

export interface TourControls {
  startCase: () => void;
  openTray: (category: ActionCategory) => void;
  closeTray: () => void;
}

export interface TourStep {
  id: string;
  title: string;
  /** Paragraphs. Functions see the live phase / breakpoint. */
  body: (ctx: TourContext) => string[];
  /**
   * `data-tour` ids to spotlight, in order of preference; the first one that
   * is actually on screen wins (desktop and phone place things differently).
   * No match, or no targets → the card is centred with no spotlight.
   */
  targets?: (ctx: TourContext) => string[];
  expression?: AmbroseExpression;
  /** Replaces the "Next" button, e.g. to take over the case. */
  primary?: (ctx: TourContext) => { label: string; run: (controls: TourControls) => void } | null;
  onEnter?: (controls: TourControls) => void;
  onLeave?: (controls: TourControls) => void;
}

export const CASE_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to the ward",
    expression: "encouraging",
    body: ({ phase }) => [
      "I'm **Dr. Ambrose**, your clinical reasoning coach. In this simulation **you are the doctor**: you gather information, decide what's going on and choose how to treat it.",
      phase === "hook"
        ? "This quick tour walks through one case from handover to debrief, in the order you'll use each part of the screen. Nothing you see during the tour costs you time or points."
        : "This quick tour walks through a case from handover to debrief, in the order you'll use each part of the screen. Your case is paused while we look around: nothing here costs time or points.",
    ],
  },
  {
    id: "patient",
    title: "Start with your patient",
    expression: "neutral",
    targets: () => ["patient", "patient-chip"],
    body: ({ compact }) => [
      "This card is **who you're looking after**: name, age and sex, the **chief complaint** (why they came in), and tags for the key presenting features.",
      compact
        ? "Read it before you do anything else. Tap the card any time to open the full case details and your case tools."
        : "Read it before you do anything else. It stays here for the whole case.",
    ],
  },
  {
    id: "vitals",
    title: "Keep an eye on the monitor",
    expression: "concerned",
    targets: () => ["vitals"],
    body: () => [
      "Live vital signs: **heart rate, blood pressure, breathing rate, oxygen saturation and temperature**. A tile glows when a reading changes. Amber or red means it's abnormal.",
      "Glance at it after every move. It shows whether the patient is getting better or worse, and whether your treatment is working.",
    ],
  },
  {
    id: "handover",
    title: "Read the handover, then take over",
    expression: "encouraging",
    targets: ({ phase }) => (phase === "hook" ? ["handover"] : ["dock"]),
    body: ({ phase }) =>
      phase === "hook"
        ? [
            "Every case begins with a **handover**: a colleague's summary of what's happened so far. It gives you context, not the answer.",
            "When you've read it, press **Take over the case** to start your shift. I'll press it for you now so we can keep going. Taking over costs no time.",
          ]
        : [
            "Every case begins with a **handover**: a colleague's summary of what's happened so far. You've already taken this patient over, so it's saved at the top of your history.",
          ],
    primary: ({ phase }) =>
      phase === "hook"
        ? { label: "Take over the case", run: (controls) => controls.startCase() }
        : null,
  },
  {
    id: "clock",
    title: "The case clock",
    expression: "thinking",
    targets: () => ["clock"],
    body: () => [
      "This is **simulated time**, not real time. It only moves when you act, and each question, examination, test or treatment adds minutes. Take as long as you like to think.",
      "The patient's condition follows this clock, though. If something urgent is left too long, they'll deteriorate. Wasted minutes also lower your score.",
    ],
  },
  {
    id: "dock",
    title: "Four ways to act",
    expression: "neutral",
    targets: () => ["dock"],
    body: () => [
      "Every move lives in one of four groups: **Ask** (take a history), **Examine** (examine the patient), **Test** (bloods, ECG, imaging) and **Treat** (start management).",
      "A good rhythm is usually history → examination → tests → treatment, but you can go in any order and switch at any time. Tap a group to see its options and tap it again to close them. The small counter shows how many you've done.",
    ],
  },
  {
    id: "tray",
    title: "Check the cost before you choose",
    expression: "thinking",
    // Phones show the tray as a tall sheet, so ring one card there instead.
    targets: ({ compact }) => (compact ? ["tray-card", "tray"] : ["tray", "dock"]),
    onEnter: (controls) => controls.openTray("ask"),
    onLeave: (controls) => controls.closeTray(),
    body: ({ compact }) => [
      `${compact ? "These are the **Ask** options; here's the first one." : "Here are the **Ask** options."} Each card shows **how many minutes** it takes, any **money cost**, and a **risk note** when there's a danger to consider.`,
      "Choose deliberately. Unnecessary tests cost points and harmful choices cost far more, so **don't order everything**. Once an action is done it turns grey with a tick and can't be repeated.",
    ],
  },
  {
    id: "history",
    title: "Results appear in the history",
    expression: "neutral",
    targets: () => ["history"],
    body: ({ compact }) => [
      compact
        ? "Tap here to open the **interaction history**. It lists the patient's replies, examination findings, test results and images in order, with the time each one happened."
        : "The **interaction history** lists the patient's replies, examination findings, test results and images in order, with the time each one happened. Scroll back whenever you need to.",
      "Watch for **monitor alerts**. They mean something urgent hasn't been dealt with and the vitals are worsening. If one is ignored too long, the patient can be lost and the case ends.",
    ],
  },
  {
    id: "tools",
    title: "Your chart and notes",
    expression: "encouraging",
    targets: () => ["tools", "patient-chip"],
    body: ({ compact }) => [
      "Every useful finding is filed in the **Patient chart** automatically. A pop-up says “Finding added to chart” and a badge counts the new ones.",
      "**Clinical notes** is your private scratchpad for reasoning and to-dos. It saves as you type.",
      ...(compact ? ["On this screen size, tap the patient card to open these tools."] : []),
    ],
  },
  {
    id: "differential",
    title: "Build your differential",
    expression: "thinking",
    targets: () => ["tool-differential", "patient-chip"],
    body: () => [
      "Open **Differentials** to list the diagnoses you're considering. Put the most likely one first (drag, or use the arrows) and set how confident you are.",
      "Mark each finding **+** if it supports a diagnosis or **−** if it argues against it. Update the list as new clues come in. The debrief replays how your thinking changed.",
    ],
  },
  {
    id: "hints",
    title: "Stuck? Ask me",
    expression: "encouraging",
    targets: () => ["hint"],
    body: () => [
      "Tap me for a hint. There are three tiers, and each is more direct than the last. **The first is free**, and later ones cost a few points.",
      "Hints never cost clinical time and never block you. Try to reason it through first, but don't stay stuck.",
    ],
  },
  {
    id: "score",
    title: "How you're scored",
    expression: "neutral",
    targets: () => ["score", "hints-used"],
    body: () => [
      "You start at **100 points**. You lose points for going past the case's time target, unnecessary tests, harmful actions, hints, a wrong diagnosis or a missed key treatment. Finding a key clue early earns a **bonus**.",
      "Speed matters, but safety matters more. The debrief breaks down exactly where each point went.",
    ],
  },
  {
    id: "commit",
    title: "Commit when you're ready",
    expression: "proud",
    targets: () => ["commit"],
    body: () => [
      "When you're confident, **commit your diagnosis**. The button glows once you've ordered at least one test and listed a differential. You can commit earlier, but you'll be warned.",
      "You'll choose **one final diagnosis** and tick the **treatments you'd start**. Dangerous choices count against you. Committing ends the case. Choose “Keep investigating” if you're not sure yet.",
    ],
  },
  {
    id: "debrief",
    title: "Then: your debrief",
    expression: "proud",
    body: () => [
      "After you commit, you'll see the **outcome**, a **replay of every decision**, the key clues you found or missed, any harmful actions and why they were harmful, your **score breakdown** and three **teaching points**. Then retry the case or choose another.",
      "Your progress **saves automatically**. Use the back arrow to leave and you'll pick up where you left off.",
    ],
  },
  {
    id: "replay",
    title: "You're ready, doctor",
    expression: "encouraging",
    targets: () => ["tour-button"],
    body: () => [
      "You can take this tour again any time with this button.",
      "Start by reading the patient card and the monitor, then open **Ask**. Good luck!",
    ],
  },
];

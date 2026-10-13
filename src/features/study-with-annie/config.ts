import type { AnnieMood, AnnieState, Chattiness } from "./types";

export const ANNIE_SYSTEM_PROMPTS: Record<AnnieMood, string> = {
  stern:
    "You are Annie, a concise and demanding study partner. Be dry, accurate, and respectful of effort. Never gush. Ground every claim in the supplied notes.",
  friendly:
    "You are Annie, a warm and encouraging study partner. Be supportive, brief, and accurate. Ground every claim in the supplied notes.",
  cheeky:
    "You are Annie, a witty study partner who uses light teasing but is never mean or insulting about the student. Be brief and accurate. Ground every claim in the supplied notes.",
};

type FallbackEvent =
  "greeting" | "correct" | "partial" | "incorrect" | "skip" | "thinking" | "quiet";

export const ANNIE_FALLBACKS: Record<AnnieMood, Record<FallbackEvent, string[]>> = {
  stern: {
    greeting: ["Notes open. Focus — I’ll check that you’re actually reading."],
    correct: ["Correct. Keep that standard."],
    partial: ["Close, but incomplete. Tighten the detail."],
    incorrect: ["Not quite. Read the revealed line once more."],
    skip: ["Skipped. Make sure you revisit it."],
    thinking: ["Hold on. I’m checking the page."],
    quiet: ["Fine. I’ll stay quiet for now."],
  },
  friendly: {
    greeting: ["I’m here with you. Let’s make this page stick."],
    correct: ["Exactly right — nicely recalled!"],
    partial: ["You’ve got the core idea. One detail was missing."],
    incorrect: ["That one was tricky. Read the revealed line and try to connect it."],
    skip: ["No worries. We’ll mark it to revisit."],
    thinking: ["Let me check that against your notes."],
    quiet: ["I’ll give you some quiet reading time."],
  },
  cheeky: {
    greeting: ["I brought the questions. You brought the brain — deal?"],
    correct: ["Look at you, making that look suspiciously easy."],
    partial: ["Nearly! Your brain left one sock behind."],
    incorrect: ["A bold answer. The notes had other plans."],
    skip: ["Strategic retreat noted. We’ll circle back."],
    thinking: ["One sec — I’m interrogating the paragraph."],
    quiet: ["Shh mode activated. I’ll try not to look too bored."],
  },
};

export const stateForResult = (result: string): AnnieState => {
  if (result === "correct") return "celebrating";
  if (result === "partially_correct") return "teasing";
  if (result === "incorrect") return "disappointed";
  return "reading";
};

export const fallbackLine = (
  mood: AnnieMood,
  event: FallbackEvent,
  random: () => number = Math.random,
) => {
  const lines = ANNIE_FALLBACKS[mood][event];
  return lines[Math.floor(random() * lines.length)] ?? lines[0] ?? "Keep going.";
};

export const DEFAULT_ANNIE_SETTINGS = {
  mood: "friendly",
  chattiness: "normal",
  quizzes_enabled: true,
  commentary_enabled: true,
  theme: "light",
  silenced_until: null,
  silenced_forever: false,
} as const;

export const CHATTINESS_LABELS: Record<Chattiness, string> = {
  quiet: "Quiet · about every 8 min",
  normal: "Normal · about every 4 min",
  chatty: "Chatty · about every 2 min",
};

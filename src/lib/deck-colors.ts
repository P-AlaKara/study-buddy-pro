// Per-deck card colour is a presentation-only preference. It is stored in the
// browser (localStorage), never on the server, so it stays a pure UI choice and
// degrades gracefully where storage is unavailable (private windows, SSR, etc.).

export type DeckColor = { label: string; value: string };

export const DECK_COLORS: DeckColor[] = [
  { label: "Blush pink", value: "#ffe1ec" },
  { label: "Sky blue", value: "#dcefff" },
  { label: "Lavender", value: "#ecdcff" },
  { label: "Mint", value: "#dcfaeb" },
  { label: "Peach", value: "#ffe6d6" },
  { label: "Lemon yellow", value: "#fff0b7" },
];

/** Default card colour when the student hasn't picked one for a deck. */
export const DEFAULT_DECK_COLOR = "#fff0b7"; // lemon yellow

const KEY = (deckId: string) => `medley-deck-color-${deckId}`;

export function getDeckColor(deckId: string): string {
  try {
    const stored = localStorage.getItem(KEY(deckId));
    if (stored && DECK_COLORS.some((c) => c.value === stored)) return stored;
  } catch {
    /* storage blocked — fall through to the default */
  }
  return DEFAULT_DECK_COLOR;
}

export function setDeckColor(deckId: string, value: string): void {
  try {
    localStorage.setItem(KEY(deckId), value);
  } catch {
    /* storage blocked — the choice simply won't persist */
  }
}

// --- Decorative deck glyphs/tints (presentation only) ----------------------

const DECK_EMOJI: [RegExp, string][] = [
  [/cardio|heart|circulat/i, "🫀"],
  [/respir|lung|pulmon/i, "🫁"],
  [/neuro|brain|nerv/i, "🧠"],
  [/pharm|drug|anaesth|anesth/i, "💊"],
  [/path/i, "🔬"],
  [/anat|muscul|skelet|bone/i, "🦴"],
  [/micro|infect|immun/i, "🦠"],
  [/renal|kidney|urin/i, "🫘"],
  [/gastro|git|digest|hepat|liver/i, "🍽️"],
  [/derm|skin/i, "🧴"],
  [/psych|behav/i, "🧩"],
  [/obgyn|obstet|gyn|reprod/i, "🤰"],
  [/surg/i, "🔪"],
  [/endocrin|hormone/i, "🧬"],
];

export function deckEmoji(d: { subject?: string; title?: string; organ_system?: string | null }) {
  const hay = `${d.subject ?? ""} ${d.title ?? ""} ${d.organ_system ?? ""}`;
  for (const [re, e] of DECK_EMOJI) if (re.test(hay)) return e;
  return "🗂️";
}

const DECK_TINTS = [
  "bg-pink-soft",
  "bg-blue-soft",
  "bg-lavender-soft",
  "bg-mint-soft",
  "bg-yellow-soft",
];

export function deckTint(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DECK_TINTS[h % DECK_TINTS.length];
}

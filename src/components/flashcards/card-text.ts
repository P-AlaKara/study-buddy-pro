import { clozeFront, type Card } from "@/lib/flashcards";

export const isClozeCard = (c: Card) => c.type === "cloze" && !!c.cloze_text;

/** Plain-text prompt, used for sizing and the back-face recap. */
export function promptText(c: Card) {
  return isClozeCard(c) ? clozeFront(c.cloze_text!) : c.front;
}

/** Answer lines: multi-line answers become one rounded container per line. */
export function answerLines(back: string) {
  return back
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

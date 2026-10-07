export const DR_AMBROSE = {
  name: "Dr. Ambrose",
  role: "Clinical reasoning coach",
} as const;

export const FEATURED_CASE_ID = "case_001";

export const CASE_LIBRARY_INSTRUCTIONS = {
  title: "How cases work",
  intro:
    "Welcome to the hot seat. Good medicine is curious, careful, and a little allergic to guesswork.",
  steps: [
    "You're the doctor: ask questions, examine, order tests and treat.",
    "Every action costs time, and some cost money or carry risk, so don't order everything.",
    "Keep your differential board updated as clues come in.",
    "Stuck? Ask me for a hint. Hints cost points, but never block you.",
    "When you're ready, commit your diagnosis and treatment plan.",
  ],
} as const;

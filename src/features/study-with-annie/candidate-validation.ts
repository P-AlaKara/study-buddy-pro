export type RawQuizCandidate = {
  page: number;
  text: string;
  question_prompt: string;
  difficulty: number;
};

export function validateQuizCandidates(
  pageTexts: Map<number, string>,
  candidates: RawQuizCandidate[],
): RawQuizCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const pageText = pageTexts.get(candidate.page);
    if (!pageText || !candidate.text || !pageText.includes(candidate.text)) return false;
    if (
      !Number.isInteger(candidate.difficulty) ||
      candidate.difficulty < 1 ||
      candidate.difficulty > 3
    )
      return false;
    const key = `${candidate.page}:${candidate.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sentenceCandidates(page: number, text: string): RawQuizCandidate[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 240);

  return sentences.slice(0, 3).map((sentence, index) => ({
    page,
    text: sentence,
    question_prompt:
      index === 0
        ? "What does this part of the page say?"
        : "Can you recall the hidden idea in your own words?",
    difficulty: Math.min(3, 1 + index),
  }));
}

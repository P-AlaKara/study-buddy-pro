export type TextMatch = { start: number; end: number };

export function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function findNormalizedTextMatch(source: string, target: string): TextMatch | null {
  const normalizedSource = normalizePdfText(source);
  const normalizedTarget = normalizePdfText(target);
  if (!normalizedTarget) return null;
  const start = normalizedSource.indexOf(normalizedTarget);
  return start < 0 ? null : { start, end: start + normalizedTarget.length };
}

export function contextAroundSelection(source: string, selectedText: string, radius = 900) {
  const normalizedSource = source.replace(/\s+/g, " ").trim();
  const normalizedSelection = selectedText.replace(/\s+/g, " ").trim();
  const start = normalizedSource
    .toLocaleLowerCase()
    .indexOf(normalizedSelection.toLocaleLowerCase());
  if (start < 0) return null;
  const from = Math.max(0, start - radius);
  const to = Math.min(normalizedSource.length, start + normalizedSelection.length + radius);
  return normalizedSource.slice(from, to);
}

export function chunkPageText(text: string, maximum = 10_000) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + maximum);
    if (end < normalized.length) {
      const sentence = normalized.lastIndexOf(". ", end);
      if (sentence > cursor + maximum * 0.6) end = sentence + 1;
    }
    chunks.push(normalized.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

/** Identifier-like characters for double-click word selection. */
function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

export type WordAtColumn = {
  word: string;
  start: number;
  end: number;
};

/** Return the word covering `column` (0-based), or null if none. */
export function wordAtColumn(
  text: string,
  column: number,
): WordAtColumn | null {
  if (column < 0 || column >= text.length) return null;
  if (!isWordChar(text[column]!)) return null;

  let start = column;
  while (start > 0 && isWordChar(text[start - 1]!)) start--;

  let end = column + 1;
  while (end < text.length && isWordChar(text[end]!)) end++;

  return { word: text.slice(start, end), start, end };
}

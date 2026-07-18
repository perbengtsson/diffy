import type { DisplayLine } from './types.js';

/**
 * Find a display row for a source line number.
 * Prefers the new (right) gutter, then the old (left) gutter.
 */
export function findDisplayLineIndexByNumber(
  lines: readonly DisplayLine[],
  lineNo: number,
): number {
  if (lineNo < 1) return -1;

  let oldMatch = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.newLineNo === lineNo) return i;
    if (oldMatch < 0 && line.oldLineNo === lineNo) oldMatch = i;
  }
  return oldMatch;
}

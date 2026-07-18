import { buildDisplayLines } from '../diff/expand.js';
import type { DisplayLine } from '../diff/types.js';
import type { DiffFile, DiffMode } from '../git/types.js';
import type { SearchMatch } from './types.js';

const SKIP_KINDS = new Set<DisplayLine['kind']>([
  'hunk-header',
  'file-header',
  'binary',
]);

export function isSearchableLine(line: DisplayLine): boolean {
  return !SKIP_KINDS.has(line.kind);
}

export function findLineMatches(
  lines: DisplayLine[],
  query: string,
  filePath: string,
): SearchMatch[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const matches: SearchMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!isSearchableLine(line)) continue;
    if (line.content.toLowerCase().includes(needle)) {
      matches.push({ filePath, lineIndex: i });
    }
  }

  return matches;
}

export async function findAllFileMatches(
  files: DiffFile[],
  mode: DiffMode,
  repoRoot: string,
  query: string,
): Promise<SearchMatch[]> {
  if (!query) return [];

  const matches: SearchMatch[] = [];
  for (const file of files) {
    if (file.isBinary) continue;
    const lines = await buildDisplayLines(file, mode, repoRoot);
    matches.push(...findLineMatches(lines, query, file.path));
  }

  return matches;
}

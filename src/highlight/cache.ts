import { expandTabs } from '../display/text.js';
import type { DiffFile, DiffMode } from '../git/types.js';
import { getFileRevision, readFullFile } from '../git/diff.js';
import { languageFromPath } from './language.js';
import { highlightFileLines, type HighlightToken } from './tokens.js';

export type LineHighlightCache = {
  old: Map<number, HighlightToken[]>;
  new: Map<number, HighlightToken[]>;
};

export async function buildLineHighlightCache(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
): Promise<LineHighlightCache> {
  const language = languageFromPath(file.path);
  const [newLines, oldLines] = await Promise.all([
    readFullFile(repoRoot, getFileRevision(mode, file, 'new')),
    readFullFile(repoRoot, getFileRevision(mode, file, 'old')),
  ]);

  return {
    new: highlightFileLines(newLines.map(expandTabs), language),
    old: highlightFileLines(oldLines.map(expandTabs), language),
  };
}

export function tokensForLine(
  line: { kind: string; oldLineNo?: number; newLineNo?: number },
  cache: LineHighlightCache | undefined,
): HighlightToken[] | undefined {
  if (!cache) return undefined;

  switch (line.kind) {
    case 'delete':
      return line.oldLineNo !== undefined
        ? cache.old.get(line.oldLineNo)
        : undefined;
    case 'add':
    case 'context':
    case 'expanded-context':
      return line.newLineNo !== undefined
        ? cache.new.get(line.newLineNo)
        : undefined;
    default:
      return undefined;
  }
}

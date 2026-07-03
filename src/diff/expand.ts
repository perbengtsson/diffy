import gitDiffParser from 'gitdiff-parser';
import type { DiffFile, DiffMode } from '../git/types.js';
import { readLineRange, getFileRevision } from '../git/diff.js';
import type {
  DisplayLine,
  HunkExpansion,
  HunkMeta,
} from './types.js';

function hunkId(filePath: string, index: number): string {
  return `${filePath}#${index}`;
}

export function extractHunks(rawDiff: string, filePath: string): HunkMeta[] {
  if (!rawDiff.trim()) return [];
  try {
    const parsed = gitDiffParser.parse(rawDiff);
    const file =
      parsed.find((f) => f.newPath === filePath || f.oldPath === filePath) ??
      parsed[0];
    if (!file) return [];
    return file.hunks.map((hunk, index) => ({
      id: hunkId(filePath, index),
      index,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      oldPath: file.oldPath,
      newPath: file.newPath,
    }));
  } catch {
    return [];
  }
}

function parseDiffLines(rawDiff: string, filePath: string): DisplayLine[] {
  if (!rawDiff.trim()) return [];

  const lines: DisplayLine[] = [];
  const diffLines = rawDiff.split('\n');
  let hunkIndex = -1;

  for (const line of diffLines) {
    if (
      line.startsWith('diff --git ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename ') ||
      line.startsWith('similarity ') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode')
    ) {
      if (line.startsWith('--- ') || line.startsWith('diff --git ')) {
        lines.push({ kind: 'file-header', content: line });
      }
      continue;
    }

    if (line.startsWith('@@')) {
      hunkIndex++;
      lines.push({
        kind: 'hunk-header',
        content: line,
        hunkId: hunkId(filePath, hunkIndex),
      });
      continue;
    }

    if (hunkIndex < 0) continue;

    const id = hunkId(filePath, hunkIndex);
    if (line.startsWith('+')) {
      lines.push({ kind: 'add', content: line.slice(1), hunkId: id });
    } else if (line.startsWith('-')) {
      lines.push({ kind: 'delete', content: line.slice(1), hunkId: id });
    } else if (line.startsWith(' ') || line === '') {
      lines.push({
        kind: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        hunkId: id,
      });
    } else if (line.startsWith('\\')) {
      lines.push({ kind: 'context', content: line, hunkId: id });
    }
  }

  try {
    const parsed = gitDiffParser.parse(rawDiff);
    const file =
      parsed.find((f) => f.newPath === filePath || f.oldPath === filePath) ??
      parsed[0];
    if (!file) return lines;

    let lineIdx = 0;
    for (const hunk of file.hunks) {
      while (lineIdx < lines.length && lines[lineIdx]?.kind !== 'hunk-header') {
        lineIdx++;
      }
      lineIdx++;

      for (const change of hunk.changes) {
        while (lineIdx < lines.length && lines[lineIdx]?.kind === 'file-header') {
          lineIdx++;
        }
        if (lineIdx >= lines.length) break;
        const dl = lines[lineIdx];
        if (!dl || dl.kind === 'hunk-header') break;

        if (change.type === 'insert') {
          dl.newLineNo = change.lineNumber;
        } else if (change.type === 'delete') {
          dl.oldLineNo = change.lineNumber;
        } else {
          dl.oldLineNo = change.oldLineNumber;
          dl.newLineNo = change.newLineNumber;
        }
        lineIdx++;
      }
    }
  } catch {
    // keep lines without numbers
  }

  return lines;
}

function splitByHunks(lines: DisplayLine[]): Array<{
  header: DisplayLine | null;
  body: DisplayLine[];
  hunkId: string | undefined;
}> {
  const groups: Array<{
    header: DisplayLine | null;
    body: DisplayLine[];
    hunkId: string | undefined;
  }> = [];
  let current: DisplayLine[] = [];
  let header: DisplayLine | null = null;
  let currentHunkId: string | undefined;

  for (const line of lines) {
    if (line.kind === 'file-header') {
      if (header || current.length > 0) {
        groups.push({ header, body: current, hunkId: currentHunkId });
        current = [];
        header = null;
        currentHunkId = undefined;
      }
      groups.push({ header: line, body: [], hunkId: undefined });
      continue;
    }
    if (line.kind === 'hunk-header') {
      if (header || current.length > 0) {
        groups.push({ header, body: current, hunkId: currentHunkId });
      }
      header = line;
      current = [];
      currentHunkId = line.hunkId;
      continue;
    }
    current.push(line);
  }
  if (header || current.length > 0) {
    groups.push({ header, body: current, hunkId: currentHunkId });
  }
  return groups;
}

async function fetchExpandedLines(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
  hunk: HunkMeta,
  direction: 'before' | 'after',
  count: number,
): Promise<DisplayLine[]> {
  if (count <= 0) return [];

  const newRev = getFileRevision(mode, file, 'new');
  const oldRev = getFileRevision(mode, file, 'old');

  let newStart: number;
  let newEnd: number;
  let oldStart: number;
  let oldEnd: number;

  if (direction === 'before') {
    newEnd = hunk.newStart - 1;
    newStart = Math.max(1, hunk.newStart - count);
    oldEnd = hunk.oldStart - 1;
    oldStart = Math.max(1, hunk.oldStart - count);
  } else {
    newStart = hunk.newStart + hunk.newLines;
    newEnd = newStart + count - 1;
    oldStart = hunk.oldStart + hunk.oldLines;
    oldEnd = oldStart + count - 1;
  }

  const [newLines, oldLines] = await Promise.all([
    newEnd >= newStart
      ? readLineRange(repoRoot, newRev, newStart, newEnd)
      : Promise.resolve([]),
    oldEnd >= oldStart
      ? readLineRange(repoRoot, oldRev, oldStart, oldEnd)
      : Promise.resolve([]),
  ]);

  const existingNew = new Set<number>();
  const existingOld = new Set<number>();
  const result: DisplayLine[] = [];
  const maxLen = Math.max(newLines.length, oldLines.length);

  for (let j = 0; j < maxLen; j++) {
    const newNo = direction === 'before' ? newStart + j : newStart + j;
    const oldNo = direction === 'before' ? oldStart + j : oldStart + j;
    if (newLines[j] !== undefined && existingNew.has(newNo)) continue;
    if (oldLines[j] !== undefined && existingOld.has(oldNo)) continue;

    const content = newLines[j] ?? oldLines[j] ?? '';
    if (newLines[j] !== undefined) existingNew.add(newNo);
    if (oldLines[j] !== undefined) existingOld.add(oldNo);

    result.push({
      kind: 'expanded-context',
      content,
      oldLineNo: oldLines[j] !== undefined ? oldNo : undefined,
      newLineNo: newLines[j] !== undefined ? newNo : undefined,
      hunkId: hunk.id,
      side: newLines[j] !== undefined ? 'new' : 'old',
    });
  }

  return result;
}

function filterDuplicateContext(
  expanded: DisplayLine[],
  body: DisplayLine[],
): DisplayLine[] {
  const keys = new Set(
    body.map((l) => `${l.oldLineNo ?? ''}:${l.newLineNo ?? ''}:${l.content}`),
  );
  return expanded.filter(
    (l) => !keys.has(`${l.oldLineNo ?? ''}:${l.newLineNo ?? ''}:${l.content}`),
  );
}

export async function buildDisplayLines(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
  expansions: Map<string, HunkExpansion>,
): Promise<DisplayLine[]> {
  if (file.isBinary) {
    return [{ kind: 'binary', content: 'Binary file — no diff preview' }];
  }

  const parsed = parseDiffLines(file.rawDiff, file.path);
  const hunks = extractHunks(file.rawDiff, file.path);
  const hunkMap = new Map(hunks.map((h) => [h.id, h]));
  const groups = splitByHunks(parsed);
  const result: DisplayLine[] = [];

  for (const group of groups) {
    if (group.header?.kind === 'file-header') {
      result.push(group.header);
      continue;
    }

    const hunk = group.hunkId ? hunkMap.get(group.hunkId) : undefined;
    const expansion = group.hunkId ? expansions.get(group.hunkId) : undefined;

    if (hunk && expansion && expansion.before > 0) {
      const extra = await fetchExpandedLines(
        file,
        mode,
        repoRoot,
        hunk,
        'before',
        expansion.before,
      );
      result.push(...filterDuplicateContext(extra, group.body));
    }

    if (group.header) result.push(group.header);
    result.push(...group.body);

    if (hunk && expansion && expansion.after > 0) {
      const extra = await fetchExpandedLines(
        file,
        mode,
        repoRoot,
        hunk,
        'after',
        expansion.after,
      );
      result.push(...filterDuplicateContext(extra, []));
    }
  }

  return result;
}

export function findHunkAtLine(
  lines: DisplayLine[],
  lineIndex: number,
  hunks: HunkMeta[],
): HunkMeta | undefined {
  if (hunks.length === 0) return undefined;
  if (lineIndex < 0 || lineIndex >= lines.length) return hunks[0];

  const line = lines[lineIndex];
  if (line?.hunkId) return hunks.find((h) => h.id === line.hunkId);

  for (let i = lineIndex; i >= 0; i--) {
    const l = lines[i];
    if (l?.hunkId) return hunks.find((h) => h.id === l.hunkId);
  }
  return hunks[0];
}

export const EXPAND_STEP = 10;

export function expandHunk(
  expansions: Map<string, HunkExpansion>,
  id: string,
  direction: 'before' | 'after',
  step = EXPAND_STEP,
): Map<string, HunkExpansion> {
  const next = new Map(expansions);
  const current = next.get(id) ?? { before: 0, after: 0 };
  if (direction === 'before') {
    next.set(id, { ...current, before: current.before + step });
  } else {
    next.set(id, { ...current, after: current.after + step });
  }
  return next;
}

export function collapseHunk(
  expansions: Map<string, HunkExpansion>,
  id: string,
  direction: 'before' | 'after',
  step = EXPAND_STEP,
): Map<string, HunkExpansion> {
  const next = new Map(expansions);
  const current = next.get(id) ?? { before: 0, after: 0 };
  if (direction === 'before') {
    next.set(id, { ...current, before: Math.max(0, current.before - step) });
  } else {
    next.set(id, { ...current, after: Math.max(0, current.after - step) });
  }
  return next;
}

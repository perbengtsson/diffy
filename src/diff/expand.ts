import gitDiffParser from 'gitdiff-parser';
import type { File } from 'gitdiff-parser';
import { expandTabs } from '../display/text.js';
import type { DiffFile, DiffMode } from '../git/types.js';
import { getFileRevision, readFullFile } from '../git/diff.js';
import type { DisplayLine } from './types.js';

function findParsedFile(parsed: File[], filePath: string): File | undefined {
  const matches = parsed.filter(
    (entry) => entry.newPath === filePath || entry.oldPath === filePath,
  );
  if (matches.length === 0) return parsed[0];
  if (matches.length === 1) return matches[0];

  return {
    ...matches[0]!,
    hunks: matches
      .flatMap((entry) => entry.hunks)
      .sort((a, b) => a.newStart - b.newStart),
  };
}

async function buildPlainFileLines(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
): Promise<DisplayLine[]> {
  const revision = getFileRevision(mode, file, 'new');
  const fileLines = await readFullFile(repoRoot, revision);
  return fileLines.map((content, index) => ({
    kind: 'context' as const,
    content: expandTabs(content),
    oldLineNo: index + 1,
    newLineNo: index + 1,
  }));
}

async function buildFullUnifiedLines(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
): Promise<DisplayLine[]> {
  if (!file.rawDiff.trim()) {
    return buildPlainFileLines(file, mode, repoRoot);
  }

  let parsed: File[];
  try {
    parsed = gitDiffParser.parse(file.rawDiff);
  } catch {
    return buildPlainFileLines(file, mode, repoRoot);
  }

  const entry = findParsedFile(parsed, file.path);
  if (!entry) return buildPlainFileLines(file, mode, repoRoot);

  const newRev = getFileRevision(mode, file, 'new');
  const oldRev = getFileRevision(mode, file, 'old');
  const [newFileLines, oldFileLines] = await Promise.all([
    readFullFile(repoRoot, newRev),
    readFullFile(repoRoot, oldRev),
  ]);

  if (entry.type === 'add' || file.status === 'untracked' || file.status === 'added') {
    const source = newFileLines.length > 0 ? newFileLines : entry.hunks.flatMap((hunk) =>
      hunk.changes
        .filter((change) => change.type === 'insert')
        .map((change) => change.content),
    );
    return source.map((content, index) => ({
      kind: 'add' as const,
      content: expandTabs(content),
      newLineNo: index + 1,
    }));
  }

  if (entry.type === 'delete' || file.status === 'deleted') {
    const source = oldFileLines.length > 0 ? oldFileLines : entry.hunks.flatMap((hunk) =>
      hunk.changes
        .filter((change) => change.type === 'delete')
        .map((change) => change.content),
    );
    return source.map((content, index) => ({
      kind: 'delete' as const,
      content: expandTabs(content),
      oldLineNo: index + 1,
    }));
  }

  const result: DisplayLine[] = [];
  let nextNewLine = 1;
  let nextOldLine = 1;

  for (const hunk of entry.hunks) {
    while (nextNewLine < hunk.newStart) {
      result.push({
        kind: 'context',
        content: expandTabs(newFileLines[nextNewLine - 1] ?? ''),
        oldLineNo: nextOldLine,
        newLineNo: nextNewLine,
      });
      nextNewLine++;
      nextOldLine++;
    }

    for (const change of hunk.changes) {
      if (change.type === 'normal') {
        const oldLineNo = change.oldLineNumber;
        const newLineNo = change.newLineNumber;
        result.push({
          kind: 'context',
          content: expandTabs(change.content),
          oldLineNo,
          newLineNo,
        });
        nextNewLine = (change.newLineNumber ?? nextNewLine) + 1;
        nextOldLine = (change.oldLineNumber ?? nextOldLine) + 1;
      } else if (change.type === 'delete') {
        const oldLineNo = change.lineNumber ?? nextOldLine;
        result.push({
          kind: 'delete',
          content: expandTabs(change.content),
          oldLineNo,
        });
        nextOldLine = oldLineNo + 1;
      } else if (change.type === 'insert') {
        const newLineNo = change.lineNumber ?? nextNewLine;
        result.push({
          kind: 'add',
          content: expandTabs(change.content),
          newLineNo,
        });
        nextNewLine = newLineNo + 1;
      }
    }
  }

  while (nextNewLine <= newFileLines.length) {
    result.push({
      kind: 'context',
      content: expandTabs(newFileLines[nextNewLine - 1] ?? ''),
      oldLineNo: nextOldLine,
      newLineNo: nextNewLine,
    });
    nextNewLine++;
    nextOldLine++;
  }

  return result;
}

export async function buildDisplayLines(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
): Promise<DisplayLine[]> {
  if (file.isBinary) {
    return [{ kind: 'binary', content: 'Binary file — no diff preview' }];
  }

  if (file.status === 'unchanged') {
    return buildPlainFileLines(file, mode, repoRoot);
  }

  return buildFullUnifiedLines(file, mode, repoRoot);
}

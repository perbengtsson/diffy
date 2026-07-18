import type { DiffFile, DiffMode } from '../git/types.js';
import { isEditedFile } from '../files/tree.js';
import { buildDisplayLines } from './expand.js';
import type { DisplayLine } from './types.js';

function isChangeLine(line: DisplayLine | undefined): boolean {
  return line?.kind === 'add' || line?.kind === 'delete';
}

/** Indices where a contiguous add/delete run begins. */
export function changeBlockStarts(lines: readonly DisplayLine[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isChangeLine(lines[i]) && !isChangeLine(lines[i - 1])) {
      starts.push(i);
    }
  }
  return starts;
}

/** Next change-block start after `fromIndex`, or -1 if none. */
export function findNextChangeBlock(
  lines: readonly DisplayLine[],
  fromIndex: number,
): number {
  const starts = changeBlockStarts(lines);
  for (const start of starts) {
    if (start > fromIndex) return start;
  }
  return -1;
}

/** Previous change-block start before `fromIndex`, or -1 if none. */
export function findPrevChangeBlock(
  lines: readonly DisplayLine[],
  fromIndex: number,
): number {
  const starts = changeBlockStarts(lines);
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i]!;
    if (start < fromIndex) return start;
  }
  return -1;
}

export type ChangeLocation = {
  filePath: string;
  lineIndex: number;
};

export type FileChangeStarts = {
  filePath: string;
  starts: readonly number[];
};

/** Next change across precomputed per-file block starts (repo order). */
export function findNextAcrossFiles(
  fileStarts: readonly FileChangeStarts[],
  currentPath: string | null,
  fromLineIndex: number,
): ChangeLocation | null {
  const idx = currentPath
    ? fileStarts.findIndex((f) => f.filePath === currentPath)
    : -1;

  if (idx >= 0) {
    for (const start of fileStarts[idx]!.starts) {
      if (start > fromLineIndex) {
        return { filePath: currentPath!, lineIndex: start };
      }
    }
  }

  for (let i = idx + 1; i < fileStarts.length; i++) {
    const entry = fileStarts[i]!;
    if (entry.starts.length > 0) {
      return { filePath: entry.filePath, lineIndex: entry.starts[0]! };
    }
  }
  return null;
}

/** Previous change across precomputed per-file block starts (repo order). */
export function findPrevAcrossFiles(
  fileStarts: readonly FileChangeStarts[],
  currentPath: string | null,
  fromLineIndex: number,
): ChangeLocation | null {
  const idx = currentPath
    ? fileStarts.findIndex((f) => f.filePath === currentPath)
    : -1;

  if (idx >= 0) {
    const starts = fileStarts[idx]!.starts;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i]! < fromLineIndex) {
        return { filePath: currentPath!, lineIndex: starts[i]! };
      }
    }
  }

  const before = idx >= 0 ? idx : fileStarts.length;
  for (let i = before - 1; i >= 0; i--) {
    const entry = fileStarts[i]!;
    if (entry.starts.length > 0) {
      return {
        filePath: entry.filePath,
        lineIndex: entry.starts[entry.starts.length - 1]!,
      };
    }
  }
  return null;
}

function navigableFiles(files: readonly DiffFile[]): DiffFile[] {
  return files.filter((file) => isEditedFile(file) && !file.isBinary);
}

/**
 * Index in `navigable` for `currentPath`, or the last navigable file that
 * appears before it in `allFiles` when the current path itself is not navigable.
 */
export function navigableFileIndex(
  allFiles: readonly DiffFile[],
  navigable: readonly DiffFile[],
  currentPath: string | null,
): number {
  if (!currentPath) return -1;
  const direct = navigable.findIndex((file) => file.path === currentPath);
  if (direct >= 0) return direct;

  const fullIdx = allFiles.findIndex((file) => file.path === currentPath);
  if (fullIdx < 0) return -1;

  let result = -1;
  for (let i = 0; i < navigable.length; i++) {
    const path = navigable[i]!.path;
    const fi = allFiles.findIndex((file) => file.path === path);
    if (fi < fullIdx) result = i;
    else break;
  }
  return result;
}

async function changeStartsForFile(
  file: DiffFile,
  mode: DiffMode,
  repoRoot: string,
): Promise<number[]> {
  const lines = await buildDisplayLines(file, mode, repoRoot);
  return changeBlockStarts(lines);
}

export async function findNextGlobalChangeBlock(
  files: readonly DiffFile[],
  mode: DiffMode,
  repoRoot: string,
  currentPath: string | null,
  fromLineIndex: number,
  currentLines: readonly DisplayLine[],
): Promise<ChangeLocation | null> {
  const navigable = navigableFiles(files);
  if (navigable.length === 0) return null;

  const idx = navigableFileIndex(files, navigable, currentPath);
  const onNavigable =
    currentPath !== null && navigable[idx]?.path === currentPath;

  if (onNavigable) {
    const next = findNextChangeBlock(currentLines, fromLineIndex);
    if (next >= 0) return { filePath: currentPath, lineIndex: next };
  }

  for (let i = idx + 1; i < navigable.length; i++) {
    const file = navigable[i]!;
    const starts = await changeStartsForFile(file, mode, repoRoot);
    if (starts.length > 0) {
      return { filePath: file.path, lineIndex: starts[0]! };
    }
  }
  return null;
}

export async function findPrevGlobalChangeBlock(
  files: readonly DiffFile[],
  mode: DiffMode,
  repoRoot: string,
  currentPath: string | null,
  fromLineIndex: number,
  currentLines: readonly DisplayLine[],
): Promise<ChangeLocation | null> {
  const navigable = navigableFiles(files);
  if (navigable.length === 0) return null;

  const idx = navigableFileIndex(files, navigable, currentPath);
  const onNavigable =
    currentPath !== null && navigable[idx]?.path === currentPath;

  if (onNavigable) {
    const prev = findPrevChangeBlock(currentLines, fromLineIndex);
    if (prev >= 0) return { filePath: currentPath, lineIndex: prev };
  }

  const start =
    currentPath === null
      ? navigable.length - 1
      : onNavigable
        ? idx - 1
        : idx;

  for (let i = start; i >= 0; i--) {
    const file = navigable[i]!;
    const starts = await changeStartsForFile(file, mode, repoRoot);
    if (starts.length > 0) {
      return {
        filePath: file.path,
        lineIndex: starts[starts.length - 1]!,
      };
    }
  }
  return null;
}

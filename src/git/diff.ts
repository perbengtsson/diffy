import { execFile } from 'node:child_process';
import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gitOrThrow, gitDiffOutput, findRepoRoot } from './runner.js';
import type {
  DiffFile,
  DiffMode,
  DiffSnapshot,
  FileRevision,
  FileStatus,
} from './types.js';

const execFileAsync = promisify(execFile);
const CONTEXT_LINES = 3;
/** Git-style probe window: NUL in the first 8 KiB means binary. */
const BINARY_PROBE_BYTES = 8000;

/** True when `sample` looks like binary (NUL in the first 8 KiB). */
export function looksBinary(sample: Buffer): boolean {
  const end = Math.min(sample.length, BINARY_PROBE_BYTES);
  return sample.subarray(0, end).includes(0);
}

function workingTreeLooksBinary(repoRoot: string, path: string): boolean {
  try {
    const fd = openSync(join(repoRoot, path), 'r');
    try {
      const buf = Buffer.alloc(BINARY_PROBE_BYTES);
      const n = readSync(fd, buf, 0, BINARY_PROBE_BYTES, 0);
      return looksBinary(buf.subarray(0, n));
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

async function gitShowBuffer(
  repoRoot: string,
  revPath: string,
): Promise<Buffer | null> {
  try {
    const { stdout } = await execFileAsync('git', ['show', revPath], {
      cwd: repoRoot,
      encoding: 'buffer',
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/** Probe whether a revision's content looks binary (working tree or git object). */
export async function revisionLooksBinary(
  repoRoot: string,
  revision: FileRevision,
): Promise<boolean> {
  if (revision.ref === null) {
    return workingTreeLooksBinary(repoRoot, revision.path);
  }

  const buf = await gitShowBuffer(
    repoRoot,
    `${revision.ref}:${revision.path}`,
  );
  if (!buf) return false;
  return looksBinary(buf);
}

function splitTextLines(content: string): string[] {
  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function countStats(rawDiff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of rawDiff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) additions++;
    else if (line.startsWith('-')) deletions++;
  }
  return { additions, deletions };
}

function isBinaryDiff(rawDiff: string): boolean {
  return rawDiff.includes('Binary files') || rawDiff.includes('GIT binary patch');
}

function statusFromDiff(rawDiff: string): FileStatus {
  if (rawDiff.includes('new file mode')) return 'added';
  if (rawDiff.includes('deleted file mode')) return 'deleted';
  if (rawDiff.includes('rename from') || rawDiff.includes('rename to')) return 'renamed';
  return 'modified';
}

async function listUntracked(repoRoot: string): Promise<string[]> {
  const out = await gitOrThrow(
    ['ls-files', '--others', '--exclude-standard'],
    repoRoot,
  );
  return out.split('\n').filter(Boolean);
}

async function diffUntrackedFile(
  repoRoot: string,
  path: string,
): Promise<string> {
  const abs = join(repoRoot, path);
  const raw = await gitDiffOutput(
    ['diff', '--no-index', '-U' + String(CONTEXT_LINES), '/dev/null', abs],
    repoRoot,
  );
  return raw.replace(
    /^diff --git a\/dev\/null b\/(.+)$/m,
    `diff --git a/${path} b/${path}`,
  );
}

async function listTrackedFiles(repoRoot: string): Promise<string[]> {
  const out = await gitOrThrow(['ls-files'], repoRoot);
  return out.split('\n').filter(Boolean);
}

function mergeWithTrackedFiles(
  changedFiles: DiffFile[],
  trackedPaths: string[],
  repoRoot: string,
): DiffFile[] {
  const changedMap = new Map(changedFiles.map((file) => [file.path, file]));
  const paths = new Set(trackedPaths);
  for (const file of changedFiles) paths.add(file.path);

  const files: DiffFile[] = [];
  for (const path of [...paths].sort()) {
    const changed = changedMap.get(path);
    if (changed) {
      files.push(changed);
    } else {
      files.push({
        path,
        status: 'unchanged',
        additions: 0,
        deletions: 0,
        rawDiff: '',
        isBinary: workingTreeLooksBinary(repoRoot, path),
      });
    }
  }
  return files;
}

async function getUncommittedFiles(
  repoRoot: string,
  stagedOnly: boolean,
): Promise<DiffFile[]> {
  const fileMap = new Map<string, { staged?: string; unstaged?: string; untracked?: boolean }>();

  if (!stagedOnly) {
    const unstagedOut = await gitDiffOutput(['diff', '--name-only'], repoRoot);
    for (const p of unstagedOut.split('\n').filter(Boolean)) {
      fileMap.set(p, { ...(fileMap.get(p) ?? {}), unstaged: p });
    }
    for (const p of await listUntracked(repoRoot)) {
      fileMap.set(p, { ...(fileMap.get(p) ?? {}), untracked: true });
    }
  }

  const stagedOut = await gitDiffOutput(['diff', '--cached', '--name-only'], repoRoot);
  for (const p of stagedOut.split('\n').filter(Boolean)) {
    fileMap.set(p, { ...(fileMap.get(p) ?? {}), staged: p });
  }

  const files: DiffFile[] = [];
  for (const [path, entry] of fileMap) {
    if (stagedOnly && !entry.staged) continue;

    let rawDiff = '';
    if (entry.untracked) {
      rawDiff = await diffUntrackedFile(repoRoot, path);
    } else {
      const parts: string[] = [];
      if (entry.staged) {
        const staged = await gitDiffOutput(
          ['diff', '-U' + String(CONTEXT_LINES), '--cached', '--', path],
          repoRoot,
        );
        if (staged) parts.push(staged);
      }
      if (entry.unstaged && !stagedOnly) {
        const unstaged = await gitDiffOutput(
          ['diff', '-U' + String(CONTEXT_LINES), '--', path],
          repoRoot,
        );
        if (unstaged) parts.push(unstaged);
      }
      rawDiff = parts.join('\n');
    }

    const stats = countStats(rawDiff);
    const binary = isBinaryDiff(rawDiff);
    files.push({
      path,
      status: entry.untracked ? 'untracked' : statusFromDiff(rawDiff),
      additions: stats.additions,
      deletions: stats.deletions,
      rawDiff,
      isBinary: binary,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

async function getBaseDiffFiles(
  repoRoot: string,
  base: string,
  includeUncommitted: boolean,
): Promise<DiffFile[]> {
  const committedDiff = await gitDiffOutput(
    ['diff', '-U' + String(CONTEXT_LINES), `${base}...HEAD`],
    repoRoot,
  );

  const filePaths = new Set<string>();
  for (const line of committedDiff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) filePaths.add(match[2] ?? match[1] ?? '');
    }
  }

  if (includeUncommitted) {
    const uncommitted = await getUncommittedFiles(repoRoot, false);
    for (const f of uncommitted) filePaths.add(f.path);
  }

  const files: DiffFile[] = [];
  for (const path of [...filePaths].sort()) {
    let rawDiff = '';
    const committedPart = await gitDiffOutput(
      ['diff', '-U' + String(CONTEXT_LINES), `${base}...HEAD`, '--', path],
      repoRoot,
    );
    rawDiff = committedPart;

    if (includeUncommitted) {
      const staged = await gitDiffOutput(
        ['diff', '-U' + String(CONTEXT_LINES), '--cached', '--', path],
        repoRoot,
      );
      const unstaged = await gitDiffOutput(
        ['diff', '-U' + String(CONTEXT_LINES), '--', path],
        repoRoot,
      );
      const parts = [rawDiff, staged, unstaged].filter(Boolean);
      rawDiff = parts.join('\n');

      const isUntracked = (await listUntracked(repoRoot)).includes(path);
      if (isUntracked && !rawDiff) {
        rawDiff = await diffUntrackedFile(repoRoot, path);
      }
    }

    if (!rawDiff.trim()) continue;

    const stats = countStats(rawDiff);
    files.push({
      path,
      status: statusFromDiff(rawDiff),
      additions: stats.additions,
      deletions: stats.deletions,
      rawDiff,
      isBinary: isBinaryDiff(rawDiff),
    });
  }

  return files;
}

function modeLabel(mode: DiffMode): string {
  if (mode.kind === 'uncommitted') {
    return mode.stagedOnly ? 'staged' : 'uncommitted';
  }
  return mode.includeUncommitted
    ? `vs ${mode.base} + uncommitted`
    : `vs ${mode.base}`;
}

export async function loadDiffSnapshot(
  cwd: string,
  mode: DiffMode,
): Promise<DiffSnapshot> {
  const repoRoot = await findRepoRoot(cwd);
  const changedFiles =
    mode.kind === 'uncommitted'
      ? await getUncommittedFiles(repoRoot, mode.stagedOnly)
      : await getBaseDiffFiles(repoRoot, mode.base, mode.includeUncommitted);
  const trackedPaths = await listTrackedFiles(repoRoot);
  const files = mergeWithTrackedFiles(changedFiles, trackedPaths, repoRoot);

  return {
    repoRoot,
    mode,
    files,
    modeLabel: modeLabel(mode),
  };
}

export function getFileRevision(
  mode: DiffMode,
  file: DiffFile,
  side: 'old' | 'new',
): FileRevision {
  const path = file.path;

  if (file.status === 'untracked') {
    return side === 'old'
      ? { ref: 'HEAD', path: path }
      : { ref: null, path: path };
  }

  if (file.status === 'added') {
    return side === 'old'
      ? { ref: 'HEAD', path: path }
      : { ref: null, path: path };
  }

  if (file.status === 'deleted') {
    return side === 'old'
      ? { ref: 'HEAD', path: path }
      : { ref: 'HEAD', path: path };
  }

  if (mode.kind === 'base' && !mode.includeUncommitted) {
    return side === 'old'
      ? { ref: mode.base, path: path }
      : { ref: 'HEAD', path: path };
  }

  if (mode.kind === 'base' && mode.includeUncommitted) {
    return side === 'old'
      ? { ref: mode.base, path: path }
      : { ref: null, path: path };
  }

  if (mode.kind === 'uncommitted' && mode.stagedOnly) {
    return side === 'old'
      ? { ref: 'HEAD', path: path }
      : { ref: ':0', path: path };
  }

  // uncommitted default: old = index/HEAD mix — use HEAD for old side baseline
  return side === 'old'
    ? { ref: 'HEAD', path: path }
    : { ref: null, path: path };
}

export async function readLineRange(
  repoRoot: string,
  revision: FileRevision,
  startLine: number,
  endLine: number,
): Promise<string[]> {
  if (startLine < 1 || endLine < startLine) return [];

  const lines = await readFullFile(repoRoot, revision);
  return lines.slice(startLine - 1, endLine);
}

export async function readFullFile(
  repoRoot: string,
  revision: FileRevision,
): Promise<string[]> {
  if (revision.ref === null) {
    try {
      const buf = readFileSync(join(repoRoot, revision.path));
      if (looksBinary(buf)) return [];
      return splitTextLines(buf.toString('utf8'));
    } catch {
      return [];
    }
  }

  const buf = await gitShowBuffer(
    repoRoot,
    `${revision.ref}:${revision.path}`,
  );
  if (!buf || looksBinary(buf)) return [];
  return splitTextLines(buf.toString('utf8'));
}

export { CONTEXT_LINES };

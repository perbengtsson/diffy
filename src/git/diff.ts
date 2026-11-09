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

function collectDiffGitPaths(rawDiff: string): string[] {
  const paths: string[] = [];
  for (const line of rawDiff.split('\n')) {
    if (!line.startsWith('diff --git ')) continue;
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) paths.push(match[2] ?? match[1] ?? '');
  }
  return paths;
}

function diffFileEntry(
  path: string,
  rawDiff: string,
  status?: FileStatus,
): DiffFile | null {
  if (!rawDiff.trim()) return null;
  const stats = countStats(rawDiff);
  return {
    path,
    status: status ?? statusFromDiff(rawDiff),
    additions: stats.additions,
    deletions: stats.deletions,
    rawDiff,
    isBinary: isBinaryDiff(rawDiff),
  };
}

async function getUncommittedFiles(
  repoRoot: string,
  stagedOnly: boolean,
): Promise<DiffFile[]> {
  // Single coherent diff (HEAD→worktree or index), never concatenate staged+unstaged:
  // a committed/staged add later removed in the worktree must net out, not stay green.
  const fileMap = new Map<string, { tracked?: boolean; untracked?: boolean }>();

  if (stagedOnly) {
    const stagedOut = await gitDiffOutput(
      ['diff', '--cached', '--name-only'],
      repoRoot,
    );
    for (const p of stagedOut.split('\n').filter(Boolean)) {
      fileMap.set(p, { tracked: true });
    }
  } else {
    const dirtyOut = await gitDiffOutput(['diff', 'HEAD', '--name-only'], repoRoot);
    for (const p of dirtyOut.split('\n').filter(Boolean)) {
      fileMap.set(p, { tracked: true });
    }
    for (const p of await listUntracked(repoRoot)) {
      fileMap.set(p, { ...(fileMap.get(p) ?? {}), untracked: true });
    }
  }

  const files: DiffFile[] = [];
  for (const [path, entry] of fileMap) {
    let rawDiff = '';
    if (entry.untracked) {
      rawDiff = await diffUntrackedFile(repoRoot, path);
    } else if (stagedOnly) {
      rawDiff = await gitDiffOutput(
        ['diff', '-U' + String(CONTEXT_LINES), '--cached', '--', path],
        repoRoot,
      );
    } else {
      rawDiff = await gitDiffOutput(
        ['diff', '-U' + String(CONTEXT_LINES), 'HEAD', '--', path],
        repoRoot,
      );
    }

    const file = diffFileEntry(
      path,
      rawDiff,
      entry.untracked ? 'untracked' : undefined,
    );
    if (file) files.push(file);
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

async function getBaseDiffFiles(
  repoRoot: string,
  base: string,
  includeUncommitted: boolean,
): Promise<DiffFile[]> {
  // With --include-uncommitted, show the net review diff (merge-base → worktree)
  // instead of concatenating base...HEAD + staged + unstaged. Concatenation made
  // additions that were later removed still appear as green adds (#10).
  if (includeUncommitted) {
    const mergeBase = (
      await gitOrThrow(['merge-base', base, 'HEAD'], repoRoot)
    ).trim();
    const untracked = new Set(await listUntracked(repoRoot));
    const nameOut = await gitDiffOutput(
      ['diff', '--name-only', mergeBase],
      repoRoot,
    );
    const filePaths = new Set<string>([
      ...nameOut.split('\n').filter(Boolean),
      ...untracked,
    ]);

    const files: DiffFile[] = [];
    for (const path of [...filePaths].sort()) {
      let rawDiff = '';
      let status: FileStatus | undefined;
      if (untracked.has(path)) {
        rawDiff = await diffUntrackedFile(repoRoot, path);
        status = 'untracked';
      } else {
        rawDiff = await gitDiffOutput(
          ['diff', '-U' + String(CONTEXT_LINES), mergeBase, '--', path],
          repoRoot,
        );
      }
      const file = diffFileEntry(path, rawDiff, status);
      if (file) files.push(file);
    }
    return files;
  }

  const committedDiff = await gitDiffOutput(
    ['diff', '-U' + String(CONTEXT_LINES), `${base}...HEAD`],
    repoRoot,
  );

  const filePaths = new Set(collectDiffGitPaths(committedDiff));
  const files: DiffFile[] = [];
  for (const path of [...filePaths].sort()) {
    const rawDiff = await gitDiffOutput(
      ['diff', '-U' + String(CONTEXT_LINES), `${base}...HEAD`, '--', path],
      repoRoot,
    );
    const file = diffFileEntry(path, rawDiff);
    if (file) files.push(file);
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

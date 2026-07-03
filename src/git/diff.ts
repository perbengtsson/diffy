import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, gitOrThrow, findRepoRoot } from './runner.js';
import type {
  DiffFile,
  DiffMode,
  DiffSnapshot,
  FileRevision,
  FileStatus,
} from './types.js';

const CONTEXT_LINES = 3;

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

function statusFromDiff(rawDiff: string, path: string): FileStatus {
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
  const { stdout, stderr } = await git(
    ['diff', '--no-index', '-U' + String(CONTEXT_LINES), '/dev/null', abs],
    repoRoot,
  );
  const raw = stdout || stderr;
  return raw.replace(/^diff --git a\/dev\/null b\/(.+)$/m, `diff --git a/${path} b/${path}`);
}

async function getUncommittedFiles(
  repoRoot: string,
  stagedOnly: boolean,
): Promise<DiffFile[]> {
  const fileMap = new Map<string, { staged?: string; unstaged?: string; untracked?: boolean }>();

  if (!stagedOnly) {
    const unstagedOut = await gitOrThrow(['diff', '--name-only'], repoRoot);
    for (const p of unstagedOut.split('\n').filter(Boolean)) {
      fileMap.set(p, { ...(fileMap.get(p) ?? {}), unstaged: p });
    }
    for (const p of await listUntracked(repoRoot)) {
      fileMap.set(p, { ...(fileMap.get(p) ?? {}), untracked: true });
    }
  }

  const stagedOut = await gitOrThrow(['diff', '--cached', '--name-only'], repoRoot);
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
        const staged = await gitOrThrow(
          ['diff', '-U' + String(CONTEXT_LINES), '--cached', '--', path],
          repoRoot,
        );
        if (staged) parts.push(staged);
      }
      if (entry.unstaged && !stagedOnly) {
        const unstaged = await gitOrThrow(
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
      status: entry.untracked ? 'untracked' : statusFromDiff(rawDiff, path),
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
  const committedDiff = await gitOrThrow(
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
    const committedPart = await git(
      ['diff', '-U' + String(CONTEXT_LINES), `${base}...HEAD`, '--', path],
      repoRoot,
    );
    rawDiff = committedPart.stdout;

    if (includeUncommitted) {
      const staged = await git(
        ['diff', '-U' + String(CONTEXT_LINES), '--cached', '--', path],
        repoRoot,
      );
      const unstaged = await git(
        ['diff', '-U' + String(CONTEXT_LINES), '--', path],
        repoRoot,
      );
      const parts = [rawDiff, staged.stdout, unstaged.stdout].filter(Boolean);
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
      status: statusFromDiff(rawDiff, path),
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
  const files =
    mode.kind === 'uncommitted'
      ? await getUncommittedFiles(repoRoot, mode.stagedOnly)
      : await getBaseDiffFiles(repoRoot, mode.base, mode.includeUncommitted);

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

  let content: string;
  if (revision.ref === null) {
    try {
      content = readFileSync(join(repoRoot, revision.path), 'utf8');
    } catch {
      return [];
    }
  } else {
    try {
      content = await gitOrThrow(
        ['show', `${revision.ref}:${revision.path}`],
        repoRoot,
      );
    } catch {
      return [];
    }
  }

  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.slice(startLine - 1, endLine);
}

export { CONTEXT_LINES };

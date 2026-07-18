import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { DisplayLine } from '../diff/types.js';
import type { DiffMode } from '../git/types.js';
import type { LineTarget, ReviewComment, ReviewSession } from './types.js';

export function reviewConfigDir(home = homedir()): string {
  return join(home, '.config', 'diffy');
}

/** Sanitize branch for filenames: replace path separators and unsafe chars. */
export function sanitizeBranch(branch: string): string {
  return branch.replace(/[/\\:]+/g, '-').replace(/[^\w.-]+/g, '_') || 'unknown';
}

/** Local timestamp for review ids: `YYYY-MM-DD-HHMM`. */
export function todayDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${hh}${mm}`;
}

export function reviewBasename(branch: string, date: string): string {
  return `review-${sanitizeBranch(branch)}-${date}.json`;
}

export function reviewFilePath(
  branch: string,
  date: string,
  home = homedir(),
): string {
  return join(reviewConfigDir(home), reviewBasename(branch, date));
}

/**
 * Resolve a --resume argument to an absolute path.
 * Accepts absolute paths, basenames, or names without .json.
 */
export function resolveResumePath(
  resume: string | true,
  branch: string,
  date: string,
  home = homedir(),
): string {
  if (resume === true) {
    return reviewFilePath(branch, date, home);
  }
  if (isAbsolute(resume)) {
    return resume;
  }
  const name = resume.endsWith('.json') ? resume : `${resume}.json`;
  return join(reviewConfigDir(home), name);
}

export function emptySession(
  repoRoot: string,
  branch: string,
  date: string,
  mode?: DiffMode,
): ReviewSession {
  return {
    version: 1,
    repoRoot,
    branch,
    date,
    mode,
    comments: [],
  };
}

export function commentKey(
  path: string,
  side: ReviewComment['side'],
  line: number,
): string {
  return `${path}\0${side}\0${line}`;
}

export function findComment(
  session: ReviewSession,
  path: string,
  side: ReviewComment['side'],
  line: number,
): ReviewComment | undefined {
  return session.comments.find(
    (c) => c.path === path && c.side === side && c.line === line,
  );
}

export function resolveLineTarget(line: DisplayLine): LineTarget | null {
  if (
    line.kind !== 'add' &&
    line.kind !== 'delete' &&
    line.kind !== 'context' &&
    line.kind !== 'expanded-context'
  ) {
    return null;
  }

  if (line.kind === 'delete') {
    if (line.oldLineNo === undefined) return null;
    return { side: 'old', line: line.oldLineNo, snippet: line.content };
  }

  if (line.kind === 'add') {
    if (line.newLineNo === undefined) return null;
    return { side: 'new', line: line.newLineNo, snippet: line.content };
  }

  // Unchanged context: not an add or delete — label as context for agents.
  // Prefer the new-file line number (current file); keep old as otherLine when it differs.
  if (line.newLineNo !== undefined) {
    const other =
      line.oldLineNo !== undefined && line.oldLineNo !== line.newLineNo
        ? line.oldLineNo
        : undefined;
    return {
      side: 'context',
      line: line.newLineNo,
      snippet: line.content,
      ...(other !== undefined ? { otherLine: other } : {}),
    };
  }
  if (line.oldLineNo !== undefined) {
    return { side: 'context', line: line.oldLineNo, snippet: line.content };
  }
  return null;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Upsert a comment; empty body removes it. Returns a new session. */
export function upsertComment(
  session: ReviewSession,
  input: {
    path: string;
    side: ReviewComment['side'];
    line: number;
    body: string;
    snippet: string;
    otherLine?: number;
    now?: Date;
  },
): ReviewSession {
  const body = input.body.trim();
  const without = session.comments.filter(
    (c) =>
      !(c.path === input.path && c.side === input.side && c.line === input.line),
  );

  if (!body) {
    return { ...session, comments: without };
  }

  const existing = findComment(session, input.path, input.side, input.line);
  const updatedAt = (input.now ?? new Date()).toISOString();
  const comment: ReviewComment = {
    id: existing?.id ?? newId(),
    path: input.path,
    side: input.side,
    line: input.line,
    body,
    snippet: input.snippet,
    updatedAt,
    ...(input.otherLine !== undefined ? { otherLine: input.otherLine } : {}),
  };

  return { ...session, comments: [...without, comment] };
}

export async function loadSession(path: string): Promise<ReviewSession | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as ReviewSession;
    if (parsed.version !== 1 || !Array.isArray(parsed.comments)) {
      return null;
    }
    return parsed;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveSession(
  path: string,
  session: ReviewSession,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

/**
 * Persist only when there are comments; remove the cache file if empty.
 * No review file is created until the first comment is saved.
 */
export async function persistSession(
  path: string,
  session: ReviewSession,
): Promise<void> {
  if (session.comments.length === 0) {
    try {
      await unlink(path);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'ENOENT') throw err;
    }
    return;
  }
  await saveSession(path, session);
}

/**
 * Latest saved review for this repo (by filename timestamp), or null.
 */
export async function findLatestReviewPath(
  repoRoot: string,
  home = homedir(),
): Promise<string | null> {
  const dir = reviewConfigDir(home);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return null;
    throw err;
  }

  const candidates = names
    .filter((n) => n.startsWith('review-') && n.endsWith('.json'))
    .sort()
    .reverse();

  for (const name of candidates) {
    const path = join(dir, name);
    const session = await loadSession(path);
    if (session && session.repoRoot === repoRoot) {
      return path;
    }
  }
  return null;
}

/**
 * Open or create a review session.
 * Fresh start: new `review-<branch>-<YYYY-MM-DD-HHMM>.json`.
 * `--resume` with no name: latest review for this repo.
 * `--resume <name>`: that file (force-load even if repoRoot differs).
 */
export async function openOrCreateSession(opts: {
  repoRoot: string;
  branch: string;
  date: string;
  mode?: DiffMode;
  resume?: string | true;
  home?: string;
}): Promise<{ session: ReviewSession; path: string }> {
  const home = opts.home ?? homedir();

  if (opts.resume === true) {
    const latest = await findLatestReviewPath(opts.repoRoot, home);
    if (latest) {
      const existing = await loadSession(latest);
      if (existing) {
        return {
          session: {
            ...existing,
            mode: opts.mode ?? existing.mode,
          },
          path: latest,
        };
      }
    }
  }

  const path =
    opts.resume !== undefined && opts.resume !== true
      ? resolveResumePath(opts.resume, opts.branch, opts.date, home)
      : reviewFilePath(opts.branch, opts.date, home);

  const existing = await loadSession(path);
  if (existing && existing.repoRoot === opts.repoRoot) {
    return {
      session: {
        ...existing,
        mode: opts.mode ?? existing.mode,
      },
      path,
    };
  }

  // Explicit --resume <name> with mismatched repo: still load if present.
  if (existing && opts.resume !== undefined && opts.resume !== true) {
    return { session: existing, path };
  }

  return {
    session: emptySession(opts.repoRoot, opts.branch, opts.date, opts.mode),
    path,
  };
}

/** Set of "side:line" keys for a given file path (for gutter markers). */
export function commentedLineKeysForPath(
  session: ReviewSession,
  path: string,
): Set<string> {
  const keys = new Set<string>();
  for (const c of session.comments) {
    if (c.path === path) {
      keys.add(`${c.side}:${c.line}`);
    }
  }
  return keys;
}

export function displayLineCommentKey(line: DisplayLine): string | null {
  const target = resolveLineTarget(line);
  if (!target) return null;
  return `${target.side}:${target.line}`;
}

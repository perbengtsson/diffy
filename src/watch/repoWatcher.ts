import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'target',
  'vendor',
  '.cache',
]);

function shouldIgnore(relativePath: string | null): boolean {
  if (!relativePath) return false;
  const parts = relativePath.split(/[/\\]/);
  return parts.some((part) => IGNORED_DIR_NAMES.has(part));
}

export type RepoWatcherOptions = {
  debounceMs?: number;
};

export function watchRepo(
  repoRoot: string,
  onChange: () => void,
  options: RepoWatcherOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? 400;
  const watchers: FSWatcher[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!disposed) onChange();
    }, debounceMs);
  };

  const onTreeEvent = (_event: string, filename: string | null) => {
    if (shouldIgnore(filename)) return;
    schedule();
  };

  try {
    watchers.push(watch(repoRoot, { recursive: true }, onTreeEvent));
  } catch {
    // recursive watch unsupported — git metadata watches still catch stage/commit
  }

  for (const rel of ['.git/index', '.git/HEAD', '.git/logs/HEAD']) {
    try {
      watchers.push(watch(join(repoRoot, rel), schedule));
    } catch {
      // ignore missing paths in edge-case repos
    }
  }

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    for (const w of watchers) w.close();
  };
}

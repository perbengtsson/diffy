import {
  readdirSync,
  statSync,
  watch,
  type FSWatcher,
} from 'node:fs';
import { join, relative } from 'node:path';

export const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'target',
  'vendor',
  '.cache',
]);

/** True if any path segment is a known heavy/irrelevant directory. */
export function shouldIgnorePath(relativePath: string | null | undefined): boolean {
  if (!relativePath) return false;
  const parts = relativePath.split(/[/\\]/).filter(Boolean);
  return parts.some((part) => IGNORED_DIR_NAMES.has(part));
}

/**
 * Directories that should get an inotify/fs watch.
 * Skips ignored names entirely so their subtrees are never registered.
 */
export function listWatchDirs(repoRoot: string): string[] {
  const dirs: string[] = [];

  const walk = (absDir: string) => {
    dirs.push(absDir);
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      walk(join(absDir, entry.name));
    }
  };

  walk(repoRoot);
  return dirs;
}

export type RepoWatcherOptions = {
  debounceMs?: number;
};

/**
 * On Linux, recursive fs.watch registers one inotify watch per directory and
 * callback-only ignores do not skip registration. Walk the tree and watch
 * only non-ignored directories. On other platforms, one recursive watch is cheap.
 */
function useSelectiveDirWatches(): boolean {
  return process.platform === 'linux';
}

export function watchRepo(
  repoRoot: string,
  onChange: () => void,
  options: RepoWatcherOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? 400;
  const watchers = new Map<string, FSWatcher>();
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

  const track = (key: string, watcher: FSWatcher) => {
    watchers.set(key, watcher);
    watcher.on('error', () => {
      watchers.delete(key);
      try {
        watcher.close();
      } catch {
        // already closed
      }
    });
  };

  const watchDir = (absDir: string) => {
    if (disposed || watchers.has(absDir)) return;
    const rel = relative(repoRoot, absDir);
    if (rel && shouldIgnorePath(rel)) return;

    let watcher: FSWatcher;
    try {
      watcher = watch(absDir, (_event, filename) => {
        if (disposed) return;
        if (filename) {
          const childRel = rel ? join(rel, filename) : filename;
          if (shouldIgnorePath(childRel)) return;

          const childAbs = join(absDir, filename);
          try {
            if (statSync(childAbs).isDirectory()) {
              watchTree(childAbs);
            }
          } catch {
            // deleted or not a directory
          }
        }
        schedule();
      });
    } catch {
      return;
    }
    track(absDir, watcher);
  };

  const watchTree = (absDir: string) => {
    for (const dir of listWatchDirs(absDir)) {
      watchDir(dir);
    }
  };

  if (useSelectiveDirWatches()) {
    watchTree(repoRoot);
  } else {
    try {
      const watcher = watch(repoRoot, { recursive: true }, (_event, filename) => {
        if (shouldIgnorePath(filename)) return;
        schedule();
      });
      track(repoRoot, watcher);
    } catch {
      // recursive watch unsupported — git metadata watches still catch stage/commit
    }
  }

  for (const rel of ['.git/index', '.git/HEAD', '.git/logs/HEAD']) {
    const abs = join(repoRoot, rel);
    if (watchers.has(abs)) continue;
    try {
      track(abs, watch(abs, schedule));
    } catch {
      // ignore missing paths in edge-case repos
    }
  }

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    for (const watcher of watchers.values()) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }
    watchers.clear();
  };
}

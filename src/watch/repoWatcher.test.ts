import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  listGitRefWatchDirs,
  listWatchDirs,
  shouldIgnorePath,
  watchRepo,
} from './repoWatcher.js';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()!;
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'diffy-watch-'));
  tempRoots.push(root);
  return root;
}

describe('shouldIgnorePath', () => {
  it('ignores known heavy directory segments', () => {
    assert.equal(shouldIgnorePath('node_modules/leftpad/index.js'), true);
    assert.equal(shouldIgnorePath('src/.git/config'), true);
    assert.equal(shouldIgnorePath('apps/web/.next/cache'), true);
    assert.equal(shouldIgnorePath('target/debug/foo'), true);
  });

  it('allows normal source paths', () => {
    assert.equal(shouldIgnorePath('src/watch/repoWatcher.ts'), false);
    assert.equal(shouldIgnorePath(null), false);
    assert.equal(shouldIgnorePath(''), false);
  });
});

describe('listWatchDirs', () => {
  it('includes nested source dirs and skips ignored trees', () => {
    const root = tempRepo();
    mkdirSync(join(root, 'src', 'watch'), { recursive: true });
    mkdirSync(join(root, 'node_modules', 'pkg', 'lib'), { recursive: true });
    mkdirSync(join(root, 'dist', 'out'), { recursive: true });
    mkdirSync(join(root, '.git', 'objects'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), '');
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), '');

    const dirs = listWatchDirs(root).map((d) => d.slice(root.length) || '/');
    assert.deepEqual(dirs.sort(), ['/', '/src', '/src/watch'].sort());
  });
});

describe('listGitRefWatchDirs', () => {
  it('includes nested refs and remotes dirs', () => {
    const root = tempRepo();
    mkdirSync(join(root, '.git', 'refs', 'remotes', 'origin'), {
      recursive: true,
    });
    mkdirSync(join(root, '.git', 'logs', 'refs', 'heads'), { recursive: true });
    writeFileSync(join(root, '.git', 'refs', 'remotes', 'origin', 'main'), 'abc\n');

    const dirs = listGitRefWatchDirs(root).map((d) => d.slice(root.length));
    assert.ok(dirs.includes('/.git/refs'));
    assert.ok(dirs.includes('/.git/refs/remotes'));
    assert.ok(dirs.includes('/.git/refs/remotes/origin'));
    assert.ok(dirs.includes('/.git/logs/refs'));
    assert.ok(dirs.includes('/.git/logs/refs/heads'));
  });
});

describe('watchRepo', () => {
  it('notifies on source edits and ignores node_modules', async () => {
    const root = tempRepo();
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), '1');
    writeFileSync(join(root, 'node_modules', 'pkg', 'b.js'), '1');
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(root, '.git', 'index'), '');

    let hits = 0;
    const stop = watchRepo(root, () => {
      hits += 1;
    }, { debounceMs: 50 });

    try {
      writeFileSync(join(root, 'node_modules', 'pkg', 'b.js'), '2');
      await delay(120);
      assert.equal(hits, 0, 'node_modules edits must not refresh');

      writeFileSync(join(root, 'src', 'a.ts'), '2');
      await delay(120);
      assert.equal(hits, 1, 'source edits must refresh');
    } finally {
      stop();
    }
  });

  it('notifies when a remote-tracking base ref updates', async () => {
    const root = tempRepo();
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, '.git', 'refs', 'remotes', 'origin'), {
      recursive: true,
    });
    writeFileSync(join(root, 'src', 'a.ts'), '1');
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/feature\n');
    writeFileSync(join(root, '.git', 'index'), '');
    writeFileSync(
      join(root, '.git', 'refs', 'remotes', 'origin', 'main'),
      'aaa\n',
    );

    let hits = 0;
    const stop = watchRepo(root, () => {
      hits += 1;
    }, { debounceMs: 50 });

    try {
      writeFileSync(
        join(root, '.git', 'refs', 'remotes', 'origin', 'main'),
        'bbb\n',
      );
      await delay(120);
      assert.equal(hits, 1, 'origin/main updates must refresh --base diffs');
    } finally {
      stop();
    }
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

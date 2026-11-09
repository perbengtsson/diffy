import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { promisify } from 'node:util';
import { buildDisplayLines } from '../diff/expand.js';
import { loadDiffSnapshot, looksBinary } from './diff.js';

const execFileAsync = promisify(execFile);

describe('looksBinary', () => {
  it('returns false for plain text', () => {
    assert.equal(looksBinary(Buffer.from('hello\nworld\n', 'utf8')), false);
  });

  it('returns true when a NUL appears in the first 8 KiB', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert.equal(looksBinary(buf), true);
  });

  it('ignores NULs beyond the 8 KiB probe window', () => {
    const buf = Buffer.alloc(8001, 0x41);
    buf[8000] = 0;
    assert.equal(looksBinary(buf), false);
  });
});

describe('include-uncommitted nets removed additions (#10)', () => {
  const dirs: string[] = [];
  after(async () => {
    await Promise.all(
      dirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function git(cwd: string, args: string[]): Promise<void> {
    await execFileAsync('git', args, { cwd });
  }

  async function fixtureRepo(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-issue10-'));
    dirs.push(dir);
    await git(dir, ['init']);
    await git(dir, ['config', 'user.email', 'diffy@test']);
    await git(dir, ['config', 'user.name', 'Diffy Test']);
    // Default branch name varies by git version; force main.
    await git(dir, ['checkout', '-b', 'main']);
    await writeFile(join(dir, 'file.txt'), 'alpha\nbeta\n', 'utf8');
    await git(dir, ['add', 'file.txt']);
    await git(dir, ['commit', '-m', 'base']);
    await git(dir, ['checkout', '-b', 'feature']);
    await writeFile(join(dir, 'file.txt'), 'alpha\nadded\nbeta\n', 'utf8');
    await git(dir, ['add', 'file.txt']);
    await git(dir, ['commit', '-m', 'add line']);
    return dir;
  }

  it('hides a committed addition that uncommitted edits removed', async () => {
    const dir = await fixtureRepo();
    // Undo the committed addition in the working tree.
    await writeFile(join(dir, 'file.txt'), 'alpha\nbeta\n', 'utf8');

    const snap = await loadDiffSnapshot(dir, {
      kind: 'base',
      base: 'main',
      includeUncommitted: true,
    });
    const file = snap.files.find((f) => f.path === 'file.txt');
    assert.ok(file);
    // Net of branch + worktree vs main: no change.
    assert.equal(file.status, 'unchanged');
    assert.equal(file.additions, 0);
    assert.equal(file.deletions, 0);

    const lines = await buildDisplayLines(file, snap.mode, snap.repoRoot);
    assert.equal(
      lines.some((l) => l.kind === 'add' && l.content === 'added'),
      false,
    );
    assert.equal(
      lines.some((l) => l.kind === 'delete' && l.content === 'added'),
      false,
    );
  });

  it('still shows the addition without --include-uncommitted', async () => {
    const dir = await fixtureRepo();
    await writeFile(join(dir, 'file.txt'), 'alpha\nbeta\n', 'utf8');

    const snap = await loadDiffSnapshot(dir, {
      kind: 'base',
      base: 'main',
      includeUncommitted: false,
    });
    const file = snap.files.find((f) => f.path === 'file.txt');
    assert.ok(file);
    assert.equal(file.status, 'modified');
    assert.ok(file.additions >= 1);

    const lines = await buildDisplayLines(file, snap.mode, snap.repoRoot);
    assert.equal(
      lines.some((l) => l.kind === 'add' && l.content === 'added'),
      true,
    );
  });

  it('keeps additions that remain in the working tree', async () => {
    const dir = await fixtureRepo();
    await writeFile(join(dir, 'file.txt'), 'alpha\nadded\nextra\nbeta\n', 'utf8');

    const snap = await loadDiffSnapshot(dir, {
      kind: 'base',
      base: 'main',
      includeUncommitted: true,
    });
    const file = snap.files.find((f) => f.path === 'file.txt');
    assert.ok(file);
    assert.equal(file.status, 'modified');

    const lines = await buildDisplayLines(file, snap.mode, snap.repoRoot);
    assert.equal(
      lines.some((l) => l.kind === 'add' && l.content === 'added'),
      true,
    );
    assert.equal(
      lines.some((l) => l.kind === 'add' && l.content === 'extra'),
      true,
    );
  });

  it('nets staged add + unstaged remove in uncommitted mode', async () => {
    const dir = await fixtureRepo();
    // Reset feature commit so HEAD matches main, then stage an add and undo it.
    await git(dir, ['checkout', 'main']);
    await writeFile(join(dir, 'file.txt'), 'alpha\nstaged\nbeta\n', 'utf8');
    await git(dir, ['add', 'file.txt']);
    await writeFile(join(dir, 'file.txt'), 'alpha\nbeta\n', 'utf8');

    const snap = await loadDiffSnapshot(dir, {
      kind: 'uncommitted',
      stagedOnly: false,
    });
    const file = snap.files.find((f) => f.path === 'file.txt');
    // Worktree matches HEAD — no net change.
    assert.ok(!file || file.status === 'unchanged');
  });

  it('clears --base diff after feature is merged into base', async () => {
    const dir = await fixtureRepo();
    const before = await loadDiffSnapshot(dir, {
      kind: 'base',
      base: 'main',
      includeUncommitted: false,
    });
    assert.equal(
      before.files.find((f) => f.path === 'file.txt')?.status,
      'modified',
    );

    // Merge feature into main (base catches up) while staying on feature.
    await git(dir, ['checkout', 'main']);
    await git(dir, ['merge', 'feature', '-m', 'merge feature']);
    await git(dir, ['checkout', 'feature']);

    const after = await loadDiffSnapshot(dir, {
      kind: 'base',
      base: 'main',
      includeUncommitted: false,
    });
    const file = after.files.find((f) => f.path === 'file.txt');
    assert.ok(!file || file.status === 'unchanged');
  });
});

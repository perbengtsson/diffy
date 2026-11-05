import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { DiffFile, DiffMode } from '../git/types.js';
import { buildDisplayLines } from './expand.js';

const mode: DiffMode = { kind: 'uncommitted', stagedOnly: false };

function unchangedFile(path: string, isBinary = false): DiffFile {
  return {
    path,
    status: 'unchanged',
    additions: 0,
    deletions: 0,
    rawDiff: '',
    isBinary,
  };
}

describe('buildDisplayLines binary handling', () => {
  const dirs: string[] = [];
  after(async () => {
    await Promise.all(
      dirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('returns the binary placeholder when isBinary is set', async () => {
    const lines = await buildDisplayLines(
      unchangedFile('x.bin', true),
      mode,
      '/tmp',
    );
    assert.deepEqual(lines, [
      { kind: 'binary', content: 'Binary file — no diff preview' },
    ]);
  });

  it('detects binary content even when isBinary is false', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-binary-'));
    dirs.push(dir);
    const path = 'fixture.bin';
    await writeFile(
      join(dir, path),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]),
    );

    const lines = await buildDisplayLines(unchangedFile(path, false), mode, dir);
    assert.deepEqual(lines, [
      { kind: 'binary', content: 'Binary file — no diff preview' },
    ]);
  });

  it('still shows text for a normal unchanged file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'diffy-text-'));
    dirs.push(dir);
    const path = 'hello.txt';
    await writeFile(join(dir, path), 'alpha\nbeta\n', 'utf8');

    const lines = await buildDisplayLines(unchangedFile(path, false), mode, dir);
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.kind, 'context');
    assert.equal(lines[0]?.content, 'alpha');
    assert.equal(lines[1]?.content, 'beta');
  });
});

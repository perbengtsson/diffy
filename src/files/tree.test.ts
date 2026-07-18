import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiffFile } from '../git/types.js';
import { buildFileTree, flattenFilesInTreeOrder } from './tree.js';

function file(path: string): DiffFile {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    rawDiff: '',
    isBinary: false,
  };
}

describe('flattenFilesInTreeOrder', () => {
  it('matches dirs-first tree order, not flat path sort', () => {
    // Flat path sort: a.ts, nested/b.ts, z.ts
    // Tree (dirs first under root): nested/b.ts, a.ts, z.ts
    const files = [file('z.ts'), file('a.ts'), file('nested/b.ts')];
    const ordered = flattenFilesInTreeOrder(buildFileTree(files));
    assert.deepEqual(
      ordered.map((f) => f.path),
      ['nested/b.ts', 'a.ts', 'z.ts'],
    );
  });
});

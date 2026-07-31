import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiffFile } from '../git/types.js';
import {
  buildAncestorDirs,
  buildFileTree,
  buildInitialCollapsedDirs,
  flattenFilesInTreeOrder,
  refreshCollapsedDirs,
} from './tree.js';

function file(path: string, status: DiffFile['status'] = 'modified'): DiffFile {
  return {
    path,
    status,
    additions: status === 'unchanged' ? 0 : 1,
    deletions: 0,
    rawDiff: '',
    isBinary: false,
  };
}

describe('buildAncestorDirs', () => {
  it('collects parent directories for each path', () => {
    const dirs = buildAncestorDirs(['src/a.ts', 'src/nested/b.ts', 'root.ts']);
    assert.deepEqual([...dirs].sort(), ['src', 'src/nested']);
  });
});

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

describe('refreshCollapsedDirs', () => {
  it('expands dirs that newly contain edits after refresh', () => {
    const before = [
      file('src/a.ts', 'unchanged'),
      file('src/nested/b.ts', 'unchanged'),
      file('lib/c.ts', 'modified'),
    ];
    const collapsed = buildInitialCollapsedDirs(before);
    assert.ok(collapsed.has('src'));
    assert.ok(collapsed.has('src/nested'));
    assert.ok(!collapsed.has('lib'));

    const after = [
      file('src/a.ts', 'unchanged'),
      file('src/nested/b.ts', 'modified'),
      file('lib/c.ts', 'modified'),
    ];
    const next = refreshCollapsedDirs(collapsed, after);
    assert.ok(!next.has('src'));
    assert.ok(!next.has('src/nested'));
    assert.ok(!next.has('lib'));
  });

  it('prunes dirs that no longer exist', () => {
    const collapsed = new Set(['gone', 'src']);
    const files = [file('src/a.ts', 'unchanged')];
    const next = refreshCollapsedDirs(collapsed, files);
    assert.ok(!next.has('gone'));
    assert.ok(next.has('src'));
  });
});

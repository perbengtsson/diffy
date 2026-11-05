import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiffFile } from '../git/types.js';
import {
  buildAncestorDirs,
  buildDirEditStatuses,
  buildFileTree,
  buildInitialCollapsedDirs,
  findFirstEditedIndex,
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

describe('buildDirEditStatuses', () => {
  it('uses a shared status when all edited descendants match', () => {
    const statuses = buildDirEditStatuses([
      file('src/a.ts', 'added'),
      file('src/b.ts', 'added'),
      file('src/nested/c.ts', 'added'),
    ]);
    assert.equal(statuses.get('src'), 'added');
    assert.equal(statuses.get('src/nested'), 'added');
  });

  it('marks mixed-status directories as modified', () => {
    const statuses = buildDirEditStatuses([
      file('src/a.ts', 'added'),
      file('src/b.ts', 'deleted'),
    ]);
    assert.equal(statuses.get('src'), 'modified');
  });

  it('propagates nested conflicts to ancestors', () => {
    const statuses = buildDirEditStatuses([
      file('src/nested/a.ts', 'added'),
      file('src/nested/b.ts', 'modified'),
      file('lib/c.ts', 'deleted'),
    ]);
    assert.equal(statuses.get('src/nested'), 'modified');
    assert.equal(statuses.get('src'), 'modified');
    assert.equal(statuses.get('lib'), 'deleted');
  });

  it('ignores unchanged files and omits dirs with only unchanged children', () => {
    const statuses = buildDirEditStatuses([
      file('src/a.ts', 'unchanged'),
      file('src/nested/b.ts', 'unchanged'),
      file('lib/c.ts', 'modified'),
    ]);
    assert.equal(statuses.has('src'), false);
    assert.equal(statuses.has('src/nested'), false);
    assert.equal(statuses.get('lib'), 'modified');
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

describe('findFirstEditedIndex', () => {
  it('returns the first edited file index', () => {
    const files = [
      file('a.ts', 'unchanged'),
      file('b.ts', 'modified'),
      file('c.ts', 'added'),
    ];
    assert.equal(findFirstEditedIndex(files), 1);
  });

  it('returns -1 when there are no edits so startup does not open a folder', () => {
    const files = [
      file('src/a.ts', 'unchanged'),
      file('src/nested/b.ts', 'unchanged'),
    ];
    assert.equal(findFirstEditedIndex(files), -1);
  });
});

describe('buildInitialCollapsedDirs', () => {
  it('collapses every directory when there are no changes', () => {
    const files = [
      file('src/a.ts', 'unchanged'),
      file('src/nested/b.ts', 'unchanged'),
      file('lib/c.ts', 'unchanged'),
    ];
    const collapsed = buildInitialCollapsedDirs(files);
    assert.ok(collapsed.has('src'));
    assert.ok(collapsed.has('src/nested'));
    assert.ok(collapsed.has('lib'));
  });

  it('keeps directories that contain edits expanded', () => {
    const files = [
      file('src/a.ts', 'unchanged'),
      file('lib/c.ts', 'modified'),
    ];
    const collapsed = buildInitialCollapsedDirs(files);
    assert.ok(collapsed.has('src'));
    assert.ok(!collapsed.has('lib'));
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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiffFile } from '../git/types.js';
import type { DisplayLine } from './types.js';
import {
  changeBlockStarts,
  findNextAcrossFiles,
  findNextChangeBlock,
  findPrevAcrossFiles,
  findPrevChangeBlock,
  navigableFileIndex,
} from './changeBlocks.js';

function line(kind: DisplayLine['kind']): DisplayLine {
  return { kind, content: '' };
}

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

describe('changeBlockStarts', () => {
  it('returns empty when there are no changes', () => {
    assert.deepEqual(changeBlockStarts([line('context'), line('context')]), []);
  });

  it('treats contiguous add/delete runs as one block', () => {
    const lines = [
      line('context'),
      line('delete'),
      line('add'),
      line('context'),
      line('add'),
      line('add'),
    ];
    assert.deepEqual(changeBlockStarts(lines), [1, 4]);
  });

  it('starts a block at index 0', () => {
    assert.deepEqual(changeBlockStarts([line('add'), line('context')]), [0]);
  });
});

describe('findNextChangeBlock / findPrevChangeBlock', () => {
  const lines = [
    line('context'), // 0
    line('delete'), // 1 — block A
    line('add'), // 2
    line('context'), // 3
    line('add'), // 4 — block B
    line('context'), // 5
  ];

  it('jumps to the next block start', () => {
    assert.equal(findNextChangeBlock(lines, 0), 1);
    assert.equal(findNextChangeBlock(lines, 1), 4);
    assert.equal(findNextChangeBlock(lines, 2), 4);
    assert.equal(findNextChangeBlock(lines, 4), -1);
  });

  it('jumps to the previous block start (or current block start)', () => {
    assert.equal(findPrevChangeBlock(lines, 5), 4);
    assert.equal(findPrevChangeBlock(lines, 4), 1);
    assert.equal(findPrevChangeBlock(lines, 2), 1);
    assert.equal(findPrevChangeBlock(lines, 1), -1);
    assert.equal(findPrevChangeBlock(lines, 0), -1);
  });
});

describe('findNextAcrossFiles / findPrevAcrossFiles', () => {
  const files = [
    { filePath: 'a.ts', starts: [2, 10] },
    { filePath: 'b.ts', starts: [] },
    { filePath: 'c.ts', starts: [0, 5] },
  ];

  it('moves to the next file when the current file is exhausted', () => {
    assert.deepEqual(findNextAcrossFiles(files, 'a.ts', 10), {
      filePath: 'c.ts',
      lineIndex: 0,
    });
    assert.equal(findNextAcrossFiles(files, 'c.ts', 5), null);
  });

  it('moves to the previous file when at the first block', () => {
    assert.deepEqual(findPrevAcrossFiles(files, 'c.ts', 0), {
      filePath: 'a.ts',
      lineIndex: 10,
    });
    assert.equal(findPrevAcrossFiles(files, 'a.ts', 2), null);
  });

  it('starts from the first/last file when currentPath is null', () => {
    assert.deepEqual(findNextAcrossFiles(files, null, 0), {
      filePath: 'a.ts',
      lineIndex: 2,
    });
    assert.deepEqual(findPrevAcrossFiles(files, null, 0), {
      filePath: 'c.ts',
      lineIndex: 5,
    });
  });
});

describe('navigableFileIndex', () => {
  const all = [
    file('a.ts'),
    file('plain.ts', 'unchanged'),
    file('c.ts'),
  ];
  const navigable = [all[0]!, all[2]!];

  it('returns the direct index for edited files', () => {
    assert.equal(navigableFileIndex(all, navigable, 'c.ts'), 1);
  });

  it('returns the last navigable before an unchanged file', () => {
    assert.equal(navigableFileIndex(all, navigable, 'plain.ts'), 0);
  });
});

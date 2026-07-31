import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findMatchIndex } from './search.js';
import type { SearchMatch } from './types.js';

describe('findMatchIndex', () => {
  const matches: SearchMatch[] = [
    { filePath: 'a.ts', lineIndex: 2 },
    { filePath: 'a.ts', lineIndex: 10 },
    { filePath: 'b.ts', lineIndex: 2 },
  ];

  it('finds the match at the given file and line', () => {
    assert.equal(findMatchIndex(matches, 'a.ts', 10), 1);
    assert.equal(findMatchIndex(matches, 'b.ts', 2), 2);
  });

  it('returns -1 when no match exists', () => {
    assert.equal(findMatchIndex(matches, 'a.ts', 99), -1);
    assert.equal(findMatchIndex(matches, 'c.ts', 2), -1);
  });
});

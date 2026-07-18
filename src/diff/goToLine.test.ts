import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DisplayLine } from './types.js';
import { findDisplayLineIndexByNumber } from './goToLine.js';

function line(
  kind: DisplayLine['kind'],
  oldLineNo?: number,
  newLineNo?: number,
): DisplayLine {
  return { kind, content: '', oldLineNo, newLineNo };
}

describe('findDisplayLineIndexByNumber', () => {
  it('returns -1 for invalid or missing lines', () => {
    assert.equal(findDisplayLineIndexByNumber([], 1), -1);
    assert.equal(findDisplayLineIndexByNumber([line('context', 1, 1)], 0), -1);
    assert.equal(findDisplayLineIndexByNumber([line('context', 1, 1)], 99), -1);
  });

  it('prefers new-side matches over old-side', () => {
    const lines = [
      line('delete', 10),
      line('add', undefined, 10),
      line('context', 11, 11),
    ];
    assert.equal(findDisplayLineIndexByNumber(lines, 10), 1);
  });

  it('falls back to old-side when new is absent', () => {
    const lines = [line('delete', 42), line('context', 43, 40)];
    assert.equal(findDisplayLineIndexByNumber(lines, 42), 0);
  });

  it('matches context lines on either gutter', () => {
    const lines = [
      line('hunk-header'),
      line('context', 5, 5),
      line('add', undefined, 6),
    ];
    assert.equal(findDisplayLineIndexByNumber(lines, 5), 1);
    assert.equal(findDisplayLineIndexByNumber(lines, 6), 2);
  });
});

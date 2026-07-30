import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wordAtColumn } from './wordAt.js';

describe('wordAtColumn', () => {
  it('returns null for out-of-range columns', () => {
    assert.equal(wordAtColumn('foo', -1), null);
    assert.equal(wordAtColumn('foo', 3), null);
    assert.equal(wordAtColumn('', 0), null);
  });

  it('returns null on whitespace and punctuation', () => {
    assert.equal(wordAtColumn('a = b', 1), null);
    assert.equal(wordAtColumn('a = b', 2), null);
    assert.equal(wordAtColumn('foo.bar', 3), null);
  });

  it('selects the full word under the column', () => {
    assert.deepEqual(wordAtColumn('  helloWorld  ', 4), {
      word: 'helloWorld',
      start: 2,
      end: 12,
    });
    assert.deepEqual(wordAtColumn('foo_bar', 0), {
      word: 'foo_bar',
      start: 0,
      end: 7,
    });
    assert.deepEqual(wordAtColumn('$el', 0), {
      word: '$el',
      start: 0,
      end: 3,
    });
  });

  it('stops at punctuation boundaries', () => {
    assert.deepEqual(wordAtColumn('foo.bar', 5), {
      word: 'bar',
      start: 4,
      end: 7,
    });
  });
});

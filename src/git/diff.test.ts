import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksBinary } from './diff.js';

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

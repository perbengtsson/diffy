import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { centeredScrollOffset } from './scrollBar.js';

describe('centeredScrollOffset', () => {
  it('centers the line in the viewport when possible', () => {
    // viewport 10, line 50 → scroll so line is at row 5
    assert.equal(centeredScrollOffset(50, 10, 200), 45);
  });

  it('clamps near the top and bottom', () => {
    assert.equal(centeredScrollOffset(2, 10, 200), 0);
    assert.equal(centeredScrollOffset(195, 10, 200), 190);
  });

  it('returns 0 when content fits', () => {
    assert.equal(centeredScrollOffset(3, 20, 10), 0);
  });
});

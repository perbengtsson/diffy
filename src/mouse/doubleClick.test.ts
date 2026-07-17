import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_DOUBLE_CLICK, registerClick } from './doubleClick.js';

describe('registerClick', () => {
  it('first click is not a double', () => {
    const result = registerClick(EMPTY_DOUBLE_CLICK, 'a.ts', 1000, 400);
    assert.equal(result.isDouble, false);
    assert.equal(result.state.target, 'a.ts');
    assert.equal(result.state.at, 1000);
  });

  it('same target within window is a double', () => {
    const first = registerClick(EMPTY_DOUBLE_CLICK, 'a.ts', 1000, 400);
    const second = registerClick(first.state, 'a.ts', 1200, 400);
    assert.equal(second.isDouble, true);
    assert.equal(second.state.target, null);
  });

  it('different target is not a double', () => {
    const first = registerClick(EMPTY_DOUBLE_CLICK, 'a.ts', 1000, 400);
    const second = registerClick(first.state, 'b.ts', 1100, 400);
    assert.equal(second.isDouble, false);
    assert.equal(second.state.target, 'b.ts');
  });

  it('same target after window is not a double', () => {
    const first = registerClick(EMPTY_DOUBLE_CLICK, 'a.ts', 1000, 400);
    const second = registerClick(first.state, 'a.ts', 1500, 400);
    assert.equal(second.isDouble, false);
  });
});

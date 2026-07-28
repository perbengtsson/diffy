import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MIN_DIFF_PANE_WIDTH,
  MIN_FILE_PANE_WIDTH,
  clampFilePaneWidth,
  defaultFilePaneWidth,
  isSplitBorderHit,
} from './filePane.js';

describe('clampFilePaneWidth', () => {
  it('clamps to the minimum file pane width', () => {
    assert.equal(clampFilePaneWidth(5, 120), MIN_FILE_PANE_WIDTH);
  });

  it('leaves room for the diff pane', () => {
    assert.equal(clampFilePaneWidth(200, 80), 80 - MIN_DIFF_PANE_WIDTH);
  });

  it('rounds fractional widths', () => {
    assert.equal(clampFilePaneWidth(33.7, 120), 34);
  });
});

describe('defaultFilePaneWidth', () => {
  it('uses a wider default when the left picker is open', () => {
    const normal = defaultFilePaneWidth(120, false);
    const picker = defaultFilePaneWidth(120, true);
    assert.ok(picker >= normal);
    assert.ok(picker >= 40);
  });

  it('always leaves room for the diff pane', () => {
    const width = defaultFilePaneWidth(60, false);
    assert.ok(width + MIN_DIFF_PANE_WIDTH <= 60);
  });
});

describe('isSplitBorderHit', () => {
  it('hits the border column and slack neighbors', () => {
    assert.equal(isSplitBorderHit(30, 5, 30, 40), true);
    assert.equal(isSplitBorderHit(29, 5, 30, 40), true);
    assert.equal(isSplitBorderHit(31, 5, 30, 40), true);
  });

  it('misses far from the border or outside the content', () => {
    assert.equal(isSplitBorderHit(20, 5, 30, 40), false);
    assert.equal(isSplitBorderHit(30, 0, 30, 40), false);
    assert.equal(isSplitBorderHit(30, 41, 30, 40), false);
  });
});

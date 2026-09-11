import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWrapLayout,
  logicalLineAtVisualRow,
  resolveDiffWrapLayout,
  scrollToShowRange,
  sliceTokens,
  visualRowRangeForLine,
  wrappedRowCount,
  wrapSegmentOffset,
} from './wrap.js';

describe('wrappedRowCount', () => {
  it('counts full rows for long content', () => {
    assert.equal(wrappedRowCount(0, 10), 1);
    assert.equal(wrappedRowCount(10, 10), 1);
    assert.equal(wrappedRowCount(11, 10), 2);
    assert.equal(wrappedRowCount(25, 10), 3);
  });
});

describe('buildWrapLayout', () => {
  it('maps logical lines onto visual rows', () => {
    const layout = buildWrapLayout(
      [{ content: 'short' }, { content: 'a'.repeat(25) }, { content: '' }],
      10,
    );
    assert.deepEqual(layout.rowStarts, [0, 1, 4]);
    assert.equal(layout.totalRows, 5);
    assert.equal(logicalLineAtVisualRow(layout, 0), 0);
    assert.equal(logicalLineAtVisualRow(layout, 1), 1);
    assert.equal(logicalLineAtVisualRow(layout, 3), 1);
    assert.equal(logicalLineAtVisualRow(layout, 4), 2);
    assert.equal(logicalLineAtVisualRow(layout, 5), -1);
    assert.deepEqual(visualRowRangeForLine(layout, 1), { start: 1, end: 4 });
  });
});

describe('scrollToShowRange', () => {
  it('scrolls just enough to reveal the range', () => {
    assert.equal(scrollToShowRange(0, 8, 10, 5, 20), 5);
    assert.equal(scrollToShowRange(10, 2, 4, 5, 20), 2);
    assert.equal(scrollToShowRange(5, 6, 8, 5, 20), 5);
  });

  it('pins to the start when the range is taller than the viewport', () => {
    assert.equal(scrollToShowRange(0, 3, 20, 5, 30), 3);
  });
});

describe('sliceTokens', () => {
  it('slices across token boundaries', () => {
    const tokens = [
      { text: 'hello', className: 'a' },
      { text: 'world', className: 'b' },
    ];
    assert.deepEqual(sliceTokens(tokens, 3, 5), [
      { text: 'lo', className: 'a' },
      { text: 'wor', className: 'b' },
    ]);
  });
});

describe('wrapSegmentOffset', () => {
  it('returns the character offset for a wrap row', () => {
    assert.equal(wrapSegmentOffset(0, 10), 0);
    assert.equal(wrapSegmentOffset(2, 10), 20);
  });
});

describe('resolveDiffWrapLayout', () => {
  it('widens layout when the scrollbar appears', () => {
    const lines = Array.from({ length: 30 }, () => ({
      content: 'x'.repeat(40),
    }));
    const layout = resolveDiffWrapLayout(lines, 50, 10);
    assert.equal(layout.showScrollBar, true);
    assert.ok(layout.totalRows > 10);
    assert.ok(layout.contentWidth < 50 - 9);
  });

  it('keeps full width when content fits', () => {
    const layout = resolveDiffWrapLayout([{ content: 'hi' }], 50, 10);
    assert.equal(layout.showScrollBar, false);
    assert.equal(layout.totalRows, 1);
    assert.equal(layout.contentWidth, 41);
  });
});

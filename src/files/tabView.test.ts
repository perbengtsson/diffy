import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyTabView,
  pruneTabViews,
  recallTabView,
  rememberTabView,
} from './tabView.js';

describe('tabView', () => {
  it('recalls empty defaults for unknown paths', () => {
    const view = recallTabView(new Map(), 'a.ts');
    assert.deepEqual(view, emptyTabView());
  });

  it('remembers and recalls cursor and scroll', () => {
    let store = rememberTabView(new Map(), 'a.ts', {
      cursorLine: 12,
      diffScroll: 4,
    });

    const recalled = recallTabView(store, 'a.ts');
    assert.equal(recalled.cursorLine, 12);
    assert.equal(recalled.diffScroll, 4);
  });

  it('prunes views for closed tabs', () => {
    let store = rememberTabView(new Map(), 'a.ts', {
      cursorLine: 1,
      diffScroll: 0,
    });
    store = rememberTabView(store, 'b.ts', {
      cursorLine: 2,
      diffScroll: 0,
    });
    store = pruneTabViews(store, new Set(['b.ts']));
    assert.equal(store.has('a.ts'), false);
    assert.equal(store.has('b.ts'), true);
  });
});

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

  it('remembers and recalls cursor, scroll, and expansions', () => {
    const expansions = new Map([
      ['a.ts#0', { before: 3, after: 0 }],
    ]);
    let store = rememberTabView(new Map(), 'a.ts', {
      cursorLine: 12,
      diffScroll: 4,
      expansions,
    });
    expansions.set('a.ts#0', { before: 99, after: 99 });

    const recalled = recallTabView(store, 'a.ts');
    assert.equal(recalled.cursorLine, 12);
    assert.equal(recalled.diffScroll, 4);
    assert.deepEqual(recalled.expansions.get('a.ts#0'), { before: 3, after: 0 });
  });

  it('prunes views for closed tabs', () => {
    let store = rememberTabView(new Map(), 'a.ts', {
      cursorLine: 1,
      diffScroll: 0,
      expansions: new Map(),
    });
    store = rememberTabView(store, 'b.ts', {
      cursorLine: 2,
      diffScroll: 0,
      expansions: new Map(),
    });
    store = pruneTabViews(store, new Set(['b.ts']));
    assert.equal(store.has('a.ts'), false);
    assert.equal(store.has('b.ts'), true);
  });
});

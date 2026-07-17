import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_FILE_TABS,
  activate,
  activateRelative,
  close,
  pin,
  preview,
  prune,
  type FileTabsState,
} from './tabs.js';

describe('preview', () => {
  it('creates a preview tab and sets activePath', () => {
    const next = preview(EMPTY_FILE_TABS, 'a.ts');
    assert.deepEqual(next.tabs, [{ path: 'a.ts', pinned: false }]);
    assert.equal(next.activePath, 'a.ts');
  });

  it('keeps the preview leftmost when replacing', () => {
    let state = preview(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'a.ts');
    state = preview(state, 'b.ts');
    state = preview(state, 'c.ts');
    assert.deepEqual(state.tabs, [
      { path: 'c.ts', pinned: false },
      { path: 'a.ts', pinned: true },
    ]);
    assert.equal(state.activePath, 'c.ts');
  });

  it('inserts a new preview before existing pinned tabs', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = preview(state, 'c.ts');
    assert.deepEqual(state.tabs, [
      { path: 'c.ts', pinned: false },
      { path: 'a.ts', pinned: true },
      { path: 'b.ts', pinned: true },
    ]);
  });

  it('activates an already-pinned path without duplicating', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = preview(state, 'a.ts');
    assert.deepEqual(state.tabs, [{ path: 'a.ts', pinned: true }]);
    assert.equal(state.activePath, 'a.ts');
  });
});

describe('pin', () => {
  it('upgrades the preview in place', () => {
    let state = preview(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'a.ts');
    assert.deepEqual(state.tabs, [{ path: 'a.ts', pinned: true }]);
  });

  it('pins a new path when not present', () => {
    const state = pin(EMPTY_FILE_TABS, 'a.ts');
    assert.deepEqual(state.tabs, [{ path: 'a.ts', pinned: true }]);
    assert.equal(state.activePath, 'a.ts');
  });

  it('activate-only when already pinned', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = pin(state, 'a.ts');
    assert.deepEqual(state.tabs, [
      { path: 'a.ts', pinned: true },
      { path: 'b.ts', pinned: true },
    ]);
    assert.equal(state.activePath, 'a.ts');
  });
});

describe('activate', () => {
  it('sets activePath when tab exists', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = activate(state, 'a.ts');
    assert.equal(state.activePath, 'a.ts');
    assert.equal(state.tabs.length, 2);
  });

  it('is a no-op when path is not open', () => {
    const state = pin(EMPTY_FILE_TABS, 'a.ts');
    assert.deepEqual(activate(state, 'missing.ts'), state);
  });
});

describe('activateRelative', () => {
  it('moves right and left among tabs', () => {
    let state = preview(EMPTY_FILE_TABS, 'preview.ts');
    state = pin(state, 'a.ts');
    state = pin(state, 'b.ts');
    state = activate(state, 'preview.ts');
    state = activateRelative(state, 1);
    assert.equal(state.activePath, 'a.ts');
    state = activateRelative(state, 1);
    assert.equal(state.activePath, 'b.ts');
    state = activateRelative(state, -1);
    assert.equal(state.activePath, 'a.ts');
  });

  it('is a no-op at the edges', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = activate(state, 'a.ts');
    assert.deepEqual(activateRelative(state, -1), state);
    state = activate(state, 'b.ts');
    assert.deepEqual(activateRelative(state, 1), state);
  });
});

describe('close', () => {
  it('prefers the right neighbor', () => {
    let state: FileTabsState = {
      tabs: [
        { path: 'a.ts', pinned: true },
        { path: 'b.ts', pinned: true },
        { path: 'c.ts', pinned: true },
      ],
      activePath: 'b.ts',
    };
    state = close(state, 'b.ts');
    assert.deepEqual(
      state.tabs.map((t) => t.path),
      ['a.ts', 'c.ts'],
    );
    assert.equal(state.activePath, 'c.ts');
  });

  it('falls back to the left neighbor', () => {
    let state: FileTabsState = {
      tabs: [
        { path: 'a.ts', pinned: true },
        { path: 'b.ts', pinned: true },
      ],
      activePath: 'b.ts',
    };
    state = close(state, 'b.ts');
    assert.equal(state.activePath, 'a.ts');
  });

  it('clears activePath when closing the last tab', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = close(state);
    assert.deepEqual(state, EMPTY_FILE_TABS);
  });

  it('closes activePath when path omitted', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = activate(state, 'a.ts');
    state = close(state);
    assert.equal(state.activePath, 'b.ts');
  });
});

describe('prune', () => {
  it('removes missing paths and fixes active', () => {
    let state = pin(EMPTY_FILE_TABS, 'a.ts');
    state = pin(state, 'b.ts');
    state = pin(state, 'c.ts');
    state = activate(state, 'b.ts');
    state = prune(state, new Set(['a.ts', 'c.ts']));
    assert.deepEqual(
      state.tabs.map((t) => t.path),
      ['a.ts', 'c.ts'],
    );
    assert.equal(state.activePath, 'c.ts');
  });
});

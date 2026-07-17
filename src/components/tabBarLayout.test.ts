import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { basename, hitTestTab, layoutTabBar } from './tabBarLayout.js';

describe('basename', () => {
  it('returns the last path segment', () => {
    assert.equal(basename('src/app.tsx'), 'app.tsx');
    assert.equal(basename('README.md'), 'README.md');
  });
});

describe('layoutTabBar', () => {
  it('assigns non-overlapping ranges including close affordance', () => {
    const hits = layoutTabBar(
      [
        { path: 'a.ts', pinned: true },
        { path: 'b.ts', pinned: false },
      ],
      80,
    );
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.path, 'a.ts');
    assert.ok(hits[0]!.x1 <= hits[1]!.x0);
    assert.ok(hits[0]!.closeX0 >= hits[0]!.x0);
    assert.ok(hits[0]!.closeX1 <= hits[0]!.x1);
  });

  it('stops laying out once width is exhausted', () => {
    const hits = layoutTabBar(
      [
        { path: 'very-long-file-name-one.ts', pinned: true },
        { path: 'very-long-file-name-two.ts', pinned: true },
        { path: 'very-long-file-name-three.ts', pinned: true },
      ],
      20,
    );
    assert.ok(hits.length < 3);
  });
});

describe('hitTestTab', () => {
  it('detects label vs close', () => {
    const hits = layoutTabBar([{ path: 'a.ts', pinned: true }], 40);
    const tab = hits[0]!;
    assert.deepEqual(hitTestTab(hits, tab.x0), { path: 'a.ts', close: false });
    assert.deepEqual(hitTestTab(hits, tab.closeX0), { path: 'a.ts', close: true });
    assert.equal(hitTestTab(hits, tab.x1 + 1), null);
  });

  it('close width matches TabBar paint (PAD + label + PAD + ×)', () => {
    const hits = layoutTabBar([{ path: 'a.ts', pinned: true }], 40);
    const tab = hits[0]!;
    assert.equal(tab.closeX1 - tab.closeX0 + 1, 1);
    assert.equal(tab.x1 - tab.x0 + 1, 1 + tab.label.length + 1 + 1);
  });
});

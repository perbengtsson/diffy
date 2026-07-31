import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REPO_MODE_LABEL,
  hitTestRepoMode,
  repoModeHitRange,
} from '../components/RepoBar.js';

describe('repoModeHitRange', () => {
  it('returns null when the pane is too narrow', () => {
    assert.equal(repoModeHitRange(REPO_MODE_LABEL.length + 2), null);
  });

  it('right-aligns the mode label inside the content area', () => {
    const width = 40;
    const range = repoModeHitRange(width);
    assert.ok(range);
    assert.equal(range.x1 - range.x0 + 1, REPO_MODE_LABEL.length);
    assert.equal(range.x1, width - 3);
  });
});

describe('hitTestRepoMode', () => {
  it('hits only the mode label columns', () => {
    const width = 40;
    const range = repoModeHitRange(width);
    assert.ok(range);
    assert.equal(hitTestRepoMode(width, range.x0 - 1), false);
    assert.equal(hitTestRepoMode(width, range.x0), true);
    assert.equal(hitTestRepoMode(width, range.x1), true);
    assert.equal(hitTestRepoMode(width, range.x1 + 1), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileSummaryHeight } from '../components/FileSummary.js';
import type { ChangeSummary } from './summary.js';

function summary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    fileCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    byType: [],
    ...overrides,
  };
}

describe('fileSummaryHeight', () => {
  it('counts border + title + empty body', () => {
    assert.equal(fileSummaryHeight(summary()), 3);
  });

  it('counts border + title + totals + each visible type row', () => {
    assert.equal(
      fileSummaryHeight(
        summary({
          fileCount: 2,
          byType: [
            { label: 'ts', fileCount: 1, additions: 1, deletions: 0 },
            { label: 'tsx', fileCount: 1, additions: 2, deletions: 1 },
          ],
        }),
      ),
      5,
    );
  });

  it('includes the "+N more" row when types exceed maxTypeRows', () => {
    const byType = Array.from({ length: 7 }, (_, i) => ({
      label: `t${i}`,
      fileCount: 1,
      additions: i,
      deletions: 0,
    }));
    assert.equal(
      fileSummaryHeight(summary({ fileCount: 7, byType }), 5),
      3 + 5 + 1,
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FILE_LIST_ROW_CHROME,
  fitFileListRow,
  formatFileStatsSuffix,
  truncateName,
} from './fileListLayout.js';

describe('formatFileStatsSuffix', () => {
  it('formats additions and deletions without an extra gap', () => {
    assert.equal(formatFileStatsSuffix({ additions: 12, deletions: 3 }), ' +12-3');
  });

  it('omits zero sides', () => {
    assert.equal(formatFileStatsSuffix({ additions: 5, deletions: 0 }), ' +5');
    assert.equal(formatFileStatsSuffix({ additions: 0, deletions: 9 }), ' -9');
    assert.equal(formatFileStatsSuffix({ additions: 0, deletions: 0 }), '');
  });
});

describe('fitFileListRow', () => {
  it('keeps the full row within the pane width', () => {
    const width = 28;
    const fitted = fitFileListRow({
      width,
      depth: 2,
      treePrefix: '',
      label: 'very-long-component-name.tsx',
      stats: formatFileStatsSuffix({ additions: 128, deletions: 64 }),
    });
    const line =
      fitted.indent + fitted.treePrefix + fitted.label + fitted.stats;
    assert.ok(line.length <= width - FILE_LIST_ROW_CHROME);
  });

  it('drops stats before overflowing a narrow deep row', () => {
    const width = 22;
    const fitted = fitFileListRow({
      width,
      depth: 3,
      treePrefix: '',
      label: 'index.ts',
      stats: ' +9999-9999',
    });
    const line =
      fitted.indent + fitted.treePrefix + fitted.label + fitted.stats;
    assert.ok(line.length <= width - FILE_LIST_ROW_CHROME);
    assert.equal(fitted.stats, '');
  });
});

describe('truncateName', () => {
  it('prefixes an ellipsis when truncating', () => {
    assert.equal(truncateName('abcdef', 4), '…def');
  });
});

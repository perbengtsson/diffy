import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEditorArgs,
  buildEditorInvocation,
  parseEditorEnv,
  workingTreeLineForEdit,
} from './editorCommand.js';
import type { DisplayLine } from '../diff/types.js';

describe('parseEditorEnv', () => {
  it('defaults empty to nano', () => {
    assert.deepEqual(parseEditorEnv(''), { command: 'nano', prefixArgs: [] });
  });

  it('splits command and flags', () => {
    assert.deepEqual(parseEditorEnv('code --wait'), {
      command: 'code',
      prefixArgs: ['--wait'],
    });
  });
});

describe('buildEditorArgs', () => {
  it('uses nano +line -l file by default style', () => {
    assert.deepEqual(buildEditorArgs('nano', '/tmp/a.ts', 12), [
      '+12',
      '-l',
      '/tmp/a.ts',
    ]);
  });

  it('uses goto for vscode-family editors', () => {
    assert.deepEqual(buildEditorArgs('cursor', '/tmp/a.ts', 9), [
      '-g',
      '/tmp/a.ts:9',
    ]);
  });

  it('uses +line for vim', () => {
    assert.deepEqual(buildEditorArgs('nvim', '/tmp/a.ts', 3), ['+3', '/tmp/a.ts']);
  });

  it('omits line args when line is missing', () => {
    assert.deepEqual(buildEditorArgs('nano', '/tmp/a.ts'), ['/tmp/a.ts']);
  });

  it('keeps prefix args from EDITOR', () => {
    assert.deepEqual(
      buildEditorArgs('code', '/tmp/a.ts', 4, ['--wait']),
      ['--wait', '-g', '/tmp/a.ts:4'],
    );
  });
});

describe('workingTreeLineForEdit', () => {
  it('prefers new-side line numbers', () => {
    const line: DisplayLine = {
      kind: 'context',
      content: 'x',
      oldLineNo: 10,
      newLineNo: 12,
    };
    assert.equal(workingTreeLineForEdit(line), 12);
  });

  it('falls back to old-side for deletions', () => {
    const line: DisplayLine = {
      kind: 'delete',
      content: 'x',
      oldLineNo: 8,
    };
    assert.equal(workingTreeLineForEdit(line), 8);
  });

  it('returns undefined for headers', () => {
    assert.equal(
      workingTreeLineForEdit({ kind: 'hunk-header', content: '@@' }),
      undefined,
    );
  });
});

describe('buildEditorInvocation', () => {
  it('falls back to nano when env is empty', () => {
    assert.deepEqual(buildEditorInvocation('/repo/f.ts', 7, {}), {
      command: 'nano',
      args: ['+7', '-l', '/repo/f.ts'],
    });
  });

  it('prefers VISUAL over EDITOR', () => {
    assert.deepEqual(
      buildEditorInvocation('/repo/f.ts', 1, {
        VISUAL: 'nvim',
        EDITOR: 'nano',
      }),
      { command: 'nvim', args: ['+1', '/repo/f.ts'] },
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAgentFileRef } from './agentRef.js';

describe('formatAgentFileRef', () => {
  it('formats path with line', () => {
    assert.equal(formatAgentFileRef('src/app.tsx', 23), '@src/app.tsx:23');
  });

  it('formats path only', () => {
    assert.equal(formatAgentFileRef('myfolder/myfile'), '@myfolder/myfile');
  });
});

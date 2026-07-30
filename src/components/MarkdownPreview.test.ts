import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderMarkdownLines } from './MarkdownPreview.js';

describe('renderMarkdownLines', () => {
  it('renders a heading and paragraph onto multiple lines', () => {
    const lines = renderMarkdownLines('# Hello\n\nWorld', 40);
    assert.ok(lines.length >= 2);
    const plain = lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, '')).join('\n');
    assert.match(plain, /Hello/);
    assert.match(plain, /World/);
  });

  it('returns empty for empty content', () => {
    assert.deepEqual(renderMarkdownLines('', 40), []);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatTreeIconPrefix,
  resolveTreeIcon,
  treeIconPrefix,
} from './nerd.js';

describe('resolveTreeIcon', () => {
  it('prefers basename over extension for non-json specials', () => {
    const license = resolveTreeIcon({ name: 'LICENSE.md' });
    const plain = resolveTreeIcon({ name: 'notes.md' });
    assert.notEqual(license.glyph, plain.glyph);
    assert.notEqual(license.color, plain.color);
  });

  it('matches basenames case-insensitively', () => {
    const a = resolveTreeIcon({ name: 'Dockerfile' });
    const b = resolveTreeIcon({ name: 'dockerfile' });
    assert.deepEqual(a, b);
  });

  it('maps common extensions with distinct colors', () => {
    const ts = resolveTreeIcon({ name: 'app.tsx' });
    const py = resolveTreeIcon({ name: 'main.py' });
    const fallback = resolveTreeIcon({ name: 'mystery.xyzzy' });
    assert.equal(ts.glyph.length, 1);
    assert.equal(py.glyph.length, 1);
    assert.equal(fallback.glyph.length, 1);
    assert.notEqual(ts.glyph, py.glyph);
    assert.notEqual(ts.glyph, fallback.glyph);
    assert.notEqual(ts.color, py.color);
    assert.match(ts.color, /^#/);
    assert.match(py.color, /^#/);
  });

  it('treeIconPrefix is icon plus space (2 cells)', () => {
    const prefix = treeIconPrefix({ name: 'index.ts' });
    assert.equal(prefix.length, 2);
    assert.equal(prefix.endsWith(' '), true);
  });

  it('uses seti json (e60b) for all json files', () => {
    const setiJson = '\uE60B';
    for (const name of [
      'data.json',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'jsconfig.json',
      'config.jsonc',
    ]) {
      const icon = resolveTreeIcon({ name });
      assert.equal(icon.glyph, setiJson, name);
      assert.equal(formatTreeIconPrefix(icon.glyph), `${setiJson} `, name);
    }
  });
});

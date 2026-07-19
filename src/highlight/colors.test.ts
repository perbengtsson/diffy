import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classToColor,
  colorForClass,
  findHighlightSchema,
  matchHighlightClass,
  resolveHighlightColors,
  HIGHLIGHT_SCHEMAS,
  DEFAULT_HIGHLIGHT_SCHEMA_ID,
} from './colors.js';

describe('highlight schemas', () => {
  it('ships named schemas including default', () => {
    assert.equal(DEFAULT_HIGHLIGHT_SCHEMA_ID, 'default');
    assert.ok(HIGHLIGHT_SCHEMAS.length >= 4);
    assert.deepEqual(
      HIGHLIGHT_SCHEMAS.map((s) => s.id),
      ['default', 'monokai', 'github', 'muted', 'dracula'],
    );
  });

  it('falls back to default for unknown ids', () => {
    assert.equal(findHighlightSchema('nope').id, 'default');
  });

  it('matches innermost known hljs class', () => {
    assert.equal(
      matchHighlightClass(['hljs-keyword', 'hljs-string']),
      'hljs-string',
    );
    assert.equal(matchHighlightClass(['hljs-unknown']), undefined);
  });

  it('resolves different colors per schema in dark mode', () => {
    assert.equal(classToColor(['hljs-keyword'], 'default', false), 'magenta');
    assert.equal(classToColor(['hljs-keyword'], 'monokai', false), 'ansi256(197)');
    assert.equal(colorForClass('hljs-string', 'dracula', false), 'ansi256(228)');
    assert.equal(colorForClass(undefined, 'default', false), undefined);
  });

  it('uses darker tokens for light mode', () => {
    assert.equal(colorForClass('hljs-variable', 'default', true), 'black');
    assert.equal(colorForClass('hljs-variable', 'default', false), 'white');
    assert.equal(colorForClass('hljs-keyword', 'github', true), 'ansi256(124)');
    assert.equal(colorForClass('hljs-string', 'github', true), 'ansi256(28)');
    assert.notEqual(
      colorForClass('hljs-keyword', 'monokai', true),
      colorForClass('hljs-keyword', 'monokai', false),
    );
  });

  it('every schema has matching dark/light class keys', () => {
    for (const schema of HIGHLIGHT_SCHEMAS) {
      const dark = resolveHighlightColors(schema, false);
      const light = resolveHighlightColors(schema, true);
      assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
    }
  });
});

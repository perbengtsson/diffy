import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classToColor,
  colorForClass,
  findHighlightSchema,
  matchHighlightClass,
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

  it('resolves different colors per schema', () => {
    assert.equal(classToColor(['hljs-keyword'], 'default'), 'magenta');
    assert.equal(classToColor(['hljs-keyword'], 'monokai'), 'ansi256(197)');
    assert.equal(colorForClass('hljs-string', 'dracula'), 'ansi256(228)');
    assert.equal(colorForClass(undefined, 'default'), undefined);
  });
});

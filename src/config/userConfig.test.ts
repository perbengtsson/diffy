import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  defaultUserConfig,
  loadUserConfig,
  saveUserConfig,
  userConfigPath,
} from './userConfig.js';
import { DEFAULT_DIFF_BG_PALETTE_ID } from '../theme.js';
import { DEFAULT_HIGHLIGHT_SCHEMA_ID } from '../highlight/colors.js';

describe('userConfig', () => {
  it('defaults to slate bg and default syntax schema', () => {
    assert.deepEqual(defaultUserConfig(), {
      diffBgPaletteId: 'slate',
      highlightSchemaId: 'default',
    });
    assert.equal(DEFAULT_DIFF_BG_PALETTE_ID, 'slate');
    assert.equal(DEFAULT_HIGHLIGHT_SCHEMA_ID, 'default');
  });

  it('round-trips palette and schema ids under ~/.config/diffy', async () => {
    const home = await mkdtemp(join(tmpdir(), 'diffy-config-'));
    after(async () => {
      await rm(home, { recursive: true, force: true });
    });

    assert.deepEqual(await loadUserConfig(home), defaultUserConfig());

    await saveUserConfig(
      { diffBgPaletteId: 'moss', highlightSchemaId: 'monokai' },
      home,
    );
    assert.equal(
      userConfigPath(home),
      join(home, '.config', 'diffy', 'config.json'),
    );
    const raw = JSON.parse(await readFile(userConfigPath(home), 'utf8')) as {
      diffBgPaletteId: string;
      highlightSchemaId: string;
    };
    assert.equal(raw.diffBgPaletteId, 'moss');
    assert.equal(raw.highlightSchemaId, 'monokai');
    assert.deepEqual(await loadUserConfig(home), {
      diffBgPaletteId: 'moss',
      highlightSchemaId: 'monokai',
    });
  });

  it('falls back to defaults for unknown ids', async () => {
    const home = await mkdtemp(join(tmpdir(), 'diffy-config-'));
    after(async () => {
      await rm(home, { recursive: true, force: true });
    });

    await saveUserConfig(
      {
        diffBgPaletteId: 'not-a-real-palette',
        highlightSchemaId: 'not-a-real-schema',
      },
      home,
    );
    assert.deepEqual(await loadUserConfig(home), defaultUserConfig());
  });

  it('keeps known fields when the other is missing', async () => {
    const home = await mkdtemp(join(tmpdir(), 'diffy-config-'));
    after(async () => {
      await rm(home, { recursive: true, force: true });
    });

    const dir = join(home, '.config', 'diffy');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'config.json'),
      `${JSON.stringify({ diffBgPaletteId: 'github' }, null, 2)}\n`,
    );

    assert.deepEqual(await loadUserConfig(home), {
      diffBgPaletteId: 'github',
      highlightSchemaId: 'default',
    });
  });
});

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

describe('userConfig', () => {
  it('defaults to slate', () => {
    assert.equal(defaultUserConfig().diffBgPaletteId, 'slate');
    assert.equal(DEFAULT_DIFF_BG_PALETTE_ID, 'slate');
  });

  it('round-trips palette id under ~/.config/diffy', async () => {
    const home = await mkdtemp(join(tmpdir(), 'diffy-config-'));
    after(async () => {
      await rm(home, { recursive: true, force: true });
    });

    assert.deepEqual(await loadUserConfig(home), defaultUserConfig());

    await saveUserConfig({ diffBgPaletteId: 'moss' }, home);
    assert.equal(
      userConfigPath(home),
      join(home, '.config', 'diffy', 'config.json'),
    );
    const raw = JSON.parse(await readFile(userConfigPath(home), 'utf8')) as {
      diffBgPaletteId: string;
    };
    assert.equal(raw.diffBgPaletteId, 'moss');
    assert.deepEqual(await loadUserConfig(home), { diffBgPaletteId: 'moss' });
  });

  it('falls back to default for unknown palette ids', async () => {
    const home = await mkdtemp(join(tmpdir(), 'diffy-config-'));
    after(async () => {
      await rm(home, { recursive: true, force: true });
    });

    await saveUserConfig({ diffBgPaletteId: 'not-a-real-palette' }, home);
    assert.deepEqual(await loadUserConfig(home), defaultUserConfig());
  });
});

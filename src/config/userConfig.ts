import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { reviewConfigDir } from '../review/store.js';
import {
  DEFAULT_HIGHLIGHT_SCHEMA_ID,
  findHighlightSchema,
} from '../highlight/colors.js';
import {
  DEFAULT_DIFF_BG_PALETTE_ID,
  findDiffBgPalette,
} from '../theme.js';

export type UserConfig = {
  diffBgPaletteId: string;
  highlightSchemaId: string;
};

export function defaultUserConfig(): UserConfig {
  return {
    diffBgPaletteId: DEFAULT_DIFF_BG_PALETTE_ID,
    highlightSchemaId: DEFAULT_HIGHLIGHT_SCHEMA_ID,
  };
}

export function userConfigPath(home = homedir()): string {
  return join(reviewConfigDir(home), 'config.json');
}

function normalizeConfig(raw: unknown): UserConfig {
  const defaults = defaultUserConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;
  const diffBgPaletteId =
    typeof obj.diffBgPaletteId === 'string' && obj.diffBgPaletteId
      ? findDiffBgPalette(obj.diffBgPaletteId).id
      : defaults.diffBgPaletteId;
  const highlightSchemaId =
    typeof obj.highlightSchemaId === 'string' && obj.highlightSchemaId
      ? findHighlightSchema(obj.highlightSchemaId).id
      : defaults.highlightSchemaId;
  return { diffBgPaletteId, highlightSchemaId };
}

export async function loadUserConfig(home = homedir()): Promise<UserConfig> {
  try {
    const text = await readFile(userConfigPath(home), 'utf8');
    return normalizeConfig(JSON.parse(text) as unknown);
  } catch {
    return defaultUserConfig();
  }
}

export async function saveUserConfig(
  config: UserConfig,
  home = homedir(),
): Promise<void> {
  const normalized = normalizeConfig(config);
  const dir = reviewConfigDir(home);
  await mkdir(dir, { recursive: true });
  await writeFile(
    userConfigPath(home),
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf8',
  );
}

import chalk from 'chalk';

export type Theme = {
  addedFg: string;
  addedBg: string;
  removedFg: string;
  removedBg: string;
  contextFg: string;
  hunkHeaderFg: string;
  selectedBg: string;
  selectedFg: string;
  borderFg: string;
  statusFg: string;
  dimFg: string;
  defaultFg: string;
  /** Temporary tab label — gray / softer than pinned `defaultFg`. */
  tabPreviewFg: string;
};

export type DiffBgPair = { addedBg: string; removedBg: string };

export type DiffBgPalette = {
  id: string;
  label: string;
  blurb: string;
  dark: { truecolor: DiffBgPair; ansi256: DiffBgPair };
  light: { truecolor: DiffBgPair; ansi256: DiffBgPair };
};

/** Named alternatives for add/delete row backgrounds — pick via `b` in the app. */
export const DIFF_BG_PALETTES: DiffBgPalette[] = [
  {
    id: 'slate',
    label: 'Slate green / brick',
    blurb: 'Desaturated — less candy, more UI chrome',
    dark: {
      truecolor: { addedBg: 'rgb(32, 44, 36)', removedBg: 'rgb(48, 32, 32)' },
      ansi256: { addedBg: 'ansi256(236)', removedBg: 'ansi256(235)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(232, 238, 232)', removedBg: 'rgb(238, 232, 232)' },
      ansi256: { addedBg: 'ansi256(253)', removedBg: 'ansi256(255)' },
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'Original forest green / maroon',
    dark: {
      truecolor: { addedBg: 'rgb(24, 56, 24)', removedBg: 'rgb(56, 24, 24)' },
      ansi256: { addedBg: 'ansi256(22)', removedBg: 'ansi256(52)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(228, 240, 228)', removedBg: 'rgb(240, 228, 228)' },
      ansi256: { addedBg: 'ansi256(151)', removedBg: 'ansi256(210)' },
    },
  },
  {
    id: 'soft',
    label: 'Soft tint',
    blurb: 'Very muted — almost just a wash',
    dark: {
      truecolor: { addedBg: 'rgb(28, 40, 28)', removedBg: 'rgb(40, 28, 28)' },
      ansi256: { addedBg: 'ansi256(23)', removedBg: 'ansi256(52)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(236, 244, 236)', removedBg: 'rgb(244, 236, 236)' },
      ansi256: { addedBg: 'ansi256(194)', removedBg: 'ansi256(224)' },
    },
  },
  {
    id: 'moss',
    label: 'Moss / rose',
    blurb: 'Cooler green, slightly warmer red',
    dark: {
      truecolor: { addedBg: 'rgb(20, 48, 40)', removedBg: 'rgb(56, 28, 24)' },
      ansi256: { addedBg: 'ansi256(23)', removedBg: 'ansi256(88)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(220, 236, 228)', removedBg: 'rgb(244, 228, 224)' },
      ansi256: { addedBg: 'ansi256(151)', removedBg: 'ansi256(217)' },
    },
  },
  {
    id: 'github',
    label: 'GitHub-ish',
    blurb: 'Closer to GitHub dark/light diff wash',
    dark: {
      truecolor: { addedBg: 'rgb(18, 48, 33)', removedBg: 'rgb(61, 26, 26)' },
      ansi256: { addedBg: 'ansi256(22)', removedBg: 'ansi256(52)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(218, 251, 225)', removedBg: 'rgb(255, 235, 233)' },
      ansi256: { addedBg: 'ansi256(157)', removedBg: 'ansi256(224)' },
    },
  },
  {
    id: 'contrast',
    label: 'Higher contrast',
    blurb: 'Stronger blocks — easier to spot at a glance',
    dark: {
      truecolor: { addedBg: 'rgb(16, 64, 16)', removedBg: 'rgb(64, 16, 16)' },
      ansi256: { addedBg: 'ansi256(28)', removedBg: 'ansi256(88)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(200, 232, 200)', removedBg: 'rgb(236, 200, 200)' },
      ansi256: { addedBg: 'ansi256(114)', removedBg: 'ansi256(174)' },
    },
  },
  {
    id: 'deep',
    label: 'Deep ink',
    blurb: 'Darker, denser wash',
    dark: {
      truecolor: { addedBg: 'rgb(12, 36, 12)', removedBg: 'rgb(36, 12, 12)' },
      ansi256: { addedBg: 'ansi256(22)', removedBg: 'ansi256(52)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(210, 230, 210)', removedBg: 'rgb(230, 210, 210)' },
      ansi256: { addedBg: 'ansi256(151)', removedBg: 'ansi256(181)' },
    },
  },
  {
    id: 'neon-edge',
    label: 'Neon edge',
    blurb: 'Punchier — almost highlighter',
    dark: {
      truecolor: { addedBg: 'rgb(8, 72, 32)', removedBg: 'rgb(72, 16, 24)' },
      ansi256: { addedBg: 'ansi256(22)', removedBg: 'ansi256(88)' },
    },
    light: {
      truecolor: { addedBg: 'rgb(180, 245, 200)', removedBg: 'rgb(255, 200, 200)' },
      ansi256: { addedBg: 'ansi256(157)', removedBg: 'ansi256(217)' },
    },
  },
];

export const DEFAULT_DIFF_BG_PALETTE_ID = 'slate';

/** True when COLORFGBG reports a light background (indices 8–15). */
export function isLightTerminal(): boolean {
  const colorfgbg = process.env.COLORFGBG;
  if (!colorfgbg) return false;
  const parts = colorfgbg.split(';');
  const bg = Number.parseInt(parts[parts.length - 1] ?? '0', 10);
  return bg >= 8 && bg <= 15;
}

export function resolveDiffBackground(
  palette: DiffBgPalette,
  light = isLightTerminal(),
  level = chalk.level,
): DiffBgPair {
  const side = light ? palette.light : palette.dark;
  return level >= 3 ? side.truecolor : side.ansi256;
}

export function findDiffBgPalette(id: string): DiffBgPalette {
  const resolved = id === 'current' ? 'classic' : id;
  return (
    DIFF_BG_PALETTES.find((p) => p.id === resolved) ??
    DIFF_BG_PALETTES.find((p) => p.id === DEFAULT_DIFF_BG_PALETTE_ID) ??
    DIFF_BG_PALETTES[0]!
  );
}

export function getTheme(diffBgPaletteId: string = DEFAULT_DIFF_BG_PALETTE_ID): Theme {
  const light = isLightTerminal();
  const diffBg = resolveDiffBackground(findDiffBgPalette(diffBgPaletteId), light);
  if (light) {
    return {
      addedFg: 'green',
      addedBg: diffBg.addedBg,
      removedFg: 'red',
      removedBg: diffBg.removedBg,
      contextFg: 'black',
      hunkHeaderFg: 'cyan',
      selectedBg: 'gray',
      selectedFg: 'white',
      // Near-white chrome so frames stay behind tree │ guides (dimFg/gray).
      borderFg: 'ansi256(253)',
      statusFg: 'black',
      dimFg: 'gray',
      defaultFg: 'black',
      // Muted vs pinned black — still readable with bold tab labels.
      tabPreviewFg: 'gray',
    };
  }
  return {
    addedFg: 'green',
    addedBg: diffBg.addedBg,
    removedFg: 'red',
    removedBg: diffBg.removedBg,
    contextFg: 'white',
    hunkHeaderFg: 'cyan',
    selectedBg: 'gray',
    selectedFg: 'whiteBright',
    // Near-white chrome so frames stay behind tree │ guides (dimFg/gray).
    borderFg: 'ansi256(250)',
    statusFg: 'whiteBright',
    dimFg: 'gray',
    defaultFg: 'whiteBright',
    // Softer than pinned whiteBright; ansi250 stays readable without dimColor.
    tabPreviewFg: 'ansi256(250)',
  };
}

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

function isLightTerminal(): boolean {
  const colorfgbg = process.env.COLORFGBG;
  if (!colorfgbg) return false;
  const parts = colorfgbg.split(';');
  const bg = Number.parseInt(parts[parts.length - 1] ?? '0', 10);
  return bg >= 8 && bg <= 15;
}

/** Pick diff backgrounds that stay visibly green/red at the terminal's color level. */
function diffBackgroundColors(light: boolean): { addedBg: string; removedBg: string } {
  const level = chalk.level;

  if (light) {
    if (level >= 3) {
      return { addedBg: 'rgb(228, 240, 228)', removedBg: 'rgb(240, 228, 228)' };
    }
    // 151/210 are pale green and salmon red (157/217 skew blue-green and peach).
    return { addedBg: 'ansi256(151)', removedBg: 'ansi256(210)' };
  }

  if (level >= 3) {
    return { addedBg: 'rgb(24, 56, 24)', removedBg: 'rgb(56, 24, 24)' };
  }
  // 22/52 are the standard dark green and maroon red (23/53 skew blue-green and purple).
  return { addedBg: 'ansi256(22)', removedBg: 'ansi256(52)' };
}

export function getTheme(): Theme {
  const light = isLightTerminal();
  const diffBg = diffBackgroundColors(light);
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

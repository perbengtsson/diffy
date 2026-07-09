import chalk from 'chalk';

export type Theme = {
  addedFg: string;
  addedBg: string;
  removedFg: string;
  removedBg: string;
  contextFg: string;
  hunkHeaderFg: string;
  expandedContextFg: string;
  selectedBg: string;
  selectedFg: string;
  borderFg: string;
  statusFg: string;
  dimFg: string;
  defaultFg: string;
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
      expandedContextFg: 'blue',
      selectedBg: 'blue',
      selectedFg: 'white',
      borderFg: 'gray',
      statusFg: 'black',
      dimFg: 'gray',
      defaultFg: 'black',
    };
  }
  return {
    addedFg: 'green',
    addedBg: diffBg.addedBg,
    removedFg: 'red',
    removedBg: diffBg.removedBg,
    contextFg: 'white',
    hunkHeaderFg: 'cyan',
    expandedContextFg: 'blue',
    selectedBg: 'blue',
    selectedFg: 'white',
    borderFg: 'gray',
    statusFg: 'white',
    dimFg: 'gray',
    defaultFg: 'white',
  };
}

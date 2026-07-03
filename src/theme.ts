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

export function getTheme(): Theme {
  const light = isLightTerminal();
  if (light) {
    return {
      addedFg: 'green',
      addedBg: '#d4edda',
      removedFg: 'red',
      removedBg: '#f8d7da',
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
    addedBg: '#1a3d1a',
    removedFg: 'red',
    removedBg: '#3d1a1a',
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

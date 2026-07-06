const TAB_WIDTH = 4;

export function expandTabs(text: string, tabWidth = TAB_WIDTH): string {
  if (!text.includes('\t')) return text;

  let result = '';
  let col = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\t') {
      const spaces = tabWidth - (col % tabWidth);
      result += ' '.repeat(spaces);
      col += spaces;
    } else if (ch === '\n') {
      result += ch;
      col = 0;
    } else {
      result += ch;
      col++;
    }
  }

  return result;
}

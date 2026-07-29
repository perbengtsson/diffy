import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  modeLabel: string;
  focus: 'files' | 'diff';
  error: string | null;
  notice?: string | null;
  theme: Theme;
  width: number;
  watching?: boolean;
  refreshing?: boolean;
  themeMenuOpen?: boolean;
  bgPickerOpen?: boolean;
  hlPickerOpen?: boolean;
  /** When true, file list includes unchanged files; `d` toggles diffs-only. */
  showUnedited?: boolean;
};

export function StatusBar({
  modeLabel,
  focus,
  error,
  notice = null,
  theme,
  width,
  watching = false,
  refreshing = false,
  themeMenuOpen = false,
  bgPickerOpen = false,
  hlPickerOpen = false,
  showUnedited = true,
}: Props) {
  const diffsKey = showUnedited ? 'd:diffs' : 'd:all';
  const keys =
    bgPickerOpen || hlPickerOpen
      ? '↑/↓:preview Enter:apply Esc:back'
      : themeMenuOpen
        ? '↑/↓:select Enter:open b:bg h:syntax Esc:cancel'
        : focus === 'files'
          ? `Shift+↑/↓:change ${diffsKey} Tab:diff h:hide w:close l:copy f:find o:review t:themes q:quit r:refresh`
          : 'Shift+↑/↓:change c:comment g:line l:copy f:find o:review t:themes h:files Tab:files w:close q:quit r:refresh';

  return (
    <Box width={width}>
      <Text bold color={theme.statusFg} dimColor>
        [{modeLabel}]
        {watching ? (refreshing ? ' ⟳' : ' ●') : ''}
        {' | '}
        {keys}
        {error ? ` | ERR: ${error}` : notice ? ` | ${notice}` : ''}
      </Text>
    </Box>
  );
}

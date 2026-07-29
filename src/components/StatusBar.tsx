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
}: Props) {
  const keys =
    bgPickerOpen || hlPickerOpen
      ? '↑/↓:preview Enter:apply Esc:back'
      : themeMenuOpen
        ? '↑/↓:select Enter:open b:bg h:syntax Esc:cancel'
        : focus === 'files'
          ? 'Shift+↑/↓:change u:all Tab:diff h:hide w:close l:copy f:find o:review t:themes q:quit r:refresh'
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

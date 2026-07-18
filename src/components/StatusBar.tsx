import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  modeLabel: string;
  focus: 'files' | 'diff';
  error: string | null;
  theme: Theme;
  width: number;
  watching?: boolean;
  refreshing?: boolean;
  bgPickerOpen?: boolean;
};

export function StatusBar({
  modeLabel,
  focus,
  error,
  theme,
  width,
  watching = false,
  refreshing = false,
  bgPickerOpen = false,
}: Props) {
  const keys = bgPickerOpen
    ? '↑/↓:preview Enter:apply Esc:cancel'
    : focus === 'files'
      ? '↑/↓:nav ⇧↑/↓:change ←/→:fold u:all Tab:diff w:close ^F:find ^⇧F/⌥F:all o:review b:bg q:quit r:refresh'
      : '↑/↓:scroll PgUp/PgDn:page ←/→:tabs c:comment g:line o:review b:bg Tab:files w:close ^F:find q:quit r:refresh'

  return (
    <Box width={width}>
      <Text bold color={theme.statusFg} dimColor>
        [{modeLabel}]
        {watching ? (refreshing ? ' ⟳' : ' ●') : ''}
        {' | '}
        {keys}
        {error ? ` | ERR: ${error}` : ''}
      </Text>
    </Box>
  );
}

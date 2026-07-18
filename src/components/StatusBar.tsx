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
};

export function StatusBar({
  modeLabel,
  focus,
  error,
  theme,
  width,
  watching = false,
  refreshing = false,
}: Props) {
  const keys =
    focus === 'files'
      ? '↑/↓:nav ←/→:fold u:all Tab:diff w:close ^F:find ^⇧F/⌥F:all o:review q:quit r:refresh'
      : '↑/↓:scroll ←/→:tabs c:comment o:review Tab:files w:close ^F:find g/G q:quit r:refresh'

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

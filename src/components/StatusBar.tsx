import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  modeLabel: string;
  focus: 'files' | 'diff';
  filePath: string;
  error: string | null;
  theme: Theme;
  width: number;
  watching?: boolean;
  refreshing?: boolean;
};

export function StatusBar({
  modeLabel,
  focus,
  filePath,
  error,
  theme,
  width,
  watching = false,
  refreshing = false,
}: Props) {
  const focusLabel = focus === 'files' ? 'files' : 'diff';
  const keys =
    focus === 'files'
      ? 'j/k:nav h/l:fold u:all Tab:diff w:close ^F:find ^⇧F/⌥F:all o:review q:quit r:refresh'
      : 'j/k:scroll ←/→:tabs c:comment o:review Tab:files w:close ^F:find g/G q:quit r:refresh'

  const truncatedPath =
    filePath.length > Math.max(20, width - 60)
      ? '…' + filePath.slice(-(Math.max(20, width - 60) - 1))
      : filePath;

  return (
    <Box width={width}>
      <Text bold color={theme.statusFg} dimColor>
        [{modeLabel}] focus:{focusLabel}
        {watching ? (refreshing ? ' ⟳' : ' ●') : ''}
        {filePath ? ` ${truncatedPath}` : ''} | {keys}
        {error ? ` | ERR: ${error}` : ''}
      </Text>
    </Box>
  );
}

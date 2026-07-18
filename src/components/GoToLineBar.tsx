import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  draft: string;
  theme: Theme;
  width: number;
};

export function GoToLineBar({ draft, theme, width }: Props) {
  return (
    <Box width={width}>
      <Text bold color={theme.statusFg}>
        Go to line:{' '}
        <Text color={theme.defaultFg}>{draft}</Text>
        <Text color={theme.hunkHeaderFg}>▮</Text>
        <Text dimColor color={theme.dimFg}>
          {' '}| Enter:jump Esc:cancel
        </Text>
      </Text>
    </Box>
  );
}

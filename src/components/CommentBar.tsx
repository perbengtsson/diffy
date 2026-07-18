import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  draft: string;
  editing: boolean;
  theme: Theme;
  width: number;
};

export function CommentBar({ draft, editing, theme, width }: Props) {
  const label = editing ? 'Edit comment' : 'Comment';
  return (
    <Box width={width}>
      <Text bold color={theme.statusFg}>
        {label}:{' '}
        <Text color={theme.defaultFg}>{draft}</Text>
        <Text color={theme.hunkHeaderFg}>▮</Text>
        <Text dimColor color={theme.dimFg}>
          {' '}| Enter:save Esc:cancel (empty deletes)
        </Text>
      </Text>
    </Box>
  );
}

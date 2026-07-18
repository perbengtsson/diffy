import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

type Props = {
  name: string;
  width: number;
  theme: Theme;
};

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  if (maxLen <= 3) return name.slice(0, maxLen);
  return '…' + name.slice(name.length - (maxLen - 1));
}

export function RepoBar({ name, width, theme }: Props) {
  const labelWidth = Math.max(1, width - 3);

  return (
    <Box
      width={width}
      height={1}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderColor={theme.borderFg}
      paddingX={1}
    >
      <Text bold color={theme.defaultFg}>
        {truncateName(name, labelWidth)}
      </Text>
    </Box>
  );
}

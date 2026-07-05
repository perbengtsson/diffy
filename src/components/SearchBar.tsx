import { Box, Text } from 'ink';
import type { SearchScope } from '../search/types.js';
import type { Theme } from '../theme.js';

type Props = {
  query: string;
  scope: SearchScope;
  matchIndex: number;
  matchCount: number;
  loading?: boolean;
  theme: Theme;
  width: number;
};

export function SearchBar({
  query,
  scope,
  matchIndex,
  matchCount,
  loading = false,
  theme,
  width,
}: Props) {
  const scopeLabel = scope === 'file' ? 'file' : 'all files';
  const status =
    loading
      ? 'searching…'
      : !query
        ? 'type to search'
        : matchCount === 0
          ? 'no matches'
          : `${matchIndex + 1}/${matchCount}`;

  return (
    <Box width={width}>
      <Text bold color={theme.statusFg}>
        Search ({scopeLabel}):{' '}
        <Text color={theme.defaultFg}>{query}</Text>
        <Text color={theme.hunkHeaderFg}>▮</Text>
        {' '}
        <Text dimColor color={theme.dimFg}>{status}</Text>
        <Text dimColor color={theme.dimFg}>
          {' '}| Tab:scope Enter/n:next N:prev Esc:close
        </Text>
      </Text>
    </Box>
  );
}

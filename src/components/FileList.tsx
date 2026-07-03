import { Box, Text } from 'ink';
import type { DiffFile } from '../git/types.js';
import type { Theme } from '../theme.js';

type Props = {
  files: DiffFile[];
  selectedIndex: number;
  scrollOffset: number;
  height: number;
  width: number;
  focused: boolean;
  theme: Theme;
};

function statusBadge(status: DiffFile['status']): string {
  switch (status) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'untracked':
      return '?';
    default:
      return 'M';
  }
}

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  if (maxLen <= 3) return path.slice(0, maxLen);
  return '…' + path.slice(path.length - (maxLen - 1));
}

export function FileList({
  files,
  selectedIndex,
  scrollOffset,
  height,
  width,
  focused,
  theme,
}: Props) {
  const innerHeight = Math.max(1, height - 2);
  const visible = files.slice(scrollOffset, scrollOffset + innerHeight);
  const pathWidth = Math.max(8, width - 10);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={focused ? theme.selectedBg : theme.borderFg}
    >
      <Box paddingX={1}>
        <Text bold color={focused ? theme.selectedBg : theme.defaultFg}>
          Files ({files.length})
        </Text>
      </Box>
      {files.length === 0 ? (
        <Box paddingX={1}>
          <Text color={theme.dimFg}>No changes</Text>
        </Box>
      ) : (
        visible.map((file, i) => {
          const index = scrollOffset + i;
          const selected = index === selectedIndex;
          return (
            <Box key={file.path} paddingX={1}>
              <Text
                backgroundColor={selected ? theme.selectedBg : undefined}
                color={selected ? theme.selectedFg : theme.defaultFg}
              >
                {selected ? '● ' : '  '}
                <Text color={selected ? theme.selectedFg : theme.hunkHeaderFg}>
                  {statusBadge(file.status)}
                </Text>{' '}
                {truncatePath(file.path, pathWidth)}
                {(file.additions > 0 || file.deletions > 0) && (
                  <Text color={theme.dimFg}>
                    {' '}
                    {file.additions > 0 && (
                      <Text color="green">+{file.additions}</Text>
                    )}
                    {file.deletions > 0 && (
                      <Text color="red">-{file.deletions}</Text>
                    )}
                  </Text>
                )}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}

import { Box, Text } from 'ink';
import type { FileTreeRow } from '../files/tree.js';
import { isEditedFile } from '../files/tree.js';
import { fitFileListRow, formatFileStatsSuffix } from '../files/fileListLayout.js';
import type { DiffFile } from '../git/types.js';
import type { Theme } from '../theme.js';

type Props = {
  rows: FileTreeRow[];
  selectedRowIndex: number;
  scrollOffset: number;
  height: number;
  width: number;
  theme: Theme;
  dirsWithChanges: ReadonlySet<string>;
};

function statusColor(status: DiffFile['status'], theme: Theme): string | undefined {
  switch (status) {
    case 'added':
    case 'untracked':
      return theme.addedFg;
    case 'deleted':
      return theme.removedFg;
    case 'renamed':
      return theme.hunkHeaderFg;
    case 'modified':
      return 'yellow';
    case 'unchanged':
      return undefined;
  }
}

export function FileList({
  rows,
  selectedRowIndex,
  scrollOffset,
  height,
  width,
  theme,
  dirsWithChanges,
}: Props) {
  const innerHeight = Math.max(1, height);
  const visible = rows.slice(scrollOffset, scrollOffset + innerHeight);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderColor={theme.borderFg}
    >
      {rows.length === 0 ? (
        <Box paddingX={1} height={1}>
          <Text bold color={theme.dimFg}>No changes</Text>
        </Box>
      ) : (
        visible.map((row, i) => {
          const index = scrollOffset + i;
          const selected = index === selectedRowIndex;
          const file = row.node.file;
          const highlighted =
            row.node.kind === 'dir'
              ? dirsWithChanges.has(row.node.path)
              : file
                ? isEditedFile(file)
                : false;
          const rawLabel =
            row.node.kind === 'dir' ? `${row.node.name}/` : row.node.name;
          const treePrefix =
            row.node.kind === 'dir'
              ? row.isExpanded
                ? '▾ '
                : '▸ '
              : '';
          const showStats =
            row.node.kind === 'file' &&
            file &&
            highlighted &&
            (file.additions > 0 || file.deletions > 0);
          const fitted = fitFileListRow({
            width,
            depth: row.depth,
            treePrefix,
            label: rawLabel,
            stats: showStats && file ? formatFileStatsSuffix(file) : '',
          });
          const color =
            file && highlighted
              ? statusColor(file.status, theme)
              : selected
                ? theme.selectedFg
                : theme.defaultFg;

          return (
            <Box key={`${row.node.path}:${index}`} height={1} paddingX={1}>
              <Text
                bold={highlighted}
                backgroundColor={selected ? theme.selectedBg : undefined}
                color={color}
                dimColor={!highlighted && !selected}
                wrap="truncate"
              >
                {fitted.indent.length > 0 && (
                  <Text color={theme.dimFg} dimColor>
                    {fitted.indent}
                  </Text>
                )}
                {fitted.treePrefix}
                {fitted.label}
                {file && fitted.stats.length > 0 && (
                  <Text bold color={theme.dimFg}>
                    {' '}
                    {file.additions > 0 && (
                      <Text bold color="green">+{file.additions}</Text>
                    )}
                    {file.deletions > 0 && (
                      <Text bold color="red">-{file.deletions}</Text>
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

import { Box, Text } from 'ink';
import type { FileTab } from '../files/tabs.js';
import type { Theme } from '../theme.js';
import { layoutTabBar } from './tabBarLayout.js';

type Props = {
  tabs: FileTab[];
  activePath: string | null;
  /** True when the diff/content pane has focus — marks the active preview tab. */
  contentFocused: boolean;
  width: number;
  theme: Theme;
};

export function TabBar({ tabs, activePath, contentFocused, width, theme }: Props) {
  const hits = layoutTabBar(tabs, width);

  return (
    <Box width={width} height={1}>
      {hits.length === 0 ? (
        <Text dimColor color={theme.dimFg}>{' '.repeat(width)}</Text>
      ) : (
        hits.map((hit) => {
          const active = hit.path === activePath;
          const preview = !hit.pinned;
          // Mark the active tab only while the content pane is focused — not while
          // browsing the file tree (preview stays softer-colored either way).
          const selected = active && contentFocused;
          return (
            <Text
              key={hit.path}
              backgroundColor={selected ? theme.selectedBg : undefined}
              color={
                preview
                  ? theme.tabPreviewFg
                  : selected
                    ? theme.selectedFg
                    : theme.defaultFg
              }
              bold
            >
              {` ${hit.label} `}
              <Text color={selected ? theme.selectedFg : theme.dimFg}>×</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

/** Re-export for App mouse hit-testing without duplicating layout. */
export { layoutTabBar, hitTestTab } from './tabBarLayout.js';

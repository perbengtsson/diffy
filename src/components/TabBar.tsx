import { Box, Text } from 'ink';
import type { FileTab } from '../files/tabs.js';
import type { Theme } from '../theme.js';
import { layoutTabBar } from './tabBarLayout.js';

type Props = {
  tabs: FileTab[];
  activePath: string | null;
  width: number;
  theme: Theme;
};

export function TabBar({ tabs, activePath, width, theme }: Props) {
  const hits = layoutTabBar(tabs, width);

  return (
    <Box width={width} height={1}>
      {hits.length === 0 ? (
        <Text dimColor color={theme.dimFg}>{' '.repeat(width)}</Text>
      ) : (
        hits.map((hit) => {
          const active = hit.path === activePath;
          const emphasize = hit.pinned || active;
          return (
            <Text
              key={hit.path}
              backgroundColor={active ? theme.selectedBg : undefined}
              color={active ? theme.selectedFg : emphasize ? theme.defaultFg : theme.dimFg}
              dimColor={!emphasize}
              bold={emphasize}
            >
              {` ${hit.label} `}
              <Text color={theme.dimFg}>×</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

/** Re-export for App mouse hit-testing without duplicating layout. */
export { layoutTabBar, hitTestTab } from './tabBarLayout.js';

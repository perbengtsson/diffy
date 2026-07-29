import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

export type ThemeMenuItemId = 'bg' | 'syntax';

export const THEME_MENU_ITEMS: ReadonlyArray<{
  id: ThemeMenuItemId;
  label: string;
  blurb: string;
}> = [
  {
    id: 'bg',
    label: 'Diff background',
    blurb: 'Add/delete row colors',
  },
  {
    id: 'syntax',
    label: 'Syntax highlight',
    blurb: 'Token colors for code',
  },
];

type Props = {
  selectedIndex: number;
  height: number;
  width: number;
  theme: Theme;
  bgLabel: string;
  syntaxLabel: string;
};

export function ThemeMenu({
  selectedIndex,
  height,
  width,
  theme,
  bgLabel,
  syntaxLabel,
}: Props) {
  const header = 'Themes · ↑↓ · Enter · Esc';
  const currentFor = (id: ThemeMenuItemId) =>
    id === 'bg' ? bgLabel : syntaxLabel;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.statusFg}>
        {header.length > width
          ? header.slice(0, Math.max(1, width - 1)) + '…'
          : header}
      </Text>
      {THEME_MENU_ITEMS.map((item, index) => {
        const selected = index === selectedIndex;
        const marker = selected ? '❯' : ' ';
        const title = `${marker} ${item.label}`;
        const detail = `  ${item.blurb} · ${currentFor(item.id)}`;
        return (
          <Box key={item.id} flexDirection="column" width={width}>
            <Text
              bold={selected}
              color={selected ? theme.selectedFg : theme.defaultFg}
              backgroundColor={selected ? theme.selectedBg : undefined}
              wrap="truncate"
            >
              {title.length > width
                ? title.slice(0, Math.max(1, width - 1)) + '…'
                : title.padEnd(width)}
            </Text>
            <Text color={theme.dimFg} dimColor wrap="truncate">
              {detail.length > width
                ? detail.slice(0, Math.max(1, width - 1)) + '…'
                : detail}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

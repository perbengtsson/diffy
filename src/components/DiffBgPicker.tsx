import { Box, Text } from 'ink';
import {
  DIFF_BG_PALETTES,
  resolveDiffBackground,
  type DiffBgPalette,
  type Theme,
} from '../theme.js';

type Props = {
  selectedIndex: number;
  height: number;
  width: number;
  theme: Theme;
  activePaletteId: string;
};

function PreviewRow({
  label,
  backgroundColor,
  color,
  width,
}: {
  label: string;
  backgroundColor: string;
  color: string;
  width: number;
}) {
  const pad = Math.max(0, width - label.length);
  return (
    <Text color={color} backgroundColor={backgroundColor} bold>
      {label}
      {' '.repeat(pad)}
    </Text>
  );
}

function PalettePreview({
  palette,
  selected,
  active,
  theme,
  width,
}: {
  palette: DiffBgPalette;
  selected: boolean;
  active: boolean;
  theme: Theme;
  width: number;
}) {
  const pair = resolveDiffBackground(palette);
  const innerWidth = Math.max(8, width - 2);
  const marker = selected ? '❯' : ' ';
  const activeTag = active ? ' (in use)' : '';
  const title = `${marker} ${palette.label}${activeTag}`;
  const blurb = `  ${palette.blurb}`;

  return (
    <Box flexDirection="column" width={width} marginBottom={1}>
      <Text
        bold={selected}
        color={selected ? theme.selectedFg : theme.defaultFg}
        backgroundColor={selected ? theme.selectedBg : undefined}
      >
        {title.length > width ? title.slice(0, Math.max(1, width - 1)) + '…' : title}
      </Text>
      <Text dimColor color={theme.dimFg}>
        {blurb.length > width ? blurb.slice(0, Math.max(1, width - 1)) + '…' : blurb}
      </Text>
      <PreviewRow
        label="  − removed line sample"
        backgroundColor={pair.removedBg}
        color={theme.removedFg}
        width={innerWidth}
      />
      <PreviewRow
        label="  + added line sample"
        backgroundColor={pair.addedBg}
        color={theme.addedFg}
        width={innerWidth}
      />
    </Box>
  );
}

/** Each palette block: title + blurb + 2 preview rows + margin ≈ 5 rows. */
const BLOCK_ROWS = 5;

export function DiffBgPicker({
  selectedIndex,
  height,
  width,
  theme,
  activePaletteId,
}: Props) {
  const header = 'Diff bg · ↑↓ · Enter · Esc';
  const listHeight = Math.max(1, height - 1);
  const blocksVisible = Math.max(1, Math.floor(listHeight / BLOCK_ROWS));

  const start = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(blocksVisible / 2), DIFF_BG_PALETTES.length - blocksVisible),
  );
  const visible = DIFF_BG_PALETTES.slice(start, start + blocksVisible);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.statusFg}>
        {header.length > width ? header.slice(0, Math.max(1, width - 1)) + '…' : header}
      </Text>
      {visible.map((palette, i) => {
        const index = start + i;
        return (
          <PalettePreview
            key={palette.id}
            palette={palette}
            selected={index === selectedIndex}
            active={palette.id === activePaletteId}
            theme={theme}
            width={width}
          />
        );
      })}
    </Box>
  );
}

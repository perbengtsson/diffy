import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { FileList } from './components/FileList.js';
import { DiffView } from './components/DiffView.js';
import { StatusBar } from './components/StatusBar.js';
import { getTheme } from './theme.js';
import type { DiffMode, DiffSnapshot } from './git/types.js';
import { loadDiffSnapshot } from './git/diff.js';
import {
  buildDisplayLines,
  collapseHunk,
  expandHunk,
  extractHunks,
  findHunkAtLine,
} from './diff/expand.js';
import type { DisplayLine, HunkExpansion } from './diff/types.js';
import { watchRepo } from './watch/repoWatcher.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useMouse } from './hooks/useMouse.js';
import type { MouseClick } from './mouse/parseMouse.js';
import {
  buildFileTree,
  buildDirsWithChanges,
  buildInitialCollapsedDirs,
  findFirstEditedIndex,
  findRowIndexForPath,
  flattenFileTree,
  isEditedFile,
  pruneCollapsedDirs,
  toggleDirCollapsed,
} from './files/tree.js';

type Focus = 'files' | 'diff';

type Props = {
  initialSnapshot: DiffSnapshot;
  cwd: string;
  watch: boolean;
};

export function App({ initialSnapshot, cwd, watch }: Props) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const theme = useMemo(() => getTheme(), []);

  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedIndex, setSelectedIndex] = useState(() =>
    findFirstEditedIndex(initialSnapshot.files),
  );
  const [fileRowIndex, setFileRowIndex] = useState(0);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(() =>
    buildInitialCollapsedDirs(initialSnapshot.files),
  );
  const [showUnedited, setShowUnedited] = useState(true);
  const [fileScroll, setFileScroll] = useState(0);
  const [diffScroll, setDiffScroll] = useState(0);
  const [cursorLine, setCursorLine] = useState(0);
  const [focus, setFocus] = useState<Focus>('files');
  const [expansions, setExpansions] = useState<Map<string, HunkExpansion>>(new Map());
  const [displayLines, setDisplayLines] = useState<DisplayLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedPathRef = useRef<string | undefined>(
    initialSnapshot.files[findFirstEditedIndex(initialSnapshot.files)]?.path,
  );
  const refreshingRef = useRef(false);
  const modeRef = useRef(initialSnapshot.mode);
  modeRef.current = snapshot.mode;

  const filePaneWidth = Math.max(20, Math.min(32, Math.floor(columns * 0.28)));
  const diffPaneWidth = Math.max(30, columns - filePaneWidth - 1);
  const contentHeight = Math.max(5, rows - 2);

  const treeFiles = useMemo(
    () =>
      showUnedited
        ? snapshot.files
        : snapshot.files.filter(isEditedFile),
    [snapshot.files, showUnedited],
  );
  const fileTree = useMemo(() => buildFileTree(treeFiles), [treeFiles]);
  const dirsWithChanges = useMemo(
    () => buildDirsWithChanges(snapshot.files),
    [snapshot.files],
  );
  const visibleFileRows = useMemo(
    () => flattenFileTree(fileTree, collapsedDirs),
    [fileTree, collapsedDirs],
  );

  const selectedFile = snapshot.files[selectedIndex];

  useEffect(() => {
    selectedPathRef.current = selectedFile?.path;
  }, [selectedFile?.path]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      setError(null);
      const prevPath = selectedPathRef.current;
      const next = await loadDiffSnapshot(cwd, modeRef.current);
      setSnapshot(next);
      setCollapsedDirs((prev) => pruneCollapsedDirs(prev, next.files));
      if (prevPath) {
        const idx = next.files.findIndex((f) => f.path === prevPath);
        setSelectedIndex(idx >= 0 ? idx : findFirstEditedIndex(next.files));
      } else {
        setSelectedIndex(findFirstEditedIndex(next.files));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [cwd]);

  useEffect(() => {
    if (!watch) return;
    return watchRepo(snapshot.repoRoot, () => {
      void refresh();
    });
  }, [watch, snapshot.repoRoot, refresh]);

  useEffect(() => {
    setFileRowIndex((i) => Math.min(i, Math.max(0, visibleFileRows.length - 1)));
  }, [visibleFileRows]);

  useEffect(() => {
    if (!selectedFile?.path) return;
    setFileRowIndex(findRowIndexForPath(visibleFileRows, selectedFile.path));
  }, [selectedFile?.path]);

  useEffect(() => {
    setExpansions(new Map());
    setDiffScroll(0);
    setCursorLine(0);
  }, [selectedIndex, selectedFile?.path]);

  useEffect(() => {
    if (!selectedFile) {
      setDisplayLines([]);
      return;
    }

    let cancelled = false;
    setLoadingDiff(true);
    buildDisplayLines(selectedFile, snapshot.mode, snapshot.repoRoot, expansions)
      .then((lines) => {
        if (!cancelled) {
          setDisplayLines(lines);
          setLoadingDiff(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoadingDiff(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, snapshot.mode, snapshot.repoRoot, expansions]);

  const hunks = useMemo(
    () => (selectedFile ? extractHunks(selectedFile.rawDiff, selectedFile.path) : []),
    [selectedFile],
  );

  const maxFileScroll = Math.max(0, visibleFileRows.length - contentHeight);
  const maxDiffScroll = Math.max(0, displayLines.length - contentHeight);

  useEffect(() => {
    setFileScroll((s) => Math.min(s, maxFileScroll));
    setDiffScroll((s) => Math.min(s, maxDiffScroll));
  }, [maxFileScroll, maxDiffScroll]);

  const selectFileRow = useCallback(
    (nextRow: number, openDiff = false) => {
      if (nextRow < 0 || nextRow >= visibleFileRows.length) return;
      setFocus(openDiff ? 'diff' : 'files');
      setFileRowIndex(nextRow);
      const row = visibleFileRows[nextRow];
      if (row?.node.kind === 'file') {
        const idx = snapshot.files.findIndex((f) => f.path === row.node.path);
        if (idx >= 0) setSelectedIndex(idx);
      }
    },
    [snapshot.files, visibleFileRows],
  );

  const handleFileClick = useCallback(
    (click: MouseClick) => {
      if (click.x < 1 || click.x > filePaneWidth || click.y < 1 || click.y > contentHeight) {
        return;
      }

      const rowIndex = click.y - 1 + fileScroll;
      if (rowIndex < 0 || rowIndex >= visibleFileRows.length) return;

      const row = visibleFileRows[rowIndex];
      if (!row) return;

      if (row.node.kind === 'dir') {
        setFocus('files');
        setFileRowIndex(rowIndex);
        setCollapsedDirs((prev) => toggleDirCollapsed(prev, row.node.path));
        return;
      }

      selectFileRow(rowIndex, true);
    },
    [contentHeight, filePaneWidth, fileScroll, selectFileRow, visibleFileRows],
  );

  useMouse(handleFileClick);

  useInput((input, key) => {
    if (input.startsWith('\x1b[<')) return;

    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }

    if (input === 'r') {
      void refresh();
      return;
    }

    if (key.tab) {
      setFocus((f) => (f === 'files' ? 'diff' : 'files'));
      return;
    }

    if (focus === 'files') {
      const currentRow = visibleFileRows[fileRowIndex];

      if (input === 'u') {
        setShowUnedited((show) => !show);
        return;
      }

      const selectRow = (nextRow: number, openDiff = false) => {
        selectFileRow(nextRow, openDiff);
      };

      if (input === 'j' || key.downArrow) {
        if (visibleFileRows.length === 0) return;
        const next = Math.min(visibleFileRows.length - 1, fileRowIndex + 1);
        selectRow(next);
        if (next >= fileScroll + contentHeight) {
          setFileScroll((s) => Math.min(maxFileScroll, s + 1));
        }
      } else if (input === 'k' || key.upArrow) {
        if (visibleFileRows.length === 0) return;
        const next = Math.max(0, fileRowIndex - 1);
        selectRow(next);
        if (next < fileScroll) {
          setFileScroll((s) => Math.max(0, s - 1));
        }
      } else if (
        (input === 'h' || key.leftArrow) &&
        currentRow?.node.kind === 'dir' &&
        !collapsedDirs.has(currentRow.node.path)
      ) {
        setCollapsedDirs((prev) => new Set(prev).add(currentRow.node.path));
      } else if (
        (input === 'l' || key.rightArrow) &&
        currentRow?.node.kind === 'dir' &&
        collapsedDirs.has(currentRow.node.path)
      ) {
        setCollapsedDirs((prev) => {
          const next = new Set(prev);
          next.delete(currentRow.node.path);
          return next;
        });
      } else if (
        (input === ' ' || key.return) &&
        currentRow?.node.kind === 'dir'
      ) {
        setCollapsedDirs((prev) => toggleDirCollapsed(prev, currentRow.node.path));
      } else if (
        input === 'l' ||
        key.rightArrow ||
        key.return ||
        (currentRow?.node.kind === 'file' && input === ' ')
      ) {
        selectRow(fileRowIndex, true);
      }
      return;
    }

    // diff focus
    if (input === 'j' || key.downArrow) {
      setCursorLine((c) => {
        const next = Math.min(displayLines.length - 1, c + 1);
        if (next >= diffScroll + contentHeight) {
          setDiffScroll((s) => Math.min(maxDiffScroll, s + 1));
        }
        return next;
      });
    } else if (input === 'k' || key.upArrow) {
      setCursorLine((c) => {
        const next = Math.max(0, c - 1);
        if (next < diffScroll) {
          setDiffScroll((s) => Math.max(0, s - 1));
        }
        return next;
      });
    } else if (input === 'g') {
      setCursorLine(0);
      setDiffScroll(0);
    } else if (input === 'G') {
      const last = Math.max(0, displayLines.length - 1);
      setCursorLine(last);
      setDiffScroll(Math.max(0, displayLines.length - contentHeight));
    } else if (input === 'h' || key.leftArrow) {
      setFocus('files');
    } else if (input === '{' || (key.ctrl && input === 'u')) {
      const hunk = findHunkAtLine(displayLines, cursorLine, hunks);
      if (hunk) setExpansions((e) => expandHunk(e, hunk.id, 'before'));
    } else if (input === '}' || (key.ctrl && input === 'd')) {
      const hunk = findHunkAtLine(displayLines, cursorLine, hunks);
      if (hunk) setExpansions((e) => expandHunk(e, hunk.id, 'after'));
    } else if (input === '[') {
      const hunk = findHunkAtLine(displayLines, cursorLine, hunks);
      if (hunk) setExpansions((e) => collapseHunk(e, hunk.id, 'before'));
    } else if (input === ']') {
      const hunk = findHunkAtLine(displayLines, cursorLine, hunks);
      if (hunk) setExpansions((e) => collapseHunk(e, hunk.id, 'after'));
    }
  });

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box flexDirection="row" height={contentHeight}>
        <FileList
          rows={visibleFileRows}
          selectedRowIndex={fileRowIndex}
          scrollOffset={fileScroll}
          height={contentHeight}
          width={filePaneWidth}
          theme={theme}
          dirsWithChanges={dirsWithChanges}
        />
        <DiffView
          lines={loadingDiff ? [{ kind: 'binary', content: 'Loading…' }] : displayLines}
          scrollOffset={diffScroll}
          cursorLine={cursorLine}
          height={contentHeight}
          width={diffPaneWidth}
          focused={focus === 'diff'}
          theme={theme}
          emptyMessage={
            selectedFile && !isEditedFile(selectedFile)
              ? 'No changes'
              : 'Select a file to view its diff'
          }
        />
      </Box>
      <StatusBar
        modeLabel={snapshot.modeLabel}
        focus={focus}
        filePath={selectedFile?.path ?? ''}
        error={error}
        theme={theme}
        width={columns}
        watching={watch}
        refreshing={refreshing}
      />
    </Box>
  );
}

export function parseMode(options: {
  staged?: boolean;
  base?: string;
  includeUncommitted?: boolean;
}): DiffMode {
  if (options.base) {
    return {
      kind: 'base',
      base: options.base,
      includeUncommitted: options.includeUncommitted ?? false,
    };
  }
  return { kind: 'uncommitted', stagedOnly: options.staged ?? false };
}

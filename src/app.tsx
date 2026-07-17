import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { FileList } from './components/FileList.js';
import { FileSummary, fileSummaryHeight } from './components/FileSummary.js';
import { DiffView } from './components/DiffView.js';
import { SearchBar } from './components/SearchBar.js';
import { StatusBar } from './components/StatusBar.js';
import { TabBar, layoutTabBar, hitTestTab } from './components/TabBar.js';
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
import {
  buildLineHighlightCache,
  type LineHighlightCache,
} from './highlight/cache.js';
import { watchRepo } from './watch/repoWatcher.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useFileTabs } from './hooks/useFileTabs.js';
import { useMouse } from './hooks/useMouse.js';
import type { MouseEvent } from './mouse/parseMouse.js';
import {
  EMPTY_DOUBLE_CLICK,
  registerClick,
} from './mouse/doubleClick.js';
import {
  buildFileTree,
  buildDirsWithChanges,
  buildInitialCollapsedDirs,
  findFirstEditedIndex,
  findRowIndexForPath,
  flattenFileTree,
  expandDirsForPath,
  isEditedFile,
  pruneCollapsedDirs,
  toggleDirCollapsed,
} from './files/tree.js';
import { buildChangeSummary } from './files/summary.js';
import {
  EMPTY_FILE_TABS,
  preview,
} from './files/tabs.js';
import { scrollOffsetFromTrackRow, isScrollBarHit } from './components/scrollBar.js';
import { findAllFileMatches, findLineMatches } from './search/search.js';
import type { SearchMatch, SearchScope } from './search/types.js';

type Focus = 'files' | 'diff';

const WHEEL_SCROLL_LINES = 3;

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
  const [, setSelectedIndex] = useState(() =>
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
  const [highlightCache, setHighlightCache] = useState<LineHighlightCache | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('file');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [allSearchMatches, setAllSearchMatches] = useState<SearchMatch[]>([]);
  const [allSearchLoading, setAllSearchLoading] = useState(false);

  const pendingSearchMatchRef = useRef<SearchMatch | null>(null);
  const scrollbarDragRef = useRef(false);
  const doubleClickRef = useRef(EMPTY_DOUBLE_CLICK);
  const ensureFileVisibleRef = useRef<string | null>(null);

  const initialPath =
    initialSnapshot.files[findFirstEditedIndex(initialSnapshot.files)]?.path;
  const fileTabs = useFileTabs(
    initialPath ? preview(EMPTY_FILE_TABS, initialPath) : EMPTY_FILE_TABS,
  );

  const selectedPathRef = useRef<string | undefined>(initialPath);
  const refreshingRef = useRef(false);
  const modeRef = useRef(initialSnapshot.mode);
  modeRef.current = snapshot.mode;

  const filePaneWidth = Math.max(25, Math.min(37, Math.floor(columns * 0.28) + 5));
  const diffPaneWidth = Math.max(30, columns - filePaneWidth - 1);
  const contentHeight = Math.max(5, rows - 2);
  const tabBarHeight = 1;
  const diffHeight = Math.max(1, contentHeight - tabBarHeight);
  const scrollBarLayout = useMemo(
    () => ({
      columns,
      filePaneWidth,
      contentHeight: diffHeight,
      totalLines: displayLines.length,
    }),
    [columns, diffHeight, displayLines.length, filePaneWidth],
  );

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
  const changeSummary = useMemo(
    () => buildChangeSummary(snapshot.files),
    [snapshot.files],
  );
  const summaryTypeRows = 5;
  const summaryHeight = fileSummaryHeight(changeSummary, summaryTypeRows);
  const fileListHeight = Math.max(1, contentHeight - summaryHeight);

  const selectedFile = fileTabs.activePath
    ? snapshot.files.find((f) => f.path === fileTabs.activePath)
    : undefined;

  useEffect(() => {
    selectedPathRef.current = fileTabs.activePath ?? undefined;
  }, [fileTabs.activePath]);

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
      fileTabs.prune(new Set(next.files.map((f) => f.path)));
      if (prevPath) {
        const idx = next.files.findIndex((f) => f.path === prevPath);
        if (idx >= 0) setSelectedIndex(idx);
      } else {
        setSelectedIndex(findFirstEditedIndex(next.files));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [cwd, fileTabs.prune]);

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
    if (!fileTabs.activePath) return;
    const idx = snapshot.files.findIndex((f) => f.path === fileTabs.activePath);
    if (idx >= 0) setSelectedIndex(idx);
    setCollapsedDirs((prev) => expandDirsForPath(prev, fileTabs.activePath!));
  }, [fileTabs.activePath, snapshot.files]);

  useEffect(() => {
    if (!fileTabs.activePath) return;
    setFileRowIndex(findRowIndexForPath(visibleFileRows, fileTabs.activePath));
  }, [fileTabs.activePath, visibleFileRows]);

  useEffect(() => {
    setExpansions(new Map());
    setDiffScroll(0);
    setCursorLine(0);
  }, [fileTabs.activePath]);

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

  useEffect(() => {
    if (!selectedFile || selectedFile.isBinary) {
      setHighlightCache(null);
      return;
    }

    let cancelled = false;
    buildLineHighlightCache(selectedFile, snapshot.mode, snapshot.repoRoot)
      .then((cache) => {
        if (!cancelled) setHighlightCache(cache);
      })
      .catch(() => {
        if (!cancelled) setHighlightCache(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, snapshot.mode, snapshot.repoRoot]);

  const hunks = useMemo(
    () => (selectedFile ? extractHunks(selectedFile.rawDiff, selectedFile.path) : []),
    [selectedFile],
  );

  const maxFileScroll = Math.max(0, visibleFileRows.length - fileListHeight);
  const maxDiffScroll = Math.max(0, displayLines.length - diffHeight);

  useEffect(() => {
    const path = ensureFileVisibleRef.current;
    if (!path) return;
    const row = findRowIndexForPath(visibleFileRows, path);
    if (row < 0) return;
    ensureFileVisibleRef.current = null;
    setFileScroll((s) => {
      if (row < s) return row;
      if (row >= s + fileListHeight) {
        return Math.min(maxFileScroll, row - fileListHeight + 1);
      }
      return s;
    });
  }, [visibleFileRows, fileListHeight, maxFileScroll]);

  const fileSearchMatches = useMemo(() => {
    if (!searchQuery || !selectedFile) return [];
    return findLineMatches(displayLines, searchQuery, selectedFile.path);
  }, [displayLines, searchQuery, selectedFile]);

  const searchMatches =
    searchScope === 'file' ? fileSearchMatches : allSearchMatches;

  const currentFileSearchLines = useMemo(() => {
    if (!searchOpen || !searchQuery || !selectedFile) return undefined;
    if (searchScope === 'all') {
      return new Set(
        allSearchMatches
          .filter((match) => match.filePath === selectedFile.path)
          .map((match) => match.lineIndex),
      );
    }
    return new Set(fileSearchMatches.map((match) => match.lineIndex));
  }, [
    allSearchMatches,
    fileSearchMatches,
    searchOpen,
    searchQuery,
    searchScope,
    selectedFile,
  ]);

  const activeSearchLine =
    searchOpen &&
    searchQuery &&
    searchMatches.length > 0 &&
    selectedFile?.path === searchMatches[searchMatchIndex]?.filePath
      ? searchMatches[searchMatchIndex]?.lineIndex
      : undefined;

  useEffect(() => {
    if (!searchOpen || searchScope !== 'all' || !searchQuery) {
      setAllSearchMatches([]);
      setAllSearchLoading(false);
      return;
    }

    let cancelled = false;
    setAllSearchLoading(true);
    findAllFileMatches(
      treeFiles,
      snapshot.mode,
      snapshot.repoRoot,
      searchQuery,
      expansions,
    )
      .then((matches) => {
        if (!cancelled) {
          setAllSearchMatches(matches);
          setAllSearchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllSearchMatches([]);
          setAllSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    searchOpen,
    searchScope,
    searchQuery,
    treeFiles,
    snapshot.mode,
    snapshot.repoRoot,
    expansions,
  ]);

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchQuery, searchScope]);

  useEffect(() => {
    setSearchMatchIndex((index) =>
      searchMatches.length === 0 ? 0 : Math.min(index, searchMatches.length - 1),
    );
  }, [searchMatches.length]);

  const scrollToLine = useCallback(
    (lineIndex: number) => {
      setCursorLine(lineIndex);
      setDiffScroll((scroll) => {
        if (lineIndex < scroll) return lineIndex;
        if (lineIndex >= scroll + diffHeight) {
          return Math.min(maxDiffScroll, lineIndex - diffHeight + 1);
        }
        return scroll;
      });
      setFocus('diff');
    },
    [diffHeight, maxDiffScroll],
  );

  const goToSearchMatch = useCallback(
    (match: SearchMatch | undefined) => {
      if (!match) return;

      if (match.filePath !== selectedFile?.path) {
        pendingSearchMatchRef.current = match;
        const idx = snapshot.files.findIndex((file) => file.path === match.filePath);
        if (idx < 0) return;
        setSelectedIndex(idx);
        setCollapsedDirs((prev) => expandDirsForPath(prev, match.filePath));
        fileTabs.pin(match.filePath);
        setFocus('diff');
        return;
      }

      scrollToLine(match.lineIndex);
    },
    [fileTabs.pin, scrollToLine, selectedFile?.path, snapshot.files],
  );

  useEffect(() => {
    const pending = pendingSearchMatchRef.current;
    if (!pending || loadingDiff) return;
    if (selectedFile?.path !== pending.filePath || displayLines.length === 0) return;
    pendingSearchMatchRef.current = null;
    scrollToLine(pending.lineIndex);
  }, [displayLines, loadingDiff, scrollToLine, selectedFile?.path]);

  useEffect(() => {
    if (!searchOpen || !searchQuery || searchMatches.length === 0) return;
    if (searchScope === 'all' && allSearchLoading) return;
    if (pendingSearchMatchRef.current) return;
    goToSearchMatch(searchMatches[searchMatchIndex]);
  }, [
    allSearchLoading,
    goToSearchMatch,
    searchMatchIndex,
    searchMatches,
    searchOpen,
    searchQuery,
    searchScope,
  ]);

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
        fileTabs.preview(row.node.path);
      }
    },
    [fileTabs.preview, snapshot.files, visibleFileRows],
  );

  const handleMouseEvent = useCallback(
    (event: MouseEvent) => {
      if (event.kind === 'wheel') {
        const delta =
          event.direction === 'down' ? WHEEL_SCROLL_LINES : -WHEEL_SCROLL_LINES;

        if (
          event.x >= 1 &&
          event.x <= filePaneWidth &&
          event.y >= 1 &&
          event.y <= fileListHeight
        ) {
          setFocus('files');
          setFileScroll((s) => Math.max(0, Math.min(maxFileScroll, s + delta)));
          return;
        }

        if (
          event.x > filePaneWidth &&
          event.y >= 1 + tabBarHeight &&
          event.y <= contentHeight
        ) {
          setFocus('diff');
          setDiffScroll((s) => Math.max(0, Math.min(maxDiffScroll, s + delta)));
        }
        return;
      }

      if (event.kind === 'release') {
        scrollbarDragRef.current = false;
        return;
      }

      if (event.kind === 'drag') {
        if (!scrollbarDragRef.current || displayLines.length === 0) return;
        const diffLocalY = event.y - tabBarHeight;
        const trackRow = Math.max(0, Math.min(diffHeight - 1, diffLocalY - 1));
        const offset = scrollOffsetFromTrackRow(
          trackRow,
          diffHeight,
          displayLines.length,
          diffHeight,
        );
        setFocus('diff');
        setDiffScroll(Math.max(0, Math.min(maxDiffScroll, offset)));
        return;
      }

      if (event.kind !== 'click') return;

      const diffLocalY = event.y - tabBarHeight;
      if (
        event.y >= 1 + tabBarHeight &&
        isScrollBarHit(event.x, diffLocalY, scrollBarLayout)
      ) {
        scrollbarDragRef.current = true;
        const trackRow = Math.max(0, Math.min(diffHeight - 1, diffLocalY - 1));
        const offset = scrollOffsetFromTrackRow(
          trackRow,
          diffHeight,
          displayLines.length,
          diffHeight,
        );
        setFocus('diff');
        setDiffScroll(Math.max(0, Math.min(maxDiffScroll, offset)));
        return;
      }

      if (
        event.x > filePaneWidth &&
        event.x <= filePaneWidth + diffPaneWidth &&
        event.y === 1
      ) {
        const x = event.x - filePaneWidth - 1;
        const hit = hitTestTab(layoutTabBar(fileTabs.tabs, diffPaneWidth), x);
        if (!hit) return;

        if (hit.close) {
          fileTabs.close(hit.path);
          return;
        }

        const tab = fileTabs.tabs.find((t) => t.path === hit.path);
        const { state, isDouble } = registerClick(
          doubleClickRef.current,
          `tab:${hit.path}`,
          Date.now(),
        );
        doubleClickRef.current = state;

        if (isDouble && tab && !tab.pinned) {
          fileTabs.pin(hit.path);
        } else {
          fileTabs.activate(hit.path);
        }

        const idx = snapshot.files.findIndex((f) => f.path === hit.path);
        if (idx >= 0) setSelectedIndex(idx);
        setCollapsedDirs((prev) => expandDirsForPath(prev, hit.path));
        ensureFileVisibleRef.current = hit.path;
        setFocus('diff');
        return;
      }

      if (event.x < 1 || event.x > filePaneWidth || event.y < 1 || event.y > contentHeight) {
        return;
      }

      const rowIndex = event.y - 1 + fileScroll;
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
      const { state, isDouble } = registerClick(
        doubleClickRef.current,
        `file:${row.node.path}`,
        Date.now(),
      );
      doubleClickRef.current = state;
      if (isDouble) {
        fileTabs.pin(row.node.path);
        setFocus('diff');
      }
    },
    [
      contentHeight,
      diffHeight,
      diffPaneWidth,
      displayLines.length,
      fileListHeight,
      filePaneWidth,
      fileScroll,
      fileTabs.activate,
      fileTabs.close,
      fileTabs.pin,
      fileTabs.tabs,
      maxDiffScroll,
      maxFileScroll,
      scrollBarLayout,
      selectFileRow,
      snapshot.files,
      tabBarHeight,
      visibleFileRows,
    ],
  );

  useMouse(handleMouseEvent);

  const openSearch = useCallback((scope: SearchScope) => {
    setSearchScope(scope);
    setSearchOpen(true);
    setSearchQuery('');
    setSearchMatchIndex(0);
    setAllSearchMatches([]);
    setFocus('diff');
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatchIndex(0);
    setAllSearchMatches([]);
    pendingSearchMatchRef.current = null;
  }, []);

  const stepSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (searchMatches.length === 0) return;
      setSearchMatchIndex((index) => {
        const next = (index + direction + searchMatches.length) % searchMatches.length;
        return next;
      });
    },
    [searchMatches.length],
  );

  useInput((input, key) => {
    if (input.startsWith('\x1b[<')) return;

    const isFindKey = input === 'f' || input === 'F';

    if (key.meta && isFindKey) {
      openSearch('all');
      return;
    }

    if (key.ctrl && key.shift && (isFindKey || input === '')) {
      openSearch('all');
      return;
    }

    if (key.ctrl && isFindKey) {
      openSearch('file');
      return;
    }

    if (searchOpen) {
      if (key.tab) {
        setSearchScope((scope) => (scope === 'file' ? 'all' : 'file'));
        return;
      }
      if (key.escape) {
        closeSearch();
        return;
      }
      if (key.return) {
        stepSearchMatch(1);
        return;
      }
      if (input === 'n' && !key.ctrl && !key.meta) {
        stepSearchMatch(1);
        return;
      }
      if (input === 'N') {
        stepSearchMatch(-1);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((query) => query.slice(0, -1));
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta && input >= ' ') {
        setSearchQuery((query) => query + input);
        return;
      }
      return;
    }

    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }

    if (input === 'r') {
      void refresh();
      return;
    }

    if (input === 'w' && fileTabs.tabs.length > 0) {
      fileTabs.close();
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
        if (next >= fileScroll + fileListHeight) {
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
      } else if (key.return && currentRow?.node.kind === 'file') {
        fileTabs.pin(currentRow.node.path);
        setFocus('diff');
      } else if (
        input === 'l' ||
        key.rightArrow ||
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
        if (next >= diffScroll + diffHeight) {
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
      setDiffScroll(Math.max(0, displayLines.length - diffHeight));
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
        <Box flexDirection="column" width={filePaneWidth} height={contentHeight}>
          <FileList
            rows={visibleFileRows}
            selectedRowIndex={fileRowIndex}
            scrollOffset={fileScroll}
            height={fileListHeight}
            width={filePaneWidth}
            theme={theme}
            dirsWithChanges={dirsWithChanges}
          />
          <FileSummary
            summary={changeSummary}
            width={filePaneWidth}
            theme={theme}
            maxTypeRows={summaryTypeRows}
          />
        </Box>
        <Box flexDirection="column" width={diffPaneWidth} height={contentHeight}>
          <TabBar
            tabs={fileTabs.tabs}
            activePath={fileTabs.activePath}
            width={diffPaneWidth}
            theme={theme}
          />
          <DiffView
            lines={loadingDiff ? [{ kind: 'binary', content: 'Loading…' }] : displayLines}
            scrollOffset={diffScroll}
            cursorLine={cursorLine}
            height={diffHeight}
            width={diffPaneWidth}
            focused={focus === 'diff' && !searchOpen}
            theme={theme}
            highlightCache={highlightCache ?? undefined}
            searchQuery={searchOpen ? searchQuery : undefined}
            searchMatchLines={currentFileSearchLines}
            activeSearchLine={activeSearchLine}
            emptyMessage={
              selectedFile && !isEditedFile(selectedFile)
                ? 'No changes'
                : 'Select a file to view its diff'
            }
          />
        </Box>
      </Box>
      {searchOpen ? (
        <SearchBar
          query={searchQuery}
          scope={searchScope}
          matchIndex={searchMatchIndex}
          matchCount={searchMatches.length}
          loading={searchScope === 'all' && allSearchLoading}
          theme={theme}
          width={columns}
        />
      ) : (
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
      )}
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

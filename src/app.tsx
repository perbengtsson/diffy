import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Box, useApp, useInput, useStdin, useStdout } from 'ink';
import { FileList } from './components/FileList.js';
import { FileSummary, fileSummaryHeight } from './components/FileSummary.js';
import { DiffView, DIFF_GUTTER_WIDTH } from './components/DiffView.js';
import { SearchBar } from './components/SearchBar.js';
import { CommentBar } from './components/CommentBar.js';
import { GoToLineBar } from './components/GoToLineBar.js';
import { ReviewOverview } from './components/ReviewOverview.js';
import { DiffBgPicker } from './components/DiffBgPicker.js';
import { HighlightSchemaPicker } from './components/HighlightSchemaPicker.js';
import {
  THEME_MENU_ITEMS,
  ThemeMenu,
} from './components/ThemeMenu.js';
import { RepoBar } from './components/RepoBar.js';
import { StatusBar } from './components/StatusBar.js';
import { TabBar, layoutTabBar, hitTestTab } from './components/TabBar.js';
import {
  DEFAULT_DIFF_BG_PALETTE_ID,
  DIFF_BG_PALETTES,
  findDiffBgPalette,
  getTheme,
} from './theme.js';
import {
  DEFAULT_HIGHLIGHT_SCHEMA_ID,
  findHighlightSchema,
  HIGHLIGHT_SCHEMAS,
} from './highlight/colors.js';
import { saveUserConfig } from './config/userConfig.js';
import type { DiffMode, DiffSnapshot } from './git/types.js';
import { loadDiffSnapshot } from './git/diff.js';
import { compileReview, formatReviewTerminal } from './review/compile.js';
import { formatAgentFileRef } from './review/agentRef.js';
import {
  clipboardInstallHint,
  copyToClipboard,
} from './review/clipboard.js';
import {
  commentedLineKeysForPath,
  findComment,
  persistSession,
  resolveLineTarget,
  upsertComment,
} from './review/store.js';
import type { ReviewComment, ReviewSession } from './review/types.js';
import {
  findNextGlobalChangeBlock,
  findPrevGlobalChangeBlock,
  type ChangeLocation,
} from './diff/changeBlocks.js';
import { buildDisplayLines } from './diff/expand.js';
import { findDisplayLineIndexByNumber } from './diff/goToLine.js';
import type { DisplayLine } from './diff/types.js';
import { wordAtColumn } from './diff/wordAt.js';
import {
  buildLineHighlightCache,
  type LineHighlightCache,
} from './highlight/cache.js';
import { watchRepo } from './watch/repoWatcher.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useFileTabs } from './hooks/useFileTabs.js';
import { useMouse } from './hooks/useMouse.js';
import {
  DISABLE_MOUSE,
  ENABLE_MOUSE,
  type MouseEvent,
} from './mouse/parseMouse.js';
import {
  EMPTY_DOUBLE_CLICK,
  registerClick,
} from './mouse/doubleClick.js';
import { workingTreeLineForEdit } from './editor/editorCommand.js';
import { runExternalEditor } from './editor/runExternalEditor.js';
import {
  buildFileTree,
  buildDirsWithChanges,
  buildInitialCollapsedDirs,
  findFirstEditedIndex,
  findRowIndexForPath,
  flattenFileTree,
  flattenFilesInTreeOrder,
  expandDirsForPath,
  isEditedFile,
  refreshCollapsedDirs,
  toggleDirCollapsed,
} from './files/tree.js';
import { buildChangeSummary } from './files/summary.js';
import {
  EMPTY_FILE_TABS,
  preview,
} from './files/tabs.js';
import {
  pruneTabViews,
  recallTabView,
  rememberTabView,
  type TabViewState,
} from './files/tabView.js';
import {
  scrollOffsetFromTrackRow,
  isScrollBarHit,
  centeredScrollOffset,
  needsScrollBar,
  scrollBarChromeWidth,
} from './components/scrollBar.js';
import {
  clampFilePaneWidth,
  isSplitBorderHit,
  resolveFilePaneWidth,
} from './layout/filePane.js';
import {
  findAllFileMatches,
  findLineMatches,
  isSearchableLine,
} from './search/search.js';
import type { SearchMatch, SearchScope } from './search/types.js';

type Focus = 'files' | 'diff';

const WHEEL_SCROLL_LINES = 3;

type Props = {
  initialSnapshot: DiffSnapshot;
  cwd: string;
  watch: boolean;
  initialReview: ReviewSession;
  reviewPath: string;
  initialDiffBgPaletteId?: string;
  initialHighlightSchemaId?: string;
  onQuitReview?: (payload: { terminal: string; plain: string }) => void;
};

export function App({
  initialSnapshot,
  cwd,
  watch,
  initialReview,
  reviewPath,
  initialDiffBgPaletteId = DEFAULT_DIFF_BG_PALETTE_ID,
  initialHighlightSchemaId = DEFAULT_HIGHLIGHT_SCHEMA_ID,
  onQuitReview,
}: Props) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const { setRawMode, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const [diffBgPaletteId, setDiffBgPaletteId] = useState(initialDiffBgPaletteId);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuIndex, setThemeMenuIndex] = useState(0);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [bgPickerIndex, setBgPickerIndex] = useState(0);
  const [bgPickerSavedId, setBgPickerSavedId] = useState(initialDiffBgPaletteId);
  const [highlightSchemaId, setHighlightSchemaId] = useState(
    initialHighlightSchemaId,
  );
  const [hlPickerOpen, setHlPickerOpen] = useState(false);
  const [hlPickerIndex, setHlPickerIndex] = useState(0);
  const [hlPickerSavedId, setHlPickerSavedId] = useState(initialHighlightSchemaId);
  const theme = useMemo(() => {
    if (bgPickerOpen) {
      const previewId = DIFF_BG_PALETTES[bgPickerIndex]?.id ?? diffBgPaletteId;
      return getTheme(previewId);
    }
    return getTheme(diffBgPaletteId);
  }, [bgPickerIndex, bgPickerOpen, diffBgPaletteId]);
  const activeHighlightSchemaId = hlPickerOpen
    ? (HIGHLIGHT_SCHEMAS[hlPickerIndex]?.id ?? highlightSchemaId)
    : highlightSchemaId;
  const leftPickerOpen = themeMenuOpen || bgPickerOpen || hlPickerOpen;

  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [fileRowIndex, setFileRowIndex] = useState(0);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(() =>
    buildInitialCollapsedDirs(initialSnapshot.files),
  );
  const [showUnedited, setShowUnedited] = useState(false);
  const [fileScroll, setFileScroll] = useState(0);
  const [diffScroll, setDiffScroll] = useState(0);
  const [cursorLine, setCursorLine] = useState(0);
  const [focus, setFocus] = useState<Focus>('files');
  const [displayLines, setDisplayLines] = useState<DisplayLine[]>([]);
  const [highlightCache, setHighlightCache] = useState<LineHighlightCache | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('file');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [allSearchMatches, setAllSearchMatches] = useState<SearchMatch[]>([]);
  const [allSearchLoading, setAllSearchLoading] = useState(false);
  const [reviewSession, setReviewSession] = useState(initialReview);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentEditing, setCommentEditing] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [goToLineDraft, setGoToLineDraft] = useState('');
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [filePaneWidthUser, setFilePaneWidthUser] = useState<number | null>(null);
  const [filePaneCollapsed, setFilePaneCollapsed] = useState(false);
  const [screenEpoch, setScreenEpoch] = useState(0);

  const pendingSearchMatchRef = useRef<SearchMatch | null>(null);
  const pendingReviewJumpRef = useRef<ReviewComment | null>(null);
  const pendingChangeJumpRef = useRef<ChangeLocation | null>(null);
  const changeNavBusyRef = useRef(false);
  const reviewSessionRef = useRef(reviewSession);
  reviewSessionRef.current = reviewSession;
  const reviewPathRef = useRef(reviewPath);
  reviewPathRef.current = reviewPath;
  const onQuitReviewRef = useRef(onQuitReview);
  onQuitReviewRef.current = onQuitReview;
  const skipInitialReviewSaveRef = useRef(true);

  const scrollbarDragRef = useRef(false);
  const splitDragRef = useRef(false);
  const editorOpenRef = useRef(false);
  const doubleClickRef = useRef(EMPTY_DOUBLE_CLICK);
  const ensureFileVisibleRef = useRef<string | null>(null);
  const syncFileRowToActiveRef = useRef(false);
  const tabViewsRef = useRef<Map<string, TabViewState>>(new Map());
  const prevActivePathRef = useRef<string | null>(null);
  const viewStateRef = useRef({ cursorLine, diffScroll });
  viewStateRef.current = { cursorLine, diffScroll };

  const initialPath =
    initialSnapshot.files[findFirstEditedIndex(initialSnapshot.files)]?.path;
  const fileTabs = useFileTabs(
    initialPath ? preview(EMPTY_FILE_TABS, initialPath) : EMPTY_FILE_TABS,
  );

  const refreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const modeRef = useRef(initialSnapshot.mode);
  modeRef.current = snapshot.mode;

  const filePaneWidth = resolveFilePaneWidth({
    columns,
    collapsed: filePaneCollapsed,
    leftPickerOpen,
    userWidth: filePaneWidthUser,
  });
  const diffPaneWidth =
    filePaneWidth === 0 ? columns : Math.max(30, columns - filePaneWidth);
  const contentHeight = Math.max(5, rows - 2);
  const tabBarHeight = 1;
  const fileHeaderHeight = 1;
  const diffHeight = Math.max(1, contentHeight - tabBarHeight);
  const repoName = basename(snapshot.repoRoot);
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
  const filesInTreeOrder = useMemo(
    () => flattenFilesInTreeOrder(buildFileTree(snapshot.files)),
    [snapshot.files],
  );
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
  const fileListHeight = Math.max(
    1,
    contentHeight - summaryHeight - fileHeaderHeight,
  );

  const selectedFile = fileTabs.activePath
    ? snapshot.files.find((f) => f.path === fileTabs.activePath)
    : undefined;

  const sortedReviewComments = useMemo(() => {
    return [...reviewSession.comments].sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) return pathCmp;
      if (a.line !== b.line) return a.line - b.line;
      return a.side.localeCompare(b.side);
    });
  }, [reviewSession.comments]);

  const commentedKeys = useMemo(
    () =>
      selectedFile
        ? commentedLineKeysForPath(reviewSession, selectedFile.path)
        : new Set<string>(),
    [reviewSession, selectedFile],
  );

  useEffect(() => {
    setOverviewIndex((i) =>
      Math.min(i, Math.max(0, sortedReviewComments.length - 1)),
    );
  }, [sortedReviewComments.length]);

  useEffect(() => {
    if (!notice) return;
    const handle = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(handle);
  }, [notice]);

  useEffect(() => {
    if (skipInitialReviewSaveRef.current) {
      skipInitialReviewSaveRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void persistSession(reviewPathRef.current, reviewSessionRef.current).catch(
        (err) => {
          setError(err instanceof Error ? err.message : String(err));
        },
      );
    }, 100);
    return () => clearTimeout(handle);
  }, [reviewSession]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      do {
        pendingRefreshRef.current = false;
        setError(null);
        const next = await loadDiffSnapshot(cwd, modeRef.current);
        setSnapshot(next);
        setCollapsedDirs((prev) => refreshCollapsedDirs(prev, next.files));
        fileTabs.prune(new Set(next.files.map((f) => f.path)));
      } while (pendingRefreshRef.current);
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
      if (editorOpenRef.current) {
        pendingRefreshRef.current = true;
        return;
      }
      void refresh();
    });
  }, [watch, snapshot.repoRoot, refresh]);

  useEffect(() => {
    if (!fileTabs.activePath) return;
    syncFileRowToActiveRef.current = true;
    setCollapsedDirs((prev) => {
      const next = expandDirsForPath(prev, fileTabs.activePath!);
      if (next.size === prev.size) {
        let unchanged = true;
        for (const dir of prev) {
          if (!next.has(dir)) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return prev;
      }
      return next;
    });
  }, [fileTabs.activePath]);

  useEffect(() => {
    if (syncFileRowToActiveRef.current && fileTabs.activePath) {
      const idx = visibleFileRows.findIndex(
        (row) =>
          row.node.kind === 'file' && row.node.path === fileTabs.activePath,
      );
      if (idx >= 0) {
        syncFileRowToActiveRef.current = false;
        setFileRowIndex(idx);
        return;
      }
    }
    // Expand/collapse inserts/removes rows around the highlight — keep the
    // same index when possible, only clamp if the list shrank.
    setFileRowIndex((i) => Math.min(i, Math.max(0, visibleFileRows.length - 1)));
  }, [visibleFileRows, fileTabs.activePath]);

  useEffect(() => {
    const prevPath = prevActivePathRef.current;
    if (prevPath) {
      tabViewsRef.current = rememberTabView(
        tabViewsRef.current,
        prevPath,
        viewStateRef.current,
      );
    }

    const nextPath = fileTabs.activePath;
    prevActivePathRef.current = nextPath;
    if (!nextPath) {
      setDiffScroll(0);
      setCursorLine(0);
      return;
    }

    const restored = recallTabView(tabViewsRef.current, nextPath);
    setCursorLine(restored.cursorLine);
    setDiffScroll(restored.diffScroll);
  }, [fileTabs.activePath]);

  useEffect(() => {
    tabViewsRef.current = pruneTabViews(
      tabViewsRef.current,
      new Set(fileTabs.tabs.map((t) => t.path)),
    );
  }, [fileTabs.tabs]);

  useEffect(() => {
    if (!selectedFile) {
      setDisplayLines([]);
      return;
    }

    let cancelled = false;
    setLoadingDiff(true);
    buildDisplayLines(selectedFile, snapshot.mode, snapshot.repoRoot)
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
  }, [selectedFile, snapshot.mode, snapshot.repoRoot]);

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
      setDiffScroll(
        centeredScrollOffset(lineIndex, diffHeight, displayLines.length),
      );
      setFocus('diff');
    },
    [diffHeight, displayLines.length],
  );

  const goToSearchMatch = useCallback(
    (match: SearchMatch | undefined) => {
      if (!match) return;

      if (match.filePath !== selectedFile?.path) {
        pendingSearchMatchRef.current = match;
        if (!snapshot.files.some((file) => file.path === match.filePath)) return;
        setCollapsedDirs((prev) => expandDirsForPath(prev, match.filePath));
        // Intentional: search jump pins so activePath stays the open-file source of truth.
        fileTabs.pin(match.filePath);
        setFocus('diff');
        return;
      }

      scrollToLine(match.lineIndex);
    },
    [fileTabs.pin, scrollToLine, selectedFile?.path, snapshot.files],
  );

  const goToChangeLocation = useCallback(
    (location: ChangeLocation | null) => {
      if (!location) return;

      if (location.filePath !== selectedFile?.path) {
        pendingChangeJumpRef.current = location;
        if (!snapshot.files.some((file) => file.path === location.filePath)) {
          return;
        }
        setCollapsedDirs((prev) => expandDirsForPath(prev, location.filePath));
        fileTabs.pin(location.filePath);
        setFocus('diff');
        return;
      }

      scrollToLine(location.lineIndex);
    },
    [fileTabs.pin, scrollToLine, selectedFile?.path, snapshot.files],
  );

  const jumpChangeBlock = useCallback(
    (direction: 1 | -1) => {
      if (changeNavBusyRef.current) return;
      changeNavBusyRef.current = true;
      const find =
        direction === 1 ? findNextGlobalChangeBlock : findPrevGlobalChangeBlock;
      void find(
        filesInTreeOrder,
        snapshot.mode,
        snapshot.repoRoot,
        selectedFile?.path ?? null,
        cursorLine,
        displayLines,
      )
        .then((location) => {
          goToChangeLocation(location);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          changeNavBusyRef.current = false;
        });
    },
    [
      cursorLine,
      displayLines,
      filesInTreeOrder,
      goToChangeLocation,
      selectedFile?.path,
      snapshot.mode,
      snapshot.repoRoot,
    ],
  );

  const findLineIndexForComment = useCallback(
    (comment: ReviewComment, lines: DisplayLine[]): number => {
      for (let i = 0; i < lines.length; i++) {
        const target = resolveLineTarget(lines[i]!);
        if (
          target &&
          target.side === comment.side &&
          target.line === comment.line
        ) {
          return i;
        }
      }
      return -1;
    },
    [],
  );

  const goToReviewComment = useCallback(
    (comment: ReviewComment | undefined) => {
      if (!comment) return;
      setOverviewOpen(false);

      if (comment.path !== selectedFile?.path) {
        pendingReviewJumpRef.current = comment;
        if (!snapshot.files.some((file) => file.path === comment.path)) {
          setError(`File not in current diff: ${comment.path}`);
          return;
        }
        setCollapsedDirs((prev) => expandDirsForPath(prev, comment.path));
        fileTabs.pin(comment.path);
        setFocus('diff');
        return;
      }

      const index = findLineIndexForComment(comment, displayLines);
      if (index < 0) {
        setError(`Line L${comment.line} (${comment.side}) not visible in diff`);
        return;
      }
      scrollToLine(index);
    },
    [
      displayLines,
      fileTabs.pin,
      findLineIndexForComment,
      scrollToLine,
      selectedFile?.path,
      snapshot.files,
    ],
  );

  useEffect(() => {
    const pending = pendingReviewJumpRef.current;
    if (!pending || loadingDiff) return;
    if (selectedFile?.path !== pending.path || displayLines.length === 0) return;
    pendingReviewJumpRef.current = null;
    const index = findLineIndexForComment(pending, displayLines);
    if (index < 0) {
      setError(`Line L${pending.line} (${pending.side}) not visible in diff`);
      return;
    }
    scrollToLine(index);
  }, [
    displayLines,
    findLineIndexForComment,
    loadingDiff,
    scrollToLine,
    selectedFile?.path,
  ]);

  const quitApp = useCallback(() => {
    const session = reviewSessionRef.current;
    void persistSession(reviewPathRef.current, session)
      .catch(() => {
        /* best-effort; still quit */
      })
      .finally(() => {
        onQuitReviewRef.current?.({
          terminal: formatReviewTerminal(session),
          plain: compileReview(session),
        });
        exit();
      });
  }, [exit]);

  const openCommentEditor = useCallback(() => {
    if (!selectedFile) {
      setError('Select a file to comment');
      return;
    }
    const line = displayLines[cursorLine];
    if (!line) return;
    const target = resolveLineTarget(line);
    if (!target) {
      setError('Cannot comment on this line');
      return;
    }
    const existing = findComment(
      reviewSessionRef.current,
      selectedFile.path,
      target.side,
      target.line,
    );
    setCommentDraft(existing?.body ?? '');
    setCommentEditing(Boolean(existing));
    setCommentOpen(true);
    setSearchOpen(false);
    setGoToLineOpen(false);
    setOverviewOpen(false);
    setThemeMenuOpen(false);
    setBgPickerOpen(false);
    setHlPickerOpen(false);
    setError(null);
  }, [cursorLine, displayLines, selectedFile]);

  const openGoToLine = useCallback(() => {
    if (!selectedFile || displayLines.length === 0) {
      setError('Select a file to go to a line');
      return;
    }
    setGoToLineDraft('');
    setGoToLineOpen(true);
    setCommentOpen(false);
    setSearchOpen(false);
    setOverviewOpen(false);
    setThemeMenuOpen(false);
    setBgPickerOpen(false);
    setHlPickerOpen(false);
    setError(null);
  }, [displayLines.length, selectedFile]);

  const openThemeMenu = useCallback(() => {
    setThemeMenuOpen(true);
    setThemeMenuIndex(0);
    setBgPickerOpen(false);
    setHlPickerOpen(false);
    setCommentOpen(false);
    setGoToLineOpen(false);
    setOverviewOpen(false);
    setSearchOpen(false);
  }, []);

  const openBgPicker = useCallback(() => {
    const index = Math.max(
      0,
      DIFF_BG_PALETTES.findIndex((p) => p.id === diffBgPaletteId),
    );
    setBgPickerSavedId(diffBgPaletteId);
    setBgPickerIndex(index);
    setBgPickerOpen(true);
    setThemeMenuOpen(false);
    setHlPickerOpen(false);
    setCommentOpen(false);
    setGoToLineOpen(false);
    setOverviewOpen(false);
    setSearchOpen(false);
  }, [diffBgPaletteId]);

  const openHlPicker = useCallback(() => {
    const index = Math.max(
      0,
      HIGHLIGHT_SCHEMAS.findIndex((s) => s.id === highlightSchemaId),
    );
    setHlPickerSavedId(highlightSchemaId);
    setHlPickerIndex(index);
    setHlPickerOpen(true);
    setThemeMenuOpen(false);
    setBgPickerOpen(false);
    setCommentOpen(false);
    setGoToLineOpen(false);
    setOverviewOpen(false);
    setSearchOpen(false);
  }, [highlightSchemaId]);

  const returnToThemeMenu = useCallback(() => {
    setBgPickerOpen(false);
    setHlPickerOpen(false);
    setThemeMenuOpen(true);
  }, []);

  const copyAgentFileRef = useCallback(() => {
    if (!selectedFile) {
      setNotice(null);
      setError('Select a file to copy');
      return;
    }

    const line = displayLines[cursorLine];
    const target = line ? resolveLineTarget(line) : null;
    if (!target) {
      setNotice(null);
      setError(
        displayLines.length === 0
          ? 'No diff lines to copy'
          : 'Cannot copy line from this row',
      );
      return;
    }

    const ref = formatAgentFileRef(selectedFile.path, target.line);
    void copyToClipboard(ref).then((ok) => {
      if (ok) {
        setError(null);
        setNotice(`Copied ${ref}`);
      } else {
        setNotice(null);
        setError(`Could not copy to clipboard.${clipboardInstallHint()}`);
      }
    });
  }, [cursorLine, displayLines, selectedFile]);

  const openInExternalEditor = useCallback(async () => {
    if (editorOpenRef.current) return;

    if (!selectedFile) {
      setNotice(null);
      setError('Select a file to edit');
      return;
    }
    if (selectedFile.isBinary) {
      setNotice(null);
      setError('Cannot edit a binary file');
      return;
    }
    if (selectedFile.status === 'deleted') {
      setNotice(null);
      setError('Cannot edit a deleted file');
      return;
    }

    const absPath = join(snapshot.repoRoot, selectedFile.path);
    try {
      await access(absPath);
    } catch {
      setNotice(null);
      setError(`File not found: ${selectedFile.path}`);
      return;
    }

    const line = workingTreeLineForEdit(displayLines[cursorLine]);
    editorOpenRef.current = true;
    setError(null);
    setNotice(null);

    const result = await runExternalEditor({
      filePath: absPath,
      line,
      onBeforeSpawn: () => {
        stdout.write(DISABLE_MOUSE);
        stdout.write('\x1b[?25h'); // show cursor for the editor
        if (isRawModeSupported) setRawMode(false);
      },
      onAfterSpawn: () => {
        if (isRawModeSupported) setRawMode(true);
        stdout.write('\x1b[?25l');
        stdout.write(ENABLE_MOUSE);
      },
    });

    editorOpenRef.current = false;

    if (!result.ok) {
      setNotice(null);
      setError(result.error);
    }

    // Force a full redraw after the editor trashed the screen, then reload.
    setScreenEpoch((n) => n + 1);
    await refresh();
  }, [
    cursorLine,
    displayLines,
    isRawModeSupported,
    refresh,
    selectedFile,
    setRawMode,
    snapshot.repoRoot,
    stdout,
  ]);

  const submitGoToLine = useCallback(() => {
    const trimmed = goToLineDraft.trim();
    setGoToLineOpen(false);
    setGoToLineDraft('');
    if (!trimmed) return;

    const lineNo = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(lineNo) || lineNo < 1) {
      setError('Enter a positive line number');
      return;
    }

    const index = findDisplayLineIndexByNumber(displayLines, lineNo);
    if (index < 0) {
      setError(`Line ${lineNo} not visible in diff`);
      return;
    }
    setError(null);
    scrollToLine(index);
  }, [displayLines, goToLineDraft, scrollToLine]);

  const saveCommentDraft = useCallback(() => {
    if (!selectedFile) {
      setCommentOpen(false);
      return;
    }
    const line = displayLines[cursorLine];
    if (!line) {
      setCommentOpen(false);
      return;
    }
    const target = resolveLineTarget(line);
    if (!target) {
      setCommentOpen(false);
      return;
    }
    setReviewSession((session) =>
      upsertComment(session, {
        path: selectedFile.path,
        side: target.side,
        line: target.line,
        body: commentDraft,
        snippet: target.snippet,
        otherLine: target.otherLine,
      }),
    );
    setCommentOpen(false);
    setCommentDraft('');
  }, [commentDraft, cursorLine, displayLines, selectedFile]);

  useEffect(() => {
    const pending = pendingSearchMatchRef.current;
    if (!pending || loadingDiff) return;
    if (selectedFile?.path !== pending.filePath || displayLines.length === 0) return;
    pendingSearchMatchRef.current = null;
    scrollToLine(pending.lineIndex);
  }, [displayLines, loadingDiff, scrollToLine, selectedFile?.path]);

  useEffect(() => {
    const pending = pendingChangeJumpRef.current;
    if (!pending || loadingDiff) return;
    if (selectedFile?.path !== pending.filePath || displayLines.length === 0) return;
    pendingChangeJumpRef.current = null;
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
    setCursorLine((c) =>
      Math.min(c, Math.max(0, displayLines.length - 1)),
    );
  }, [displayLines.length, maxFileScroll, maxDiffScroll]);

  const selectFileRow = useCallback(
    (nextRow: number, openDiff = false) => {
      if (nextRow < 0 || nextRow >= visibleFileRows.length) return;
      setFocus(openDiff ? 'diff' : 'files');
      setFileRowIndex(nextRow);
      const row = visibleFileRows[nextRow];
      if (row?.node.kind === 'file') {
        fileTabs.preview(row.node.path);
      }
    },
    [fileTabs.preview, visibleFileRows],
  );

  const openSearch = useCallback((scope: SearchScope, query = '') => {
    setSearchScope(scope);
    setSearchOpen(true);
    setSearchQuery(query);
    setSearchMatchIndex(0);
    setAllSearchMatches([]);
    setGoToLineOpen(false);
    setCommentOpen(false);
    setThemeMenuOpen(false);
    setBgPickerOpen(false);
    setHlPickerOpen(false);
    setFocus('diff');
  }, []);

  const searchWord = useCallback(
    (word: string) => {
      if (searchOpen) {
        setSearchQuery(word);
        setSearchMatchIndex(0);
        return;
      }
      openSearch('file', word);
    },
    [openSearch, searchOpen],
  );

  const handleMouseEvent = useCallback(
    (event: MouseEvent) => {
      if (editorOpenRef.current) return;
      if (event.kind === 'wheel') {
        const delta =
          event.direction === 'down' ? WHEEL_SCROLL_LINES : -WHEEL_SCROLL_LINES;

        if (
          event.x >= 1 &&
          event.x <= filePaneWidth &&
          event.y >= 1 + fileHeaderHeight &&
          event.y <= fileHeaderHeight + fileListHeight
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
        splitDragRef.current = false;
        return;
      }

      if (event.kind === 'drag') {
        if (splitDragRef.current) {
          setFilePaneWidthUser(clampFilePaneWidth(event.x, columns));
          return;
        }
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

      if (
        !overviewOpen &&
        !leftPickerOpen &&
        filePaneWidth > 0 &&
        isSplitBorderHit(event.x, event.y, filePaneWidth, contentHeight)
      ) {
        splitDragRef.current = true;
        setFilePaneWidthUser(clampFilePaneWidth(event.x, columns));
        return;
      }

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

        setCollapsedDirs((prev) => expandDirsForPath(prev, hit.path));
        ensureFileVisibleRef.current = hit.path;
        setFocus('diff');
        return;
      }

      if (
        event.x > filePaneWidth &&
        event.x <= filePaneWidth + diffPaneWidth &&
        event.y >= 1 + tabBarHeight &&
        event.y <= contentHeight
      ) {
        setFocus('diff');
        if (displayLines.length === 0) return;
        const lineIndex = event.y - 1 - tabBarHeight + diffScroll;
        if (lineIndex < 0 || lineIndex >= displayLines.length) return;
        setCursorLine(lineIndex);

        const line = displayLines[lineIndex];
        if (!line || !isSearchableLine(line)) return;

        const paneX = event.x - filePaneWidth - 1;
        const chrome = scrollBarChromeWidth(
          needsScrollBar(displayLines.length, diffHeight),
        );
        const linesWidth = Math.max(10, diffPaneWidth - chrome);
        const contentWidth = Math.max(10, linesWidth - DIFF_GUTTER_WIDTH);
        const contentCol = paneX - DIFF_GUTTER_WIDTH;
        if (contentCol < 0 || contentCol >= contentWidth) return;
        if (
          line.content.length > contentWidth &&
          contentCol >= contentWidth - 1
        ) {
          return;
        }

        const hit = wordAtColumn(line.content, contentCol);
        if (!hit) return;

        const { state, isDouble } = registerClick(
          doubleClickRef.current,
          `word:${lineIndex}:${hit.start}`,
          Date.now(),
        );
        doubleClickRef.current = state;
        if (isDouble) {
          searchWord(hit.word);
        }
        return;
      }

      if (
        event.x < 1 ||
        event.x > filePaneWidth ||
        event.y < 1 + fileHeaderHeight ||
        event.y > fileHeaderHeight + fileListHeight
      ) {
        return;
      }

      const rowIndex = event.y - 1 - fileHeaderHeight + fileScroll;
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
      columns,
      contentHeight,
      diffHeight,
      diffPaneWidth,
      diffScroll,
      displayLines,
      fileHeaderHeight,
      fileListHeight,
      filePaneWidth,
      fileScroll,
      fileTabs.activate,
      fileTabs.close,
      fileTabs.pin,
      fileTabs.tabs,
      leftPickerOpen,
      maxDiffScroll,
      maxFileScroll,
      overviewOpen,
      scrollBarLayout,
      searchWord,
      selectFileRow,
      tabBarHeight,
      visibleFileRows,
    ],
  );

  useMouse(handleMouseEvent);

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
    if (editorOpenRef.current) return;
    if (input.startsWith('\x1b[<')) return;

    if (commentOpen) {
      if (key.escape) {
        setCommentOpen(false);
        setCommentDraft('');
        return;
      }
      if (key.return) {
        saveCommentDraft();
        return;
      }
      if (key.backspace || key.delete) {
        setCommentDraft((draft) => draft.slice(0, -1));
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta && input >= ' ') {
        setCommentDraft((draft) => draft + input);
        return;
      }
      return;
    }

    if (goToLineOpen) {
      if (key.escape) {
        setGoToLineOpen(false);
        setGoToLineDraft('');
        return;
      }
      if (key.return) {
        submitGoToLine();
        return;
      }
      if (key.backspace || key.delete) {
        setGoToLineDraft((draft) => draft.slice(0, -1));
        return;
      }
      if (input.length === 1 && input >= '0' && input <= '9') {
        setGoToLineDraft((draft) => draft + input);
        return;
      }
      return;
    }

    if (overviewOpen) {
      if (key.escape || input === 'o') {
        setOverviewOpen(false);
        return;
      }
      if (input === 'q' || (key.ctrl && input === 'c')) {
        quitApp();
        return;
      }
      if (key.downArrow) {
        if (sortedReviewComments.length === 0) return;
        setOverviewIndex((i) =>
          Math.min(sortedReviewComments.length - 1, i + 1),
        );
        return;
      }
      if (key.upArrow) {
        if (sortedReviewComments.length === 0) return;
        setOverviewIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.return) {
        goToReviewComment(sortedReviewComments[overviewIndex]);
        return;
      }
      return;
    }

    if (bgPickerOpen) {
      if (key.escape) {
        setDiffBgPaletteId(bgPickerSavedId);
        returnToThemeMenu();
        return;
      }
      if (key.return) {
        const chosen = DIFF_BG_PALETTES[bgPickerIndex];
        if (chosen) {
          setDiffBgPaletteId(chosen.id);
          void saveUserConfig({
            diffBgPaletteId: chosen.id,
            highlightSchemaId,
          }).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }
        setBgPickerOpen(false);
        return;
      }
      if (key.downArrow) {
        setBgPickerIndex((i) => Math.min(DIFF_BG_PALETTES.length - 1, i + 1));
        return;
      }
      if (key.upArrow) {
        setBgPickerIndex((i) => Math.max(0, i - 1));
        return;
      }
      return;
    }

    if (hlPickerOpen) {
      if (key.escape) {
        setHighlightSchemaId(hlPickerSavedId);
        returnToThemeMenu();
        return;
      }
      if (key.return) {
        const chosen = HIGHLIGHT_SCHEMAS[hlPickerIndex];
        if (chosen) {
          setHighlightSchemaId(chosen.id);
          void saveUserConfig({
            diffBgPaletteId,
            highlightSchemaId: chosen.id,
          }).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }
        setHlPickerOpen(false);
        return;
      }
      if (key.downArrow) {
        setHlPickerIndex((i) => Math.min(HIGHLIGHT_SCHEMAS.length - 1, i + 1));
        return;
      }
      if (key.upArrow) {
        setHlPickerIndex((i) => Math.max(0, i - 1));
        return;
      }
      return;
    }

    if (themeMenuOpen) {
      if (key.escape || input === 't') {
        setThemeMenuOpen(false);
        return;
      }
      if (key.downArrow) {
        setThemeMenuIndex((i) =>
          Math.min(THEME_MENU_ITEMS.length - 1, i + 1),
        );
        return;
      }
      if (key.upArrow) {
        setThemeMenuIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (input === 'b') {
        openBgPicker();
        return;
      }
      if (input === 'h') {
        openHlPicker();
        return;
      }
      if (key.return) {
        const item = THEME_MENU_ITEMS[themeMenuIndex];
        if (item?.id === 'bg') openBgPicker();
        else if (item?.id === 'syntax') openHlPicker();
        return;
      }
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
      if (key.downArrow) {
        stepSearchMatch(1);
        return;
      }
      if (key.upArrow) {
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
      quitApp();
      return;
    }

    if (input === 'f') {
      openSearch('file');
      return;
    }

    if (input === 'o') {
      setOverviewOpen(true);
      setOverviewIndex(0);
      setCommentOpen(false);
      setGoToLineOpen(false);
      setThemeMenuOpen(false);
      setBgPickerOpen(false);
      setHlPickerOpen(false);
      return;
    }

    if (input === 't') {
      openThemeMenu();
      return;
    }

    if (input === 'r') {
      void refresh();
      return;
    }

    if (input === 'l') {
      copyAgentFileRef();
      return;
    }

    if (input === 'e') {
      void openInExternalEditor();
      return;
    }

    if (input === 'w' && fileTabs.tabs.length > 0) {
      fileTabs.close();
      return;
    }

    if (key.tab) {
      if (focus === 'files') {
        setFocus('diff');
      } else {
        if (filePaneCollapsed) setFilePaneCollapsed(false);
        setFocus('files');
      }
      return;
    }

    if (input === 'h') {
      if (!filePaneCollapsed && focus === 'files' && !leftPickerOpen) {
        setFocus('diff');
      }
      setFilePaneCollapsed((collapsed) => !collapsed);
      return;
    }

    if ((key.shift && key.downArrow) || input === 'j') {
      jumpChangeBlock(1);
      return;
    }
    if ((key.shift && key.upArrow) || input === 'k') {
      jumpChangeBlock(-1);
      return;
    }

    if (focus === 'files') {
      const currentRow = visibleFileRows[fileRowIndex];

      if (input === 'd') {
        setShowUnedited((show) => !show);
        syncFileRowToActiveRef.current = true;
        return;
      }

      const selectRow = (nextRow: number, openDiff = false) => {
        selectFileRow(nextRow, openDiff);
      };

      if (key.downArrow) {
        if (visibleFileRows.length === 0) return;
        const next = Math.min(visibleFileRows.length - 1, fileRowIndex + 1);
        selectRow(next);
        if (next >= fileScroll + fileListHeight) {
          setFileScroll((s) => Math.min(maxFileScroll, s + 1));
        }
      } else if (key.upArrow) {
        if (visibleFileRows.length === 0) return;
        const next = Math.max(0, fileRowIndex - 1);
        selectRow(next);
        if (next < fileScroll) {
          setFileScroll((s) => Math.max(0, s - 1));
        }
      } else if (
        key.leftArrow &&
        currentRow?.node.kind === 'dir' &&
        !collapsedDirs.has(currentRow.node.path)
      ) {
        setCollapsedDirs((prev) => new Set(prev).add(currentRow.node.path));
      } else if (
        key.rightArrow &&
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
      } else if (
        key.rightArrow ||
        (currentRow?.node.kind === 'file' && input === ' ')
      ) {
        selectRow(fileRowIndex, true);
      }
      return;
    }

    // diff focus
    if (input === 'c') {
      openCommentEditor();
      return;
    }

    if (input === 'g') {
      openGoToLine();
      return;
    }

    if (key.downArrow) {
      setCursorLine((c) => {
        const next = Math.min(displayLines.length - 1, c + 1);
        if (next >= diffScroll + diffHeight) {
          setDiffScroll((s) => Math.min(maxDiffScroll, s + 1));
        }
        return next;
      });
    } else if (key.upArrow) {
      setCursorLine((c) => {
        const next = Math.max(0, c - 1);
        if (next < diffScroll) {
          setDiffScroll((s) => Math.max(0, s - 1));
        }
        return next;
      });
    } else if (key.pageDown) {
      const pageSize = Math.max(1, diffHeight);
      setCursorLine((c) => Math.min(displayLines.length - 1, c + pageSize));
      setDiffScroll((s) => Math.min(maxDiffScroll, s + pageSize));
    } else if (key.pageUp) {
      const pageSize = Math.max(1, diffHeight);
      setCursorLine((c) => Math.max(0, c - pageSize));
      setDiffScroll((s) => Math.max(0, s - pageSize));
    } else if (key.leftArrow) {
      if (fileTabs.tabs.length === 0) {
        setFocus('files');
        return;
      }
      const index = fileTabs.tabs.findIndex((t) => t.path === fileTabs.activePath);
      if (index <= 0) {
        setFocus('files');
        return;
      }
      fileTabs.activateRelative(-1);
    } else if (key.rightArrow) {
      fileTabs.activateRelative(1);
    } else if (key.return && fileTabs.activePath) {
      fileTabs.pin(fileTabs.activePath);
    }
  });

  return (
    <Box key={screenEpoch} flexDirection="column" width={columns} height={rows}>
      {overviewOpen ? (
        <ReviewOverview
          comments={sortedReviewComments}
          selectedIndex={overviewIndex}
          height={contentHeight}
          width={columns}
          theme={theme}
          branch={reviewSession.branch}
          date={reviewSession.date}
        />
      ) : (
        <Box flexDirection="row" height={contentHeight}>
          {filePaneWidth > 0 ? (
            <Box flexDirection="column" width={filePaneWidth} height={contentHeight}>
              {themeMenuOpen ? (
                <ThemeMenu
                  selectedIndex={themeMenuIndex}
                  height={contentHeight}
                  width={filePaneWidth}
                  theme={theme}
                  bgLabel={findDiffBgPalette(diffBgPaletteId).label}
                  syntaxLabel={findHighlightSchema(highlightSchemaId).label}
                />
              ) : bgPickerOpen ? (
                <DiffBgPicker
                  selectedIndex={bgPickerIndex}
                  height={contentHeight}
                  width={filePaneWidth}
                  theme={theme}
                  activePaletteId={bgPickerSavedId}
                />
              ) : hlPickerOpen ? (
                <HighlightSchemaPicker
                  selectedIndex={hlPickerIndex}
                  height={contentHeight}
                  width={filePaneWidth}
                  theme={theme}
                  activeSchemaId={hlPickerSavedId}
                />
              ) : (
                <>
                  <RepoBar name={repoName} width={filePaneWidth} theme={theme} />
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
                </>
              )}
            </Box>
          ) : null}
          <Box flexDirection="column" width={diffPaneWidth} height={contentHeight}>
            <TabBar
              tabs={fileTabs.tabs}
              activePath={fileTabs.activePath}
              contentFocused={focus === 'diff'}
              width={diffPaneWidth}
              theme={theme}
            />
            <DiffView
              lines={loadingDiff ? [{ kind: 'binary', content: 'Loading…' }] : displayLines}
              scrollOffset={diffScroll}
              cursorLine={cursorLine}
              height={diffHeight}
              width={diffPaneWidth}
              focused={
                focus === 'diff' &&
                !searchOpen &&
                !commentOpen &&
                !goToLineOpen &&
                !themeMenuOpen &&
                !bgPickerOpen &&
                !hlPickerOpen
              }
              theme={theme}
              highlightCache={highlightCache ?? undefined}
              highlightSchemaId={activeHighlightSchemaId}
              searchQuery={searchOpen ? searchQuery : undefined}
              searchMatchLines={currentFileSearchLines}
              activeSearchLine={activeSearchLine}
              commentedKeys={commentedKeys}
              emptyMessage={
                selectedFile && !isEditedFile(selectedFile)
                  ? 'No changes'
                  : 'Select a file to view its diff'
              }
            />
          </Box>
        </Box>
      )}
      {commentOpen ? (
        <CommentBar
          draft={commentDraft}
          editing={commentEditing}
          theme={theme}
          width={columns}
        />
      ) : goToLineOpen ? (
        <GoToLineBar draft={goToLineDraft} theme={theme} width={columns} />
      ) : searchOpen ? (
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
          error={error}
          notice={notice}
          theme={theme}
          width={columns}
          watching={watch}
          refreshing={refreshing}
          themeMenuOpen={themeMenuOpen}
          bgPickerOpen={bgPickerOpen}
          hlPickerOpen={hlPickerOpen}
          showUnedited={showUnedited}
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

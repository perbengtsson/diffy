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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileScroll, setFileScroll] = useState(0);
  const [diffScroll, setDiffScroll] = useState(0);
  const [cursorLine, setCursorLine] = useState(0);
  const [focus, setFocus] = useState<Focus>('files');
  const [expansions, setExpansions] = useState<Map<string, HunkExpansion>>(new Map());
  const [displayLines, setDisplayLines] = useState<DisplayLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedPathRef = useRef<string | undefined>(initialSnapshot.files[0]?.path);
  const refreshingRef = useRef(false);
  const modeRef = useRef(initialSnapshot.mode);
  modeRef.current = snapshot.mode;

  const filePaneWidth = Math.max(20, Math.min(32, Math.floor(columns * 0.28)));
  const diffPaneWidth = Math.max(30, columns - filePaneWidth - 1);
  const contentHeight = Math.max(5, rows - 2);

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
      if (prevPath) {
        const idx = next.files.findIndex((f) => f.path === prevPath);
        setSelectedIndex((i) => (idx >= 0 ? idx : Math.min(i, Math.max(0, next.files.length - 1))));
      } else {
        setSelectedIndex((i) => Math.min(i, Math.max(0, next.files.length - 1)));
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

  const maxFileScroll = Math.max(0, snapshot.files.length - (contentHeight - 1));
  const maxDiffScroll = Math.max(0, displayLines.length - (contentHeight - 1));

  useEffect(() => {
    setFileScroll((s) => Math.min(s, maxFileScroll));
    setDiffScroll((s) => Math.min(s, maxDiffScroll));
  }, [maxFileScroll, maxDiffScroll]);

  useInput((input, key) => {
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
      if (input === 'j' || key.downArrow) {
        setSelectedIndex((i) => {
          const next = Math.min(snapshot.files.length - 1, i + 1);
          if (next >= fileScroll + contentHeight - 1) {
            setFileScroll((s) => Math.min(maxFileScroll, s + 1));
          }
          return next;
        });
      } else if (input === 'k' || key.upArrow) {
        setSelectedIndex((i) => {
          const next = Math.max(0, i - 1);
          if (next < fileScroll) {
            setFileScroll((s) => Math.max(0, s - 1));
          }
          return next;
        });
      } else if (input === 'l' || key.rightArrow || key.return) {
        setFocus('diff');
      }
      return;
    }

    // diff focus
    if (input === 'j' || key.downArrow) {
      setCursorLine((c) => {
        const next = Math.min(displayLines.length - 1, c + 1);
        if (next >= diffScroll + contentHeight - 1) {
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
      setDiffScroll(Math.max(0, displayLines.length - (contentHeight - 1)));
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
          files={snapshot.files}
          selectedIndex={selectedIndex}
          scrollOffset={fileScroll}
          height={contentHeight}
          width={filePaneWidth}
          focused={focus === 'files'}
          theme={theme}
        />
        <DiffView
          lines={loadingDiff ? [{ kind: 'binary', content: 'Loading…' }] : displayLines}
          scrollOffset={diffScroll}
          cursorLine={cursorLine}
          height={contentHeight}
          width={diffPaneWidth}
          focused={focus === 'diff'}
          theme={theme}
          filePath={selectedFile?.path ?? ''}
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

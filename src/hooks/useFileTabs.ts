import { useCallback, useState } from 'react';
import {
  EMPTY_FILE_TABS,
  activate as activateTab,
  activateRelative as activateRelativeTab,
  close as closeTab,
  pin as pinTab,
  preview as previewTab,
  prune as pruneTabs,
  type FileTab,
  type FileTabsState,
} from '../files/tabs.js';

export type UseFileTabs = {
  tabs: FileTab[];
  activePath: string | null;
  preview: (path: string) => void;
  pin: (path: string) => void;
  activate: (path: string) => void;
  activateRelative: (delta: -1 | 1) => void;
  close: (path?: string) => void;
  prune: (existingPaths: ReadonlySet<string>) => void;
};

export function useFileTabs(
  initial: FileTabsState = EMPTY_FILE_TABS,
): UseFileTabs {
  const [state, setState] = useState<FileTabsState>(initial);

  const preview = useCallback((path: string) => {
    setState((s) => previewTab(s, path));
  }, []);

  const pin = useCallback((path: string) => {
    setState((s) => pinTab(s, path));
  }, []);

  const activate = useCallback((path: string) => {
    setState((s) => activateTab(s, path));
  }, []);

  const activateRelative = useCallback((delta: -1 | 1) => {
    setState((s) => activateRelativeTab(s, delta));
  }, []);

  const close = useCallback((path?: string) => {
    setState((s) => closeTab(s, path));
  }, []);

  const prune = useCallback((existingPaths: ReadonlySet<string>) => {
    setState((s) => pruneTabs(s, existingPaths));
  }, []);

  return {
    tabs: state.tabs,
    activePath: state.activePath,
    preview,
    pin,
    activate,
    activateRelative,
    close,
    prune,
  };
}

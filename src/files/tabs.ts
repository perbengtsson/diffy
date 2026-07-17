export type FileTab = { path: string; pinned: boolean };

export type FileTabsState = {
  tabs: FileTab[];
  activePath: string | null;
};

export const EMPTY_FILE_TABS: FileTabsState = { tabs: [], activePath: null };

function withActive(tabs: FileTab[], activePath: string | null): FileTabsState {
  return { tabs, activePath };
}

export function preview(state: FileTabsState, path: string): FileTabsState {
  const existing = state.tabs.find((t) => t.path === path);
  if (existing?.pinned) {
    return withActive(state.tabs, path);
  }

  // Preview is always leftmost; pinned tabs keep their relative order.
  const pinned = state.tabs.filter((t) => t.pinned);
  return withActive([{ path, pinned: false }, ...pinned], path);
}

export function pin(state: FileTabsState, path: string): FileTabsState {
  const index = state.tabs.findIndex((t) => t.path === path);
  if (index >= 0) {
    const tabs = state.tabs.slice();
    tabs[index] = { path, pinned: true };
    return withActive(tabs, path);
  }
  return withActive([...state.tabs, { path, pinned: true }], path);
}

export function activate(state: FileTabsState, path: string): FileTabsState {
  if (!state.tabs.some((t) => t.path === path)) return state;
  return withActive(state.tabs, path);
}

/** Move active tab by `delta` (-1 left, +1 right). No-op at edges or if none active. */
export function activateRelative(
  state: FileTabsState,
  delta: -1 | 1,
): FileTabsState {
  if (state.tabs.length === 0 || !state.activePath) return state;
  const index = state.tabs.findIndex((t) => t.path === state.activePath);
  if (index < 0) return state;
  const next = index + delta;
  if (next < 0 || next >= state.tabs.length) return state;
  return withActive(state.tabs, state.tabs[next]!.path);
}

export function close(state: FileTabsState, path?: string): FileTabsState {
  const target = path ?? state.activePath;
  if (!target) return state;

  const index = state.tabs.findIndex((t) => t.path === target);
  if (index < 0) return state;

  const tabs = state.tabs.filter((t) => t.path !== target);
  if (tabs.length === 0) return EMPTY_FILE_TABS;

  if (state.activePath !== target) {
    return withActive(tabs, state.activePath);
  }

  const next = tabs[index] ?? tabs[index - 1] ?? null;
  return withActive(tabs, next?.path ?? null);
}

export function prune(
  state: FileTabsState,
  existingPaths: ReadonlySet<string>,
): FileTabsState {
  const tabs = state.tabs.filter((t) => existingPaths.has(t.path));
  if (tabs.length === 0) return EMPTY_FILE_TABS;

  if (state.activePath && existingPaths.has(state.activePath)) {
    return withActive(tabs, state.activePath);
  }

  const oldIndex = state.tabs.findIndex((t) => t.path === state.activePath);
  const next = tabs[Math.min(Math.max(oldIndex, 0), tabs.length - 1)] ?? tabs[0];
  return withActive(tabs, next.path);
}

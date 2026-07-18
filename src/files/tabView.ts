export type TabViewState = {
  cursorLine: number;
  diffScroll: number;
};

export function emptyTabView(): TabViewState {
  return { cursorLine: 0, diffScroll: 0 };
}

export function cloneTabView(view: TabViewState): TabViewState {
  return {
    cursorLine: view.cursorLine,
    diffScroll: view.diffScroll,
  };
}

export function rememberTabView(
  store: Map<string, TabViewState>,
  path: string,
  view: TabViewState,
): Map<string, TabViewState> {
  const next = new Map(store);
  next.set(path, cloneTabView(view));
  return next;
}

export function recallTabView(
  store: Map<string, TabViewState>,
  path: string,
): TabViewState {
  const saved = store.get(path);
  return saved ? cloneTabView(saved) : emptyTabView();
}

export function pruneTabViews(
  store: Map<string, TabViewState>,
  openPaths: ReadonlySet<string>,
): Map<string, TabViewState> {
  let changed = false;
  const next = new Map<string, TabViewState>();
  for (const [path, view] of store) {
    if (openPaths.has(path)) {
      next.set(path, view);
    } else {
      changed = true;
    }
  }
  return changed ? next : store;
}

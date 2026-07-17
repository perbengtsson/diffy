# File tabs (preview + pinned) — Design

## Goal

Add a top tab bar on the right (diff) pane so the current file appears as a tab. Navigation creates a temporary **preview** tab; **Enter**, **double-click on a file**, or **double-click on the preview tab** makes it **persistent**. Clicking a tab selects that file in the files view and shows its diff.

## Approach

**`useFileTabs` hook + presentational `TabBar` component.** Tab state and rules live in the hook; `App` wires selection/mouse/keyboard into it; `TabBar` only renders and reports clicks.

## Layout & visuals

- One-row tab bar at the **top of the right pane only** (above `DiffView`).
- Diff content height shrinks by 1 row; left file pane and bottom status bar unchanged.
- Tab label: **basename** (full path remains in the status bar).
- **Preview** tab: dim (`dimColor`).
- **Pinned** tabs: normal weight.
- **Active** tab: selected background/foreground (same idea as file-list selection).
- Optional `×` after each tab for mouse close.
- Overflow: truncate labels and clip the row. No overflow menu in v1.

## Tab model

Owned by `useFileTabs`:

- At most **one** preview (unpinned) tab.
- Any number of pinned tabs.
- `activePath` is the open file (may be `null` when no tabs remain).
- API shape: `preview(path)`, `pin(path)`, `activate(path)`, `close(path?)`, `prune(existingPaths)`, plus derived `tabs` / `activePath`.

Each tab: `{ path: string; pinned: boolean }`.

Ordering: the preview tab is always **leftmost**; pinned tabs keep insertion order to its right. Replacing a preview updates the leftmost slot. Pin upgrades in place.

Open file: the diff pane’s open file is `activePath` from the hook. When there are no tabs, there is no open file (`activePath` is `null`) even if the file list still has a cursor row — `App` must not treat the cursor row alone as the open file for diff/tabs.

## Behavior

| Action | Result |
|--------|--------|
| Arrow / single-click file selection | Show file as **preview** (replaces previous preview). If path is already pinned, activate only. |
| Enter on file | **Pin** tab and show/focus diff (same focus behavior as today). |
| Double-click file | **Pin** tab and show/focus diff. |
| Double-click preview tab | **Pin** that tab. |
| Space / right-arrow on file | Unchanged: open/focus diff; **do not** pin. |
| Click tab | Activate tab; sync file-tree selection, expand dirs, scroll into view; show diff. Preview/pinned status unchanged. |
| `w` | Close active tab. |
| Click `×` | Close that tab (even if not active). |

### Close semantics

- Closing preview: drop preview.
- Closing pinned: remove from list.
- After close: activate neighbor (prefer right, else left). If none left: no active file; right pane shows empty message; file-list cursor may remain but nothing is open in tabs until the next selection creates a preview.
- `w` with no tabs: no-op.

### Double-click detection

Mouse parser has no native double-click. Detect two left-clicks on the **same** target (same file row path, or same preview tab path) within ~400ms.

### Pin edge cases

- Pinning a path that is already pinned: no-op besides activate.
- Pinning the current preview: upgrade in place (same position).

## Architecture

### New files

- `src/hooks/useFileTabs.ts` — tab state and operations.
- `src/components/TabBar.tsx` — render tabs; hit targets for click / `×` / double-click (App maps x ranges, same pattern as file-list mouse handling).

### `App` wiring

- Moving the file-list cursor onto a file (arrows / single-click) → `preview(path)` and open that path in the diff.
- Enter / file double-click / preview-tab double-click → `pin(path)`.
- Tab click → `activate` + sync file-list cursor via `setSelectedIndex` / `expandDirsForPath` / scroll into view.
- `w` when tabs exist → `close`; if `activePath` becomes `null`, clear the open diff (empty message).
- Right column: `TabBar` (height 1) + `DiffView` (`contentHeight - 1`).
- After snapshot refresh: prune tabs whose paths no longer exist; if active was removed, activate neighbor (same as close).

## Out of scope (v1)

- Tab reorder / drag
- Overflow menu / scrollable tab strip UI
- MRU or split panes
- Closing with `Ctrl+W` (only `w` and `×`)

## Testing

Unit tests for `useFileTabs`:

- Preview replaces previous preview
- Pin upgrades preview
- Activate pinned path does not create duplicate
- Close prefers right neighbor, else left
- Close last tab clears active
- Refresh prune removes missing paths and fixes active
- Pin already-pinned is activate-only

Manual smoke:

- Arrow navigation replaces preview
- Enter pins; Space does not
- Double-click file pins; double-click preview tab pins
- Tab click syncs files view
- `w` and `×` close correctly

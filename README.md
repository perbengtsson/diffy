# Diffy

Terminal git diff reviewer with a file list and colorized unified diffs.

## Install

```bash
npm install
npm run build
npm link   # optional: install `diffy` globally
```

## Usage

```bash
diffy                              # all uncommitted changes
diffy --staged                     # staged only
diffy --base main                  # branch diff vs main
diffy --base origin/main --include-uncommitted
diffy --no-watch                     # disable auto-refresh
diffy --resume                       # resume latest review for this repo
diffy --resume review-main-2026-07-18-1024
```

Watching is on by default: diffy refreshes when files change or when you stage/unstage (`●` in the status bar, `⟳` while refreshing).

### Line comments

Press `c` on a diff line to add or edit a comment (empty + Enter deletes). Press `o` for a review overview; quit with `q` to print the compiled markdown review (cyan), copy the plain text to the clipboard, and show a resume command.

Clipboard copy uses `pbcopy` (macOS), `wl-copy` / `xclip` / `xsel` (Linux), or a GTK fallback when those tools are missing.

Reviews are cached under `~/.config/diffy/review-<branch>-<YYYY-MM-DD-HHMM>.json` only after you add at least one comment. Use `--resume` (latest) or `--resume <name>` to continue a previous review. Quitting with no comments writes nothing and prints no resume hint.

## Keys

| Key | Action |
|-----|--------|
| `Tab` | Switch focus between file list and diff |
| `↑` / `↓` | Navigate files (preview tab) or scroll diff |
| `←` / `→` | Fold dirs (files) or switch tabs (diff; `←` on first tab returns to files) |
| `Enter` | Pin tab |
| `Space` / `→` | Open / focus diff |
| Double-click | Pin tab (file list or preview tab) |
| `w` | Close active tab |
| `g` | Go to line (enter source line number) |
| `l` | Copy `@path:line` for the current diff line (agent paste) |
| `e` | Edit current file in `$VISUAL` / `$EDITOR` (default `nano`) at the cursor line |
| `f` | Find in file (Tab toggles all files) |
| `PgUp` / `PgDn` | Page up/down in diff |
| `Shift+↓` / `Shift+↑` | Jump to next/previous change block (across files) |
| `j` / `k` | Same as Shift+↓ / Shift+↑ |
| `c` | Comment / edit comment on current line (diff focus) |
| `o` | Review overview (list comments; Enter jumps) |
| `t` | Themes (diff background + syntax highlight; saved to `~/.config/diffy/config.json`) |
| `r` | Refresh |
| `q` | Quit (prints + copies review when there are comments; shows resume command) |

Arrow navigation in the file list opens a dim preview tab (leftmost) until the file is pinned with Enter or a double-click.

# Diffy

Terminal git diff reviewer with a file list, colorized unified diffs, and per-hunk context expansion.

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
| `j`/`k`, arrows | Navigate files (preview tab) or scroll diff |
| `←` / `→` | Switch tabs (diff focus; `←` on first tab returns to files) |
| `Enter` | Pin tab |
| `Space` / `l` | Open / focus diff |
| Double-click | Pin tab (file list or preview tab) |
| `w` | Close active tab |
| `{` / `}` | Expand context up/down around current hunk |
| `[` / `]` | Collapse expanded context |
| `g` / `G` | Jump to top/bottom of diff |
| `c` | Comment / edit comment on current line (diff focus) |
| `o` | Review overview (list comments; Enter jumps) |
| `r` | Refresh |
| `q` | Quit (prints + copies review when there are comments; shows resume command) |

Arrow navigation in the file list opens a dim preview tab (leftmost) until the file is pinned with Enter or a double-click.

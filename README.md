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
```

Watching is on by default: diffy refreshes when files change or when you stage/unstage (`●` in the status bar, `⟳` while refreshing).

## Keys

| Key | Action |
|-----|--------|
| `Tab` | Switch focus between file list and diff |
| `j`/`k`, arrows | Navigate files or scroll diff |
| `{` / `}` | Expand context up/down around current hunk |
| `[` / `]` | Collapse expanded context |
| `g` / `G` | Jump to top/bottom of diff |
| `r` | Refresh |
| `q` | Quit |

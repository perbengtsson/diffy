#!/usr/bin/env node
import { render } from 'ink';
import { Command } from 'commander';
import { App, parseMode } from './app.js';
import { loadDiffSnapshot } from './git/diff.js';
import { findRepoRoot } from './git/runner.js';

async function main() {
  const program = new Command();
  program
    .name('diffy')
    .description('Terminal git diff reviewer')
    .option('--staged', 'Show staged changes only')
    .option('--base <ref>', 'Compare against a base ref (e.g. main)')
    .option(
      '--include-uncommitted',
      'With --base, also include uncommitted working tree changes',
    )
    .option('--no-watch', 'Disable automatic refresh on file changes')
    .parse(process.argv);

  const opts = program.opts<{
    staged?: boolean;
    base?: string;
    includeUncommitted?: boolean;
    noWatch?: boolean;
  }>();

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('diffy requires an interactive terminal (TTY).');
    process.exit(1);
  }

  if (opts.staged && opts.base) {
    console.error('Cannot use --staged together with --base.');
    process.exit(1);
  }

  const mode = parseMode({
    staged: opts.staged,
    base: opts.base,
    includeUncommitted: opts.includeUncommitted,
  });

  try {
    await findRepoRoot(process.cwd());
  } catch {
    console.error('Not a git repository (or git not found).');
    process.exit(1);
  }

  let snapshot;
  try {
    snapshot = await loadDiffSnapshot(process.cwd(), mode);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  render(<App initialSnapshot={snapshot} cwd={process.cwd()} watch={!opts.noWatch} />);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

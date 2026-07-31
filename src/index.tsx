#!/usr/bin/env node
import { render } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import { App, parseMode } from './app.js';
import { loadDiffSnapshot } from './git/diff.js';
import { currentBranchName } from './git/branch.js';
import { findRepoRoot } from './git/runner.js';
import { openOrCreateSession, todayDate } from './review/store.js';
import { loadUserConfig } from './config/userConfig.js';
import { resumeCommand } from './review/compile.js';
import { clipboardInstallHint, copyToClipboard } from './review/clipboard.js';

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
    .option(
      '--resume [name]',
      'Resume a saved review (basename or path; omit for latest in this repo)',
    )
    .parse(process.argv);

  const opts = program.opts<{
    staged?: boolean;
    base?: string;
    includeUncommitted?: boolean;
    noWatch?: boolean;
    resume?: string | true;
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

  let repoRoot: string;
  try {
    repoRoot = await findRepoRoot(process.cwd());
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

  const branch = await currentBranchName(repoRoot);
  const date = todayDate();
  const [{ session: initialReview, path: reviewPath }, userConfig] =
    await Promise.all([
      openOrCreateSession({
        repoRoot,
        branch,
        date,
        mode,
        resume: opts.resume,
      }),
      loadUserConfig(),
    ]);

  let quitTerminal = '';
  let quitPlain = '';
  // exitOnCtrlC: false so Ctrl+C reaches App's quit handler (copy review + persist).
  const { waitUntilExit } = render(
    <App
      initialSnapshot={snapshot}
      cwd={process.cwd()}
      watch={!opts.noWatch}
      initialReview={initialReview}
      reviewPath={reviewPath}
      initialDiffBgPaletteId={userConfig.diffBgPaletteId}
      initialHighlightSchemaId={userConfig.highlightSchemaId}
      onQuitReview={({ terminal, plain }) => {
        quitTerminal = terminal;
        quitPlain = plain;
      }}
    />,
    { exitOnCtrlC: false },
  );

  await waitUntilExit();
  if (quitTerminal) {
    process.stdout.write(`\n${quitTerminal}`);
    const copied = await copyToClipboard(quitPlain);
    if (copied) {
      process.stdout.write(chalk.dim('Copied review to clipboard.\n'));
    } else {
      process.stdout.write(
        chalk.dim(
          `Could not copy to clipboard.${clipboardInstallHint()}\n`,
        ),
      );
    }
    process.stdout.write(
      `\nResume: ${chalk.bold.blue(resumeCommand(reviewPath))}\n`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

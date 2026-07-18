import { git, gitOrThrow } from './runner.js';

/**
 * Current branch name for review filenames.
 * Detached HEAD → `detached-<shortsha>`.
 */
export async function currentBranchName(cwd: string): Promise<string> {
  const branch = (await gitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim();
  if (branch !== 'HEAD') {
    return branch;
  }
  const short = (await git(['rev-parse', '--short', 'HEAD'], cwd)).stdout.trim();
  return short ? `detached-${short}` : 'detached';
}

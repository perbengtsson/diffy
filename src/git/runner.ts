import { execa } from 'execa';

export async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execa('git', args, {
    cwd,
    reject: false,
    all: false,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

export async function gitOrThrow(
  args: string[],
  cwd: string,
): Promise<string> {
  const result = await execa('git', args, { cwd, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

export async function findRepoRoot(startDir: string): Promise<string> {
  return gitOrThrow(['rev-parse', '--show-toplevel'], startDir);
}

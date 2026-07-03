import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(err),
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

export async function gitOrThrow(
  args: string[],
  cwd: string,
): Promise<string> {
  const result = await git(args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trimEnd();
}

/** git diff exits 1 when differences exist — treat 0 and 1 as success. */
export async function gitDiffOutput(
  args: string[],
  cwd: string,
): Promise<string> {
  const result = await git(args, cwd);
  if (result.exitCode > 1) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trimEnd();
}

export async function findRepoRoot(startDir: string): Promise<string> {
  const root = await gitOrThrow(['rev-parse', '--show-toplevel'], startDir);
  return root.trim();
}

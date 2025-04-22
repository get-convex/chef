import { execFile as execFileCallback, ExecFileOptions } from 'child_process';
import { promisify } from 'util';

export const promisifyExecFile = promisify(execFileCallback);

export async function execFile(file: string, args: string[], opts: ExecFileOptions = {}) {
  try {
    const { stdout, stderr } = await promisifyExecFile(file, args, opts);
    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`${error.message}\nstderr: ${error.stderr}\nstdout: ${error.stdout}`);
  }
}

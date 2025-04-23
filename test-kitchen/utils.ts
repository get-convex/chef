import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';

export const execFile = promisify(execFileCallback);

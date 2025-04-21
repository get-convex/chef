import type { WebContainerProcess } from '@webcontainer/api';
import { withResolvers } from './promises';

interface StreamOutputOptions {
  onOutput?: (data: string) => void;
  debounceMs?: number;
}

export async function streamOutput(process: WebContainerProcess, options?: StreamOutputOptions) {
  let lastSaved = 0;
  let output = '';
  const { resolve, promise } = withResolvers<number>();
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        output += data.toString();
        const now = Date.now();
        if (!options?.debounceMs || now - lastSaved > options.debounceMs) {
          options?.onOutput?.(output);
          lastSaved = now;
        }
        if (data.startsWith('Error: ')) {
          resolve(-1);
          return;
        }
      },
    }),
  );
  options?.onOutput?.(output);
  const exitCode = await Promise.race([promise, process.exit]);
  options?.onOutput?.(output);
  return { output, exitCode };
}

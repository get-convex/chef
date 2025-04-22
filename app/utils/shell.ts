import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';
import { ContainerBootState, waitForContainerBootState } from '~/lib/stores/containerBootState';
import { cleanTerminalOutput } from 'chef-agent/utils/shell';

export async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
  // Wait for setup to fully complete before allowing shells to spawn.
  await waitForContainerBootState(ContainerBootState.READY);

  const args: string[] = [];

  // we spawn a JSH process with a fallback cols and rows in case the process is not attached yet to a visible terminal
  const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
    terminal: {
      cols: terminal.cols ?? 80,
      rows: terminal.rows ?? 15,
    },
  });

  const input = process.input.getWriter();
  const output = process.output;

  const jshReady = withResolvers<void>();

  let isInteractive = false;
  output.pipeTo(
    new WritableStream({
      write(data) {
        if (!isInteractive) {
          const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

          if (osc === 'interactive') {
            // wait until we see the interactive OSC
            isInteractive = true;

            jshReady.resolve();
          }
        }

        terminal.write(data);
      },
    }),
  );

  terminal.onData((data) => {
    // console.log('terminal onData', { data, isInteractive });

    if (isInteractive) {
      input.write(data);
    }
  });

  await jshReady.promise;

  return process;
}

type ExecutionResult = { output: string; exitCode: number };

export class BoltShell {
  #initialized: (() => void) | undefined;
  #readyPromise: Promise<void>;
  #webcontainer: WebContainer | undefined;
  #terminal: ITerminal | undefined;
  #process: WebContainerProcess | undefined;
  #outputStream: ReadableStreamDefaultReader<string> | undefined;
  #shellInputStream: WritableStreamDefaultWriter<string> | undefined;

  constructor() {
    this.#readyPromise = new Promise((resolve) => {
      this.#initialized = resolve;
    });
  }

  ready() {
    return this.#readyPromise;
  }

  async init(webcontainer: WebContainer, terminal: ITerminal) {
    this.#webcontainer = webcontainer;
    this.#terminal = terminal;

    const { process, output } = await this.newBoltShellProcess(webcontainer, terminal);
    this.#process = process;
    this.#outputStream = output.getReader();
    await this.waitTillOscCode('interactive');
    this.#initialized?.();
  }

  get terminal() {
    return this.#terminal;
  }

  get process() {
    return this.#process;
  }

  async startCommand(command: string) {
    if (!this.process || !this.terminal) {
      throw new Error('Terminal not initialized');
    }

    // For terminals that might be readonly, use write method directly for sending commands
    const shellInput = this.#shellInputStream;
    if (!shellInput) {
      throw new Error('Shell input stream not initialized');
    }

    // Interrupt the current execution with Ctrl+C
    shellInput.write('\x03');
    await this.waitTillOscCode('prompt');

    shellInput.write(command.trim() + '\n');
  }

  async executeCommand(command: string): Promise<ExecutionResult> {
    await this.startCommand(command);

    // Wait for the execution to finish
    const { output, exitCode } = await this.waitTillOscCode('exit');

    let cleanedOutput = output;
    try {
      cleanedOutput = cleanTerminalOutput(output);
    } catch (error) {
      console.log('failed to format terminal output', error);
    }

    return { output: cleanedOutput, exitCode };
  }

  async newBoltShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
    const args: string[] = [];

    // Wait for setup to fully complete before allowing shells to spawn.
    await waitForContainerBootState(ContainerBootState.READY);

    // we spawn a JSH process with a fallback cols and rows in case the process is not attached yet to a visible terminal
    const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
      terminal: {
        cols: terminal.cols ?? 80,
        rows: terminal.rows ?? 15,
      },
    });

    const input = process.input.getWriter();
    this.#shellInputStream = input;

    const [internalOutput, terminalOutput] = process.output.tee();

    const jshReady = withResolvers<void>();

    let isInteractive = false;
    terminalOutput.pipeTo(
      new WritableStream({
        write(data) {
          if (!isInteractive) {
            const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

            if (osc === 'interactive') {
              // wait until we see the interactive OSC
              isInteractive = true;

              jshReady.resolve();
            }
          }

          terminal.write(data);
        },
      }),
    );

    terminal.onData((data) => {
      // console.log('terminal onData', { data, isInteractive });

      if (isInteractive) {
        input.write(data);
      }
    });

    await jshReady.promise;

    return { process, output: internalOutput };
  }

  async waitTillOscCode(waitCode: string) {
    let fullOutput = '';
    let exitCode: number = 0;

    if (!this.#outputStream) {
      return { output: fullOutput, exitCode };
    }

    const tappedStream = this.#outputStream;

    while (true) {
      const { value, done } = await tappedStream.read();

      if (done) {
        break;
      }

      const text = value || '';
      fullOutput += text;

      // Check if command completion signal with exit code
      const [, osc, , , code] = text.match(/\x1b\]654;([^\x07=]+)=?((-?\d+):(\d+))?\x07/) || [];

      if (osc === 'exit') {
        exitCode = parseInt(code, 10);
      }

      if (osc === waitCode) {
        break;
      }
    }

    return { output: fullOutput, exitCode };
  }
}

export function newBoltShellProcess() {
  return new BoltShell();
}

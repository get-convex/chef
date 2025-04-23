import type { WebContainer } from '@webcontainer/api';
import { path as nodePath } from 'chef-agent/utils/path';
import { atom, map, type MapStore, type WritableAtom } from 'nanostores';
import type { ActionAlert, FileHistory } from '~/types/actions';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { unreachable } from 'chef-agent/utils/unreachable';
import type { ActionCallbackData } from 'chef-agent/message-parser';
import type { ToolInvocation } from 'ai';
import { viewParameters } from 'chef-agent/tools/view';
import { renderDirectory } from 'chef-agent/utils/renderDirectory';
import { renderFile } from 'chef-agent/utils/renderFile';
import { readPath, workDirRelative } from '~/utils/fileUtils';
import { ContainerBootState, waitForContainerBootState } from '~/lib/stores/containerBootState';
import { npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { z } from 'zod';
import { editToolParameters } from 'chef-agent/tools/edit';
import { getAbsolutePath } from 'chef-agent/utils/workDir';
import { cleanConvexOutput } from 'chef-agent/utils/shell';
import type { BoltAction } from 'chef-agent/types';
import type { BoltShell } from '~/utils/shell';
import { streamOutput } from '~/utils/process';
import { outputLabels, type OutputLabels } from '~/lib/runtime/deployToolOutputLabels';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = (BaseActionState | FailedActionState) & { isEdit?: boolean };

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed' | 'content'>>;

type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string })
  | Pick<BaseActionState & { type: 'convex' }, 'output'>;

type ActionsMap = MapStore<Record<string, ActionState>>;

class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;

  constructor(message: string, output: string) {
    // Create a formatted message that includes both the error message and output
    const formattedMessage = `Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`;
    super(formattedMessage);

    // Set the output separately so it can be accessed programmatically
    this._header = message;
    this._output = output;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ActionCommandError.prototype);

    // Set the name of the error for better debugging
    this.name = 'ActionCommandError';
  }

  // Optional: Add a method to get just the terminal output
  get output() {
    return this._output;
  }
  get header() {
    return this._header;
  }
}

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #shellTerminal: BoltShell;
  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };
  terminalOutput: WritableAtom<string> = atom('');
  onToolCallComplete: (args: {
    kind: 'success' | 'error';
    result: string;
    toolCallId: string;
    toolName: string;
  }) => void;
  constructor(
    webcontainerPromise: Promise<WebContainer>,
    shellTerminal: BoltShell,
    callbacks: {
      onAlert?: (alert: ActionAlert) => void;
      onToolCallComplete: (args: {
        kind: 'success' | 'error';
        result: string;
        toolCallId: string;
        toolName: string;
      }) => void;
    },
  ) {
    this.#webcontainer = webcontainerPromise;
    this.#shellTerminal = shellTerminal;
    this.onAlert = callbacks.onAlert;
    this.onToolCallComplete = callbacks.onToolCallComplete;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      if (action.content !== data.action.content) {
        this.updateAction(actionId, { ...action, content: data.action.content });
      }
      return;
    }

    const abortController = new AbortController();

    if (data.action.type === 'file') {
      const files = workbenchStore.files.get();
      const absPath = getAbsolutePath(data.action.filePath);
      const existing = !!files[absPath];
      data.action.isEdit = existing;
    }

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData, args: { isStreaming: boolean }) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return; // No return value here
    }

    if (args.isStreaming && action.type !== 'file') {
      return; // No return value here
    }

    this.updateAction(actionId, { ...action, ...data.action, executed: !args.isStreaming });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId, args);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });

    await this.#currentExecutionPromise;

    return;
  }

  async #executeAction(actionId: string, args: { isStreaming: boolean }) {
    const action = this.actions.get()[actionId];

    this.updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'toolUse': {
          await this.#runToolUseAction(actionId, action);
          break;
        }
        default: {
          throw new Error(`Unknown action type: ${JSON.stringify(action)}`);
        }
      }

      this.updateAction(actionId, {
        status: args.isStreaming ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
      });
    } catch (error) {
      if (action.abortSignal.aborted) {
        return;
      }

      this.updateAction(actionId, { status: 'failed', error: 'Action failed' });
      logger.error(`[${action.type}]:Action failed\n\n`, error);

      if (!(error instanceof ActionCommandError)) {
        return;
      }

      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: error.header,
        content: error.output,
      });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;
    const relativePath = nodePath.relative(webcontainer.workdir, action.filePath);

    let folder = nodePath.dirname(relativePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await webcontainer.fs.writeFile(relativePath, action.content);
      logger.debug(`File written ${relativePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  async getFileHistory(filePath: string): Promise<FileHistory | null> {
    try {
      const webcontainer = await this.#webcontainer;
      const historyPath = this.#getHistoryPath(filePath);
      const content = await webcontainer.fs.readFile(historyPath, 'utf-8');

      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to get file history:', error);
      return null;
    }
  }

  async saveFileHistory(filePath: string, history: FileHistory) {
    // const webcontainer = await this.#webcontainer;
    const historyPath = this.#getHistoryPath(filePath);

    await this.#runFileAction({
      type: 'file',
      filePath: historyPath,
      content: JSON.stringify(history),
      changeSource: 'auto-save',
    } as any);
  }

  #getHistoryPath(filePath: string) {
    return nodePath.join('.history', filePath);
  }

  async #runToolUseAction(_actionId: string, action: ActionState) {
    if (action.type !== 'toolUse') {
      unreachable('Expected tool use action');
    }

    const parsed: ToolInvocation = action.parsedContent;

    if (parsed.state === 'result') {
      return;
    }
    if (parsed.state === 'partial-call') {
      throw new Error('Tool call is still in progress');
    }

    let result: string;
    try {
      switch (parsed.toolName) {
        case 'view': {
          const args = viewParameters.parse(parsed.args);
          const container = await this.#webcontainer;
          const relPath = workDirRelative(args.path);
          const file = await readPath(container, relPath);
          if (file.type === 'directory') {
            result = renderDirectory(file.children);
          } else {
            if (args.view_range && args.view_range.length !== 2) {
              throw new Error('When provided, view_range must be an array of two numbers');
            }
            result = renderFile(file.content, args.view_range as [number, number]);
          }
          break;
        }
        case 'edit': {
          const args = editToolParameters.parse(parsed.args);
          const container = await this.#webcontainer;
          const relPath = workDirRelative(args.path);
          const file = await readPath(container, relPath);
          if (file.type !== 'file') {
            throw new Error('Expected a file');
          }
          let content = file.content;
          if (args.old.length > 1024) {
            throw new Error(`Old text must be less than 1024 characters: ${args.old}`);
          }
          if (args.new.length > 1024) {
            throw new Error(`New text must be less than 1024 characters: ${args.new}`);
          }
          const matchPos = content.indexOf(args.old);
          if (matchPos === -1) {
            throw new Error(`Old text not found: ${args.old}`);
          }
          const secondMatchPos = content.indexOf(args.old, matchPos + args.old.length);
          if (secondMatchPos !== -1) {
            throw new Error(`Old text found multiple times: ${args.old}`);
          }
          content = content.replace(args.old, args.new);
          await container.fs.writeFile(relPath, content);
          result = `Successfully edited ${args.path}`;
          break;
        }
        case 'npmInstall': {
          try {
            const args = npmInstallToolParameters.parse(parsed.args);
            const container = await this.#webcontainer;
            await waitForContainerBootState(ContainerBootState.READY);
            const npmInstallProc = await container.spawn('npm', ['install', ...args.packages.split(' ')]);
            action.abortSignal.addEventListener('abort', () => {
              npmInstallProc.kill();
            });
            const { output, exitCode } = await streamOutput(npmInstallProc, {
              onOutput: (output) => {
                this.terminalOutput.set(output);
              },
              debounceMs: 50,
            });
            const cleanedOutput = cleanConvexOutput(output);
            if (exitCode !== 0) {
              throw new Error(`Npm install failed with exit code ${exitCode}: ${cleanedOutput}`);
            }
            result = cleanedOutput;
          } catch (error: unknown) {
            if (error instanceof z.ZodError) {
              result = `Error: Invalid npm install arguments.  ${error}`;
            } else if (error instanceof Error) {
              result = `Error: ${error.message}`;
            } else {
              result = `Error: An unknown error occurred during npm install`;
            }
          }
          break;
        }
        case 'deploy': {
          const container = await this.#webcontainer;
          await waitForContainerBootState(ContainerBootState.READY);

          result = '';

          const commandErroredController = new AbortController();
          const abortSignal = AbortSignal.any([action.abortSignal, commandErroredController.signal]);

          /** Return a promise of output on success, throws an error containing output on failure. */
          const run = async (
            commandAndArgs: string[],
            errorPrefix: OutputLabels,
            onOutput?: (s: string) => void,
          ): Promise<string> => {
            logger.info('starting to run', errorPrefix);
            const t0 = performance.now();
            const proc = await container.spawn(commandAndArgs[0], commandAndArgs.slice(1));
            const abortListener: () => void = () => proc.kill();
            abortSignal.addEventListener('abort', () => {
              logger.info('aborting', commandAndArgs);
              proc.kill();
            });
            const { output, exitCode } = await streamOutput(proc, { onOutput, debounceMs: 50 });

            const cleanedOutput = cleanConvexOutput(output);
            const time = performance.now() - t0;
            logger.debug('finished', errorPrefix, 'in', Math.round(time));
            if (exitCode !== 0) {
              // Kill all other commands
              commandErroredController.abort(`${errorPrefix}`);
              // This command's output will be reported exclusively
              throw new Error(`[${errorPrefix}] Failed with exit code ${exitCode}: ${cleanedOutput}`);
            }
            abortSignal.removeEventListener('abort', abortListener);
            if (cleanedOutput.trim().length === 0) {
              return '';
            }
            return cleanedOutput + '\n\n';
          };

          //         START         deploy tool call
          //          /
          //         /
          //  codegen              `convex typecheck` includes typecheck of convex/ dir
          // + typecheck
          //       |
          //       |
          // app typecheck         `tsc --noEmit --project tsconfig.app.json
          //         \
          //          \
          //         deploy        `deploy` can fail

          const runCodegenAndTypecheck = async (onOutput?: (output: string) => void) => {
            // Convex codegen does a convex directory typecheck, then tsc does a full-project typecheck.
            let output = await run(['convex', 'codegen'], outputLabels.convexTypecheck, onOutput);
            output += await run(
              ['tsc', '--noEmit', '-p', 'tsconfig.app.json'],
              outputLabels.frontendTypecheck,
              onOutput,
            );
            return output;
          };

          const t0 = performance.now();
          result += await runCodegenAndTypecheck((output) => {
            this.terminalOutput.set(output);
          });
          result += await run(['convex', 'dev', '--once', '--typecheck=disable'], outputLabels.convexDeploy);
          const time = performance.now() - t0;
          logger.info('deploy action finished in', time);

          // Start the default preview if it's not already running
          if (!workbenchStore.isDefaultPreviewRunning()) {
            await this.#shellTerminal.startCommand('vite --open');
            result += '\n\nDev server started successfully!';
          }

          break;
        }
        default: {
          throw new Error(`Unknown tool: ${parsed.toolName}`);
        }
      }
      this.onToolCallComplete({
        kind: 'success',
        result,
        toolCallId: action.parsedContent.toolCallId,
        toolName: parsed.toolName,
      });
    } catch (e: any) {
      console.error('Error on tool call', e);
      let message = e.toString();
      if (!message.startsWith('Error:')) {
        message = 'Error: ' + message;
      }
      this.onToolCallComplete({
        kind: 'error',
        result: message,
        toolCallId: action.parsedContent.toolCallId,
        toolName: parsed.toolName,
      });
      throw e;
    }
  }
}

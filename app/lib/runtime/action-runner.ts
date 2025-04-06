import type { WebContainer } from '@webcontainer/api';
import { path as nodePath, path } from '~/utils/path';
import { atom, map, type MapStore, type WritableAtom } from 'nanostores';
import type { ActionAlert, BoltAction, FileHistory } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';
import { cleanTerminalOutput, type BoltShell } from '~/utils/shell';
import type { ToolInvocation } from 'ai';
import { withResolvers } from '~/utils/promises';
import { viewParameters } from './viewTool';
import { readPath, renderDirectory, renderFile, workDirRelative } from '~/utils/fileUtils';
import { ContainerBootState, waitForContainerBootState } from '~/lib/webcontainer';
import { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import { z } from 'zod';
import { editToolParameters } from './editTool';
const logger = createScopedLogger('ActionRunner');

type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

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
  #shellTerminal: () => BoltShell;
  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };
  terminalOutput: WritableAtom<string> = atom('');

  constructor(
    private toolCalls: Map<string, PromiseWithResolvers<string>>,
    webcontainerPromise: Promise<WebContainer>,
    getShellTerminal: () => BoltShell,
    onAlert?: (alert: ActionAlert) => void,
  ) {
    this.#webcontainer = webcontainerPromise;
    this.#shellTerminal = getShellTerminal;
    this.onAlert = onAlert;
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
      const absPath = path.join(WORK_DIR, data.action.filePath);
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

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    console.log('runAction', data);
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return; // No return value here
    }

    if (isStreaming && action.type !== 'file') {
      return; // No return value here
    }

    this.updateAction(actionId, { ...action, ...data.action, executed: !isStreaming });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId, isStreaming);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });

    await this.#currentExecutionPromise;

    return;
  }

  async #executeAction(actionId: string, isStreaming: boolean = false) {
    const action = this.actions.get()[actionId];

    this.updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          logger.error('Shell action is not supported anymore. Use tool calls instead.');
          break;
        }
        case 'npmInstall': {
          logger.error('Npm install action is not supported anymore. Use tool calls instead.');
          break;
        }
        case 'npmExec': {
          logger.error('Npm exec action is not supported anymore. Use tool calls instead.');
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'build': {
          const buildOutput = await this.#runBuildAction(action);
          // Store build output for deployment
          this.buildOutput = buildOutput;
          break;
        }
        case 'start': {
          logger.error('Start action is not supported anymore. Use tool calls instead.');
          break;
        }
        case 'convex': {
          logger.error('Convex action is not supported anymore. Use tool calls instead.');
          break;
        }
        case 'toolUse': {
          await this.#runToolUseAction(actionId, action);
          break;
        }
      }

      this.updateAction(actionId, {
        status: isStreaming ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
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

  async #runBuildAction(action: ActionState) {
    if (action.type !== 'build') {
      unreachable('Expected build action');
    }

    const webcontainer = await this.#webcontainer;

    // Create a new terminal specifically for the build
    const buildProcess = await webcontainer.spawn('npm', ['run', 'build']);

    let output = '';
    buildProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      }),
    );

    const exitCode = await buildProcess.exit;

    if (exitCode !== 0) {
      throw new ActionCommandError('Build Failed', output || 'No Output Available');
    }

    // Get the build output directory path
    const buildDir = nodePath.join(webcontainer.workdir, 'dist');

    return {
      path: buildDir,
      exitCode,
      output,
    };
  }

  async #runToolUseAction(actionId: string, action: ActionState) {
    const parsed: ToolInvocation = JSON.parse(action.content);
    if (parsed.state === 'result') {
      return;
    }
    if (parsed.state === 'partial-call') {
      throw new Error('Tool call is still in progress');
    }

    let resolvers = this.toolCalls.get(parsed.toolCallId);
    if (!resolvers) {
      resolvers = withResolvers<string>();
      this.toolCalls.set(parsed.toolCallId, resolvers);
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

            let lastSaved = 0;
            let output = '';
            const { resolve, promise } = withResolvers<number>();
            const terminalOutput = this.terminalOutput;
            npmInstallProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  output += data.toString();
                  const now = Date.now();
                  if (now - lastSaved > 50) {
                    terminalOutput.set(output);
                    lastSaved = now;
                  }
                  if (data.startsWith('Error: ')) {
                    resolve(-1);
                    return;
                  }
                },
              }),
            );
            this.terminalOutput.set(output);
            const npmInstallExitCode = await Promise.race([promise, npmInstallProc.exit]);
            const cleanedOutput = cleanConvexOutput(output);
            if (npmInstallExitCode !== 0) {
              throw new Error(`Npm install failed with exit code ${npmInstallExitCode}: ${cleanedOutput}`);
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
          const shell = this.#shellTerminal();
          const container = await this.#webcontainer;
          await waitForContainerBootState(ContainerBootState.READY);
          const convexProc = await container.spawn('npx', ['convex', 'dev', '--once']);
          action.abortSignal.addEventListener('abort', () => {
            convexProc.kill();
          });

          let lastSaved = 0;
          let output = '';
          const { resolve, promise } = withResolvers<number>();
          const terminalOutput = this.terminalOutput;
          convexProc.output.pipeTo(
            new WritableStream({
              write(data) {
                output += data.toString();
                const now = Date.now();
                if (now - lastSaved > 50) {
                  terminalOutput.set(output);
                  lastSaved = now;
                }
                if (data.startsWith('Error: ')) {
                  resolve(-1);
                  return;
                }
              },
            }),
          );
          this.terminalOutput.set(output);
          const convexExitCode = await Promise.race([promise, convexProc.exit]);
          const cleanedOutput = cleanConvexOutput(output);
          if (convexExitCode !== 0) {
            throw new Error(`Convex failed with exit code ${convexExitCode}: ${cleanedOutput}`);
          }
          result = cleanedOutput;

          await shell.startCommand(this.runnerId.get(), 'npx vite --open');
          result += '\n\nDev server started successfully!';
          break;
        }
        default: {
          throw new Error(`Unknown tool: ${parsed.toolName}`);
        }
      }
      resolvers.resolve(result);
    } catch (e: any) {
      console.error('Error on tool call', e);
      let message = e.toString();
      if (!message.startsWith('Error:')) {
        message = 'Error: ' + message;
      }
      resolvers.resolve(message);
      throw e;
    }
  }
}

const BANNED_LINES = [
  'Preparing Convex functions...',
  'Checking that documents match your schema...',
  'transforming (',
  'computing gzip size',
  'Collecting TypeScript errors',
  'idealTree buildDeps',
  'timing reify:unpack'
];

// Cleaning terminal output helps the agent focus on the important parts and
// not waste input tokens.
function cleanConvexOutput(output: string) {
  output = cleanTerminalOutput(output);
  const normalizedNewlines = output.replace('\r\n', '\n').replace('\r', '\n');
  const result = normalizedNewlines
    // Remove lines that include "Preparing Convex functions..."
    .split('\n')
    .filter((line) => !BANNED_LINES.some((bannedLine) => line.includes(bannedLine)))
    .join('\n');
  if (output !== result) {
    console.log(`Sanitized output: ${output.length} -> ${result.length}`);
  }
  return result;
}

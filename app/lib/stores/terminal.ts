import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal, TerminalInitializationOptions } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }> = [];
  #boltTerminal = newBoltShellProcess();
  #deployTerminal = newBoltShellProcess();
  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  startDevServerOnAttach = false;

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }
  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  async attachBoltTerminal(terminal: ITerminal, isReload: boolean) {
    try {
      const wc = await this.#webcontainer;
      await this.#boltTerminal.init(wc, terminal);
      console.log('isReload', isReload);
      if (isReload) {
        await this.#boltTerminal.executeCommand('npx vite --open');
      }
    } catch (error: any) {
      console.error('Failed to initialize bolt terminal:', error);
      terminal.write(coloredText.red('Failed to spawn dev server shell\n\n') + error.message);
      return;
    }
  }

  async deployFunctionsAndRunDevServer(shouldDeployConvexFunctions: boolean) {
    console.log('deployFunctionsAndRunDevServer', shouldDeployConvexFunctions);
    if (shouldDeployConvexFunctions) {
      const result = await this.#deployTerminal.executeCommand('npx convex dev --once');
      console.log('deployFunctionsAndRunDevServer result', result);
      if (result?.exitCode !== 0) {
        throw new Error('Failed to deploy convex functions');
      }
    }
  }

  async attachDeployTerminal(terminal: ITerminal, options?: TerminalInitializationOptions) {
    console.log('attachDeployTerminal', options);
    try {
      const wc = await this.#webcontainer;
      await this.#deployTerminal.init(wc, terminal);
      if (options?.isReload) {
        await this.deployFunctionsAndRunDevServer(options.shouldDeployConvexFunctions ?? false);
      }
      console.log('attachDeployTerminal done');
    } catch (error: any) {
      console.error('Failed to initialize deploy terminal:', error);
      terminal.write(coloredText.red('Failed to spawn dev server shell\n\n') + error.message);
      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    try {
      const shellProcess = await newShellProcess(await this.#webcontainer, terminal);
      this.#terminals.push({ terminal, process: shellProcess });
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      return;
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }
}

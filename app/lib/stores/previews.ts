import type { WebContainer } from '@webcontainer/api';
import { atom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import { withResolvers } from '~/utils/promises';

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

const PROXY_PORT_RANGE_START = 0xc4ef;

// This is a separate codebase.
// eslint-disable-next-line no-restricted-imports
import PROXY_SERVER_SOURCE from '../../../proxy/proxy.bundled.cjs?raw';

type ProxyState = { sourcePort: number; start: (arg: { proxyUrl: string }) => void; stop: () => void };

export class PreviewsStore {
  #availablePreviews = new Map<number, PreviewInfo>();
  #webcontainer: Promise<WebContainer>;

  previews = atom<PreviewInfo[]>([]);

  #proxies = new Map<number, ProxyState>();

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
    this.#init();
  }

  async #init() {
    const webcontainer = await this.#webcontainer;

    // Listen for server ready events
    webcontainer.on('server-ready', (port, url) => {
      console.log('[Preview] Server ready on port:', port, url);
    });

    // Listen for port events
    webcontainer.on('port', (port, type, url) => {
      if (this.#proxies.has(port)) {
        if (type === 'open') {
          this.#proxies.get(port)?.start({ proxyUrl: url });
        }
        return;
      }

      let previewInfo = this.#availablePreviews.get(port);

      if (type === 'close' && previewInfo) {
        this.#availablePreviews.delete(port);
        this.previews.set(this.previews.get().filter((preview) => preview.port !== port));
        return;
      }

      const previews = this.previews.get();

      if (!previewInfo) {
        previewInfo = { port, ready: type === 'open', baseUrl: url };
        this.#availablePreviews.set(port, previewInfo);
        previews.push(previewInfo);
      }

      previewInfo.ready = type === 'open';
      previewInfo.baseUrl = url;

      this.previews.set([...previews]);
    });
  }

  /**
   * Starts a proxy server for the given source port.
   *
   * Proxy servers are used so that each time a preview is shown on screen,
   * each preview has a different origin. This helps when testing apps with
   * auth with multiple users.
   */
  async startProxy(sourcePort: number): Promise<{ proxyPort: number; proxyUrl: string }> {
    const targetPort = PROXY_PORT_RANGE_START + this.#proxies.size;
    const { promise: onStart, resolve: start } = withResolvers<{ proxyUrl: string }>();

    const proxyLogger = createScopedLogger(`Proxy ${targetPort} → ${sourcePort}`);

    const proxyState: ProxyState = {
      sourcePort,
      start,
      stop() {
        // This should never happen since the external users don’t get access to
        // the ProxyState object before `startProxy` returns (unless they guess
        // the port number)
        throw new Error('Proxy not started');
      },
    };
    this.#proxies.set(targetPort, proxyState);

    // Start the HTTP + HMR WebSocket proxy
    const webcontainer = await this.#webcontainer;

    const proxyScriptLocation = '/tmp/previewProxy.cjs';
    // webcontainer.writeFile seems incapable of writing to /tmp/foo
    // so use sh instead. It's important that this string has no
    // single quote characters ' in it so this naive escaping works.
    const writeProxyProcess = await webcontainer.spawn('sh', [
      '-c',
      `echo '${PROXY_SERVER_SOURCE}' > ${proxyScriptLocation}`,
    ]);
    await writeProxyProcess.exit;
    const proxyProcess = await webcontainer.spawn('node', [
      proxyScriptLocation,
      sourcePort.toString(),
      targetPort.toString(),
    ]);
    console.log('starting proxy process');

    proxyState.stop = () => {
      proxyLogger.info('Stopping proxy');
      proxyProcess.kill();
    };

    proxyProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          proxyLogger.info(data);
        },
      }),
    );

    const { proxyUrl } = await onStart;
    return { proxyPort: targetPort, proxyUrl };
  }

  /**
   * Called when a proxy server is no longer used and it can be released.
   */
  stopProxy(proxyPort: number) {
    const proxy = this.#proxies.get(proxyPort);
    if (!proxy) {
      throw new Error(`Proxy for port ${proxyPort} not found`);
    }

    proxy.stop();
  }
}

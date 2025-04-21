import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { memo, useEffect, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

export const Terminal = memo(function Terminal({
  className,
  theme,
  readonly,
  id,
  onTerminalReady,
  onTerminalResize,
}: {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}) {
  const terminalElementRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm>();

  useEffect(() => {
    const element = terminalElementRef.current!;

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      disableStdin: readonly,
      theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
      fontSize: 12,
      fontFamily: 'Menlo, courier-new, courier, monospace',
    });

    terminalRef.current = terminal;

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(element);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      onTerminalResize?.(terminal.cols, terminal.rows);
    });

    resizeObserver.observe(element);

    logger.debug(`Attach [${id}]`);

    onTerminalReady?.(terminal);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [id, onTerminalReady, onTerminalResize, readonly]);

  useEffect(() => {
    const terminal = terminalRef.current!;

    // we render a transparent cursor in case the terminal is readonly
    terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});

    terminal.options.disableStdin = readonly;
  }, [theme, readonly]);

  return <div className={className} ref={terminalElementRef} />;
});

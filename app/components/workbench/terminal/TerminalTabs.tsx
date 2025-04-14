import { useStore } from '@nanostores/react';
import React, { memo, useEffect, useRef, useState } from 'react';
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';
import { IconButton } from '~/components/ui/IconButton';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { classNames } from '~/utils/classNames';
import { Terminal, type TerminalRef } from './Terminal';
import type { TerminalInitializationOptions } from '~/types/terminal';
import {
  activeTerminalTabStore,
  isConvexDeployTerminalVisibleStore,
  VITE_TAB_INDEX,
  CONVEX_DEPLOY_TAB_INDEX,
} from '~/lib/stores/terminalTabs';
import { CommandLineIcon } from '@heroicons/react/24/outline';
import { CaretDownIcon, PlusIcon } from '@radix-ui/react-icons';

const MAX_TERMINALS = 5;
export const DEFAULT_TERMINAL_SIZE = 25;

export const TerminalTabs = memo((terminalInitializationOptions?: TerminalInitializationOptions) => {
  const showTerminal = useStore(workbenchStore.showTerminal);
  const theme = useStore(themeStore);

  const terminalRefs = useRef<Array<TerminalRef | null>>([]);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);

  const activeTerminal = useStore(activeTerminalTabStore);
  const [terminalCount, setTerminalCount] = useState(2);

  const isConvexDeployTerminalVisible = useStore(isConvexDeployTerminalVisibleStore);

  const addTerminal = () => {
    if (terminalCount < MAX_TERMINALS) {
      setTerminalCount(terminalCount + 1);
      activeTerminalTabStore.set(terminalCount + 1);
    }
  };

  useEffect(() => {
    const { current: terminal } = terminalPanelRef;

    if (!terminal) {
      return;
    }

    const isCollapsed = terminal.isCollapsed();

    if (!showTerminal && !isCollapsed) {
      terminal.collapse();
    } else if (showTerminal && isCollapsed) {
      terminal.resize(DEFAULT_TERMINAL_SIZE);
    }
  }, [showTerminal]);

  useEffect(() => {
    const unsubscribeFromThemeStore = themeStore.subscribe(() => {
      for (const ref of Object.values(terminalRefs.current)) {
        ref?.reloadStyles();
      }
    });

    return () => {
      unsubscribeFromThemeStore();
    };
  }, []);

  return (
    <Panel
      ref={terminalPanelRef}
      defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
      minSize={10}
      collapsible
      onExpand={() => {
        workbenchStore.toggleTerminal(true);
      }}
      onCollapse={() => {
        workbenchStore.toggleTerminal(false);
      }}
    >
      <div className="h-full">
        <div className="flex h-full flex-col bg-bolt-elements-terminals-background">
          <div className="flex min-h-[34px] items-center gap-1.5 border-y border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2">
            {Array.from({ length: terminalCount + 1 }, (_, index) => {
              const isActive = activeTerminal === index;

              if (index === CONVEX_DEPLOY_TAB_INDEX && !isConvexDeployTerminalVisible) {
                return null;
              }

              return (
                <button
                  key={index}
                  className={classNames(
                    'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                    {
                      'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                      'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                        !isActive,
                    },
                  )}
                  onClick={() => activeTerminalTabStore.set(index)}
                >
                  <CommandLineIcon className="size-4" />
                  {index === VITE_TAB_INDEX
                    ? 'Dev Server'
                    : index === CONVEX_DEPLOY_TAB_INDEX
                      ? 'Convex Deploy'
                      : `Terminal ${terminalCount > 2 ? index - 1 : ''}`}
                </button>
              );
            })}
            {terminalCount < MAX_TERMINALS && <IconButton icon={<PlusIcon />} size="md" onClick={addTerminal} />}
            <IconButton
              className="ml-auto"
              icon={<CaretDownIcon />}
              title="Close"
              size="md"
              onClick={() => workbenchStore.toggleTerminal(false)}
            />
          </div>
          {Array.from({ length: terminalCount + 1 }, (_, index) => (
            <Terminal
              key={index}
              id={`terminal_${index}`}
              className={classNames('h-full overflow-hidden', {
                hidden: activeTerminal !== index,
              })}
              ref={(ref) => {
                terminalRefs.current.push(ref);
              }}
              onTerminalReady={(terminal) => {
                if (index === VITE_TAB_INDEX) {
                  workbenchStore.attachBoltTerminal(terminal, terminalInitializationOptions?.isReload ?? false);
                } else if (index === CONVEX_DEPLOY_TAB_INDEX) {
                  workbenchStore.attachDeployTerminal(terminal, {
                    ...terminalInitializationOptions,
                  });
                } else {
                  workbenchStore.attachTerminal(terminal);
                }
              }}
              onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
              theme={theme}
              readonly={index === CONVEX_DEPLOY_TAB_INDEX}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
});

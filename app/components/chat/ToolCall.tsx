import { useStore } from '@nanostores/react';
import { Terminal as XTerm } from '@xterm/xterm';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore, type ArtifactState } from '~/lib/stores/workbench';
import { type PartId } from '~/lib/stores/artifacts';
import { cubicEasingFn } from '~/utils/easings';
import { classNames } from '~/utils/classNames';
import type { ConvexToolInvocation } from '~/lib/common/types';
import { getTerminalTheme } from '~/components/workbench/terminal/theme';
import { FitAddon } from '@xterm/addon-fit';
import { viewParameters } from '~/lib/runtime/viewTool';
import { getHighlighter } from 'shiki';
import { themeStore } from '~/lib/stores/theme';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import { path } from '~/utils/path';
import { editToolParameters } from '~/lib/runtime/editTool';
import { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';
import { loggingSafeParse } from '~/lib/zodUtil';
import { deployToolParameters } from '~/lib/runtime/deployTool';
import type { ZodError } from 'zod';

export const ToolCall = memo((props: { partId: PartId; toolCallId: string }) => {
  const { partId, toolCallId } = props;
  const userToggledAction = useRef(false);
  const [showAction, setShowAction] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[partId];

  const actions = useStore(artifact.runner.actions);
  const pair = Object.entries(actions).find(([actionId]) => actionId === toolCallId);
  const action = pair && pair[1];

  const toggleAction = () => {
    userToggledAction.current = true;
    setShowAction(!showAction);
  };

  const parsed: ConvexToolInvocation = useMemo(() => {
    return parseToolInvocation(action?.content, action?.status, artifact, toolCallId);
  }, [action?.content, action?.status, artifact, toolCallId]);

  const title = action && toolTitle(parsed);
  const icon = action && statusIcon(action.status, parsed);

  if (!action) {
    return null;
  }
  return (
    <div className="artifact border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex">
        <button
          className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="px-5 p-3.5 w-full text-left">
            <div className="flex items-center gap-1.5">
              <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">{title}</div>
              {icon}
            </div>
          </div>
        </button>
        <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          {artifact.type !== 'bundled' && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              disabled={parsed.state === 'partial-call'}
              onClick={toggleAction}
            >
              <div className="p-4 text-bolt-elements-textPrimary">
                <div className={showAction ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showAction && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />
            <div className="p-5 text-left bg-bolt-elements-actions-background">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ul className="list-none space-y-2.5">
                  <ToolUseContents artifact={artifact} invocation={parsed} />
                </ul>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const ToolUseContents = memo(
  ({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }) => {
    switch (invocation.toolName) {
      case 'deploy': {
        return <DeployTool artifact={artifact} invocation={invocation} />;
      }
      case 'view': {
        return <ViewTool invocation={invocation} />;
      }
      case 'npmInstall': {
        return <NpmInstallTool artifact={artifact} invocation={invocation} />;
      }
      case 'edit': {
        return <EditTool invocation={invocation} />;
      }
      default: {
        // Fallback for other tool types
        return <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(invocation, null, 2)}</pre>;
      }
    }
  },
);

function DeployTool({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'deploy') {
    throw new Error('Terminal can only be used for the deploy tool');
  }

  if (invocation.state === 'call') {
    return (
      <div className="space-y-2">
        <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
          <Terminal artifact={artifact} invocation={invocation} />
        </div>
      </div>
    );
  }
  if (invocation.state === 'result') {
    return (
      <div className="space-y-2 ">
        <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
          <Terminal artifact={artifact} invocation={invocation} />
        </div>
      </div>
    );
  }
}

const Terminal = memo(
  forwardRef(({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }, ref) => {
    const theme = useStore(themeStore);
    let terminalOutput = useStore(artifact.runner.terminalOutput);
    if (!terminalOutput && invocation.state === 'result' && invocation.result) {
      terminalOutput = invocation.result;
    }
    const terminalElementRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm>();
    useEffect(() => {
      const element = terminalElementRef.current!;
      const fitAddon = new FitAddon();
      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        disableStdin: true,
        theme: getTerminalTheme({ cursor: '#00000000' }),
        fontSize: 12,
        fontFamily: 'Menlo, courier-new, courier, monospace',
      });
      terminal.loadAddon(fitAddon);

      terminalRef.current = terminal;
      terminal.open(element);

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
        terminal.dispose();
      };
    }, []);

    const written = useRef(0);
    useEffect(() => {
      if (terminalRef.current && terminalOutput.length > written.current) {
        terminalRef.current.write(terminalOutput.slice(written.current));
        written.current = terminalOutput.length;
      }
    }, [terminalOutput]);

    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal) {
        return;
      }
      terminal.options.theme = getTerminalTheme({ cursor: '#00000000' });
      terminal.options.disableStdin = true;
    }, [theme]);

    useImperativeHandle(ref, () => {
      return {
        reloadStyles: () => {
          const terminal = terminalRef.current;
          if (!terminal) {
            return;
          }
          terminal.options.theme = getTerminalTheme({ cursor: '#00000000' });
        },
      };
    }, []);

    return <div className="h-40" ref={terminalElementRef} />;
  }),
);

function NpmInstallTool({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'npmInstall') {
    throw new Error('Terminal can only be used for the npmInstall tool');
  }

  if (invocation.state === 'call') {
    return (
      <div className="space-y-2">
        <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
          <Terminal artifact={artifact} invocation={invocation} />
        </div>
      </div>
    );
  }
  if (invocation.state === 'result') {
    if (invocation.result.startsWith('Error:')) {
      return (
        <div className="space-y-2">
          <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
            <Terminal artifact={artifact} invocation={invocation} />
          </div>
        </div>
      );
    }
  }
}

function parseToolInvocation(
  content: string | undefined,
  status: ActionState['status'] | undefined,
  artifact: ArtifactState,
  toolCallId: string,
): ConvexToolInvocation {
  if (!content) {
    return {} as ConvexToolInvocation;
  }
  let parsedContent: ConvexToolInvocation;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    return {} as ConvexToolInvocation;
  }
  if (status === 'complete' && parsedContent.state === 'result' && !parsedContent.result?.startsWith('Error:')) {
    let zodError: ZodError | null = null;
    switch (parsedContent.toolName) {
      case 'deploy': {
        const args = loggingSafeParse(deployToolParameters, parsedContent.args);
        if (!args.success) {
          zodError = args.error;
        }
        break;
      }
      case 'edit': {
        const args = loggingSafeParse(editToolParameters, parsedContent.args);
        if (!args.success) {
          zodError = args.error;
        }
        break;
      }
      case 'npmInstall': {
        const args = loggingSafeParse(npmInstallToolParameters, parsedContent.args);
        if (!args.success) {
          zodError = args.error;
        }
        break;
      }
      case 'view': {
        const args = loggingSafeParse(viewParameters, parsedContent.args);
        if (!args.success) {
          zodError = args.error;
        }
        break;
      }
      default: {
        break;
      }
    }
    if (zodError) {
      // Update the action status to failed if the args don't parse.
      if (artifact && artifact.runner) {
        const errorMessage = `Error: Could not parse arguments: ${zodError.message}`;
        artifact.runner.updateAction(toolCallId, {
          status: 'failed',
          error: errorMessage,
        });
        // Modify the result to indicate an error
        parsedContent.result = errorMessage;
      }
    }
  }
  return parsedContent;
}

function statusIcon(status: ActionState['status'], invocation: ConvexToolInvocation) {
  let inner: React.ReactNode;
  let color: string;
  if (
    invocation.state === 'result' &&
    typeof invocation.result === 'string' &&
    invocation.result.startsWith('Error:')
  ) {
    inner = <div className="i-ph:x" />;
    color = 'text-bolt-elements-icon-error';
  } else {
    switch (status) {
      case 'running':
        inner = <div className="i-svg-spinners:90-ring-with-bg" />;
        color = 'text-bolt-elements-loader-progress';
        break;
      case 'pending':
        inner = <div className="i-ph:circle-duotone" />;
        color = 'text-bolt-elements-textTertiary';
        break;
      case 'complete':
        inner = <div className="i-ph:check" />;
        color = 'text-bolt-elements-icon-success';
        break;
      case 'failed':
        inner = <div className="i-ph:x" />;
        color = 'text-bolt-elements-icon-error';
        break;
      case 'aborted':
        inner = <div className="i-ph:x" />;
        color = 'text-bolt-elements-textSecondary';
        break;
      default:
        return null;
    }
  }
  return <div className={classNames('text-lg', color)}>{inner}</div>;
}

function toolTitle(invocation: ConvexToolInvocation): React.ReactNode {
  switch (invocation.toolName) {
    case 'view': {
      const args = loggingSafeParse(viewParameters, invocation.args);
      let verb = 'Read';
      let icon = 'i-ph:file-text';
      let renderedPath = 'a file';
      if (invocation.state === 'result' && invocation.result.startsWith('Directory:')) {
        verb = 'List';
        icon = 'i-ph:folder';
        renderedPath = 'a directory';
      }
      let extra = '';
      if (args.success && args.data.view_range) {
        const [start, end] = args.data.view_range;
        const endName = end === -1 ? 'end' : end.toString();
        extra = ` (lines ${start} - ${endName})`;
      }
      if (args.success) {
        renderedPath = args.data.path || '/home/project';
      }
      return (
        <div className="flex items-center gap-2">
          <div className={`${icon} text-bolt-elements-textSecondary`} />
          <span>
            {verb} {renderedPath}
            {extra}
          </span>
        </div>
      );
    }
    case 'npmInstall': {
      if (invocation.state === 'partial-call' || invocation.state === 'call') {
        return `Installing dependencies...`;
      } else if (invocation.result?.startsWith('Error:')) {
        return `Failed to install dependencies`;
      } else {
        const args = loggingSafeParse(npmInstallToolParameters, invocation.args);
        if (!args.success) {
          return `Failed to install dependencies`;
        }
        return <span className="font-mono text-sm">{`npm i ${args.data.packages}`}</span>;
      }
    }
    case 'deploy': {
      if (invocation.state === 'partial-call' || invocation.state === 'call') {
        return (
          <div className="flex items-center gap-2">
            <img className="w-4 h-4 mr-1" height="16" width="16" src="/icons/TypeScript.svg" alt="TypeScript" />
            <span>Running TypeScript checks...</span>
          </div>
        );
      } else if (invocation.result?.startsWith('Error:')) {
        if (
          // This is a hack, but `npx convex dev` prints this out when the typecheck fails
          invocation.result.includes('To ignore failing typecheck') ||
          // this is a bigger hack! TypeScript fails with error codes like TS
          invocation.result.includes('Error TS')
        ) {
          return (
            <div className="flex items-center gap-2">
              <img className="w-4 h-4 mr-1" height="16" width="16" src="/icons/TypeScript.svg" alt="TypeScript" />
              <span>Typecheck failed</span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center gap-2">
              <span>Failed to push to Convex</span>
            </div>
          );
        }
      }

      return (
        <div className="flex items-center gap-2">
          <img className="w-4 h-4 mr-1" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
          <span>Pushed functions to Convex</span>
        </div>
      );
    }
    case 'edit': {
      const args = loggingSafeParse(editToolParameters, invocation.args);
      let renderedPath = 'a file';
      if (args.success) {
        renderedPath = args.data.path;
      }
      return (
        <div className="flex items-center gap-2">
          <div className={`i-ph:pencil-line text-bolt-elements-textSecondary`} />
          <span>Edited {renderedPath}</span>
        </div>
      );
    }
    default: {
      return (invocation as any).toolName;
    }
  }
}

function ViewTool({ invocation }: { invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'view') {
    throw new Error('View tool can only be used for the view tool');
  }
  if (invocation.state === 'partial-call' || invocation.state === 'call') {
    return null;
  }
  if (invocation.result.startsWith('Error:')) {
    return (
      <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
        <pre>{invocation.result}</pre>
      </div>
    );
  }

  // Directory listing
  if (invocation.result.startsWith('Directory:')) {
    const items = invocation.result.split('\n').slice(1);
    return (
      <div className="space-y-1 font-mono text-sm p-4 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary">
        {items.map((item: string, i: number) => {
          const isDir = item.includes('(dir)');
          const trimmed = item.replace('(dir)', '').replace('(file)', '').replace('- ', '').trim();
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className={
                  isDir
                    ? 'i-ph:folder-duotone text-bolt-elements-icon-folder'
                    : 'i-ph:file-text-duotone text-bolt-elements-icon-file'
                }
              />
              {trimmed}
            </div>
          );
        })}
      </div>
    );
  }

  // File contents with line numbers
  const lines = invocation.result.split('\n').map((line: string) => {
    const [_, ...content] = line.split(':');
    return content.join(':');
  });
  const args = loggingSafeParse(viewParameters, invocation.args);
  let startLine = 1;
  let language = 'typescript';
  if (args.success) {
    language = getLanguageFromExtension(path.extname(args.data.path));
    if (args.data.view_range) {
      startLine = args.data.view_range[0];
    }
  }
  return <LineNumberViewer lines={lines} startLineNumber={startLine} language={language} />;
}

interface LineNumberViewerProps {
  lines: string[];
  startLineNumber?: number;
  language?: string;
}

const LineNumberViewer = memo(({ lines, startLineNumber = 1, language = 'typescript' }: LineNumberViewerProps) => {
  const [highlighter, setHighlighter] = useState<any>(null);
  const theme = useStore(themeStore);

  useEffect(() => {
    getHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'typescript',
        'javascript',
        'json',
        'html',
        'css',
        'jsx',
        'tsx',
        'python',
        'java',
        'ruby',
        'cpp',
        'c',
        'csharp',
        'go',
        'rust',
        'php',
        'swift',
        'bash',
      ],
    }).then(setHighlighter);
  }, []);

  return (
    <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
      <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line: string, i: number) => (
              <tr key={i} className="group">
                <td className="px-4 py-1 text-right select-none border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary w-12 bg-bolt-elements-background-depth-1">
                  {i + startLineNumber}
                </td>
                <td className="py-1 whitespace-pre group-hover:bg-bolt-elements-background-depth-2">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlighter
                        ? highlighter
                            .codeToHtml(line || ' ', {
                              lang: language,
                              theme: theme === 'dark' ? 'github-dark' : 'github-light',
                            })
                            .replace(/<\/?pre[^>]*>/g, '')
                            .replace(/<\/?code[^>]*>/g, '')
                        : line || ' ',
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

function EditTool({ invocation }: { invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'edit') {
    throw new Error('Edit tool can only be used for the edit tool');
  }
  if (invocation.state === 'partial-call') {
    return null;
  }
  const args = loggingSafeParse(editToolParameters, invocation.args);
  if (!args.success) {
    return null;
  }
  return (
    <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
      <div className="p-4 space-y-4">
        <div className="space-y-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <pre className="text-bolt-elements-icon-error">{args.data.old}</pre>
          </div>
          <div className="flex items-center gap-2">
            <pre className="text-bolt-elements-icon-success">{args.data.new}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

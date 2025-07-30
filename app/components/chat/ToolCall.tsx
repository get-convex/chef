import { useStore } from '@nanostores/react';
import { Terminal as XTerm } from '@xterm/xterm';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  CaretUpIcon,
  CaretDownIcon,
  Cross2Icon,
  CircleIcon,
  CheckIcon,
  FileIcon,
  Pencil1Icon,
  ExternalLinkIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore, type ArtifactState } from '~/lib/stores/workbench.client';
import { type PartId } from '~/lib/stores/artifacts';
import { cubicEasingFn } from '~/utils/easings';
import { classNames } from '~/utils/classNames';
import type { ConvexToolInvocation } from '~/lib/common/types';
import { getTerminalTheme } from '~/components/workbench/terminal/theme';
import { FitAddon } from '@xterm/addon-fit';
import { viewParameters } from 'chef-agent/tools/view';
import { getHighlighter } from 'shiki';
import { themeStore } from '~/lib/stores/theme';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import { path } from 'chef-agent/utils/path';
import { editToolParameters } from 'chef-agent/tools/edit';
import { npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import { loggingSafeParse } from 'chef-agent/utils/zodUtil';
import { deployToolParameters } from 'chef-agent/tools/deploy';
import type { ZodError } from 'zod';
import { Spinner } from '@ui/Spinner';
import { FolderIcon } from '@heroicons/react/24/outline';
import { outputLabels } from '~/lib/runtime/deployToolOutputLabels';
import { getRelativePath } from 'chef-agent/utils/workDir';
import { lookupDocsParameters } from 'chef-agent/tools/lookupDocs';
import { Markdown } from '~/components/chat/Markdown';
import { addEnvironmentVariablesParameters } from 'chef-agent/tools/addEnvironmentVariables';
import { openDashboardToPath } from '~/lib/stores/dashboardPath';

export const ToolCall = memo(function ToolCall({ partId, toolCallId }: { partId: PartId; toolCallId: string }) {
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

  // Early return if artifact doesn't exist
  if (!artifact) {
    return null;
  }

  if (!action) {
    return null;
  }
  return (
    <div className="artifact flex w-full flex-col overflow-hidden rounded-lg border duration-150">
      <div className="flex">
        <button
          className="flex w-full items-stretch overflow-hidden bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="w-full p-3.5 px-5 text-left">
            <div className="flex items-center gap-1.5">
              <div className="w-full text-sm font-medium leading-5 text-content-primary">{title}</div>
              {icon}
            </div>
          </div>
        </button>
        <div className="w-px bg-bolt-elements-artifacts-borderColor" />
        <AnimatePresence>
          {artifact.type !== 'bundled' && parsed.toolName !== 'getConvexDeploymentName' && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              disabled={parsed.state === 'partial-call'}
              onClick={toggleAction}
            >
              <div className="p-4 text-content-primary">{showAction ? <CaretUpIcon /> : <CaretDownIcon />}</div>
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
            <div className="h-px bg-bolt-elements-artifacts-borderColor" />
            <div className="bg-bolt-elements-actions-background p-5 text-left">
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

const ToolUseContents = memo(function ToolUseContents({
  artifact,
  invocation,
}: {
  artifact: ArtifactState;
  invocation: ConvexToolInvocation;
}) {
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
    case 'lookupDocs': {
      return <LookupDocsTool invocation={invocation} />;
    }
    case 'addEnvironmentVariables': {
      return <AddEnvironmentVariablesTool invocation={invocation} />;
    }
    case 'getConvexDeploymentName': {
      return <GetConvexDeploymentNameTool invocation={invocation} />;
    }
    default: {
      // Fallback for other tool types
      return <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(invocation, null, 2)}</pre>;
    }
  }
});

function DeployTool({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'deploy') {
    throw new Error('Terminal can only be used for the deploy tool');
  }

  if (invocation.state === 'call' || invocation.state === 'result') {
    return <Terminal artifact={artifact} invocation={invocation} />;
  }

  return null;
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

    return (
      <div className="overflow-hidden rounded-lg border bg-bolt-elements-terminals-background font-mono text-sm text-content-primary">
        <div className="h-40" ref={terminalElementRef} />
      </div>
    );
  }),
);

function NpmInstallTool({ artifact, invocation }: { artifact: ArtifactState; invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'npmInstall') {
    throw new Error('Terminal can only be used for the npmInstall tool');
  }

  if (invocation.state === 'call' || (invocation.state === 'result' && invocation.result.startsWith('Error:'))) {
    return <Terminal artifact={artifact} invocation={invocation} />;
  }

  return null;
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
    inner = <Cross2Icon />;
    color = 'text-bolt-elements-icon-error';
  } else {
    switch (status) {
      case 'running':
        inner = <Spinner />;
        color = 'text-bolt-elements-loader-progress';
        break;
      case 'pending':
        inner = <CircleIcon />;
        color = 'text-content-tertiary';
        break;
      case 'complete':
        inner = <CheckIcon />;
        color = 'text-bolt-elements-icon-success';
        break;
      case 'failed':
        inner = <Cross2Icon />;
        color = 'text-bolt-elements-icon-error';
        break;
      case 'aborted':
        inner = <Cross2Icon />;
        color = 'text-content-secondary';
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
      let icon = <FileIcon />;
      let renderedPath = 'a file';
      if (invocation.state === 'result' && invocation.result.startsWith('Directory:')) {
        verb = 'List';
        icon = <FolderIcon className="size-4" />;
        renderedPath = 'a directory';
      }
      let extra = '';
      if (args.success && args.data.view_range) {
        const [start, end] = args.data.view_range;
        const endName = end === -1 ? 'end' : end.toString();
        extra = ` (lines ${start} - ${endName})`;
      }
      if (args.success) {
        renderedPath = getRelativePath(args.data.path) || '/home/project';
      }
      return (
        <div className="flex items-center gap-2">
          <div className="text-content-secondary">{icon}</div>
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
            <img className="mr-1 size-4" height="16" width="16" src="/icons/TypeScript.svg" alt="TypeScript" />
            <span>Running TypeScript checks...</span>
          </div>
        );
      } else if (invocation.result?.startsWith('Error:')) {
        if (
          invocation.result.includes(`[${outputLabels.convexTypecheck}]`) ||
          invocation.result.includes(`[${outputLabels.frontendTypecheck}]`)
        ) {
          return (
            <div className="flex items-center gap-2">
              <img className="mr-1 size-4" height="16" width="16" src="/icons/TypeScript.svg" alt="TypeScript" />
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
          <img className="mr-1 size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
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
          <Pencil1Icon className="text-content-secondary" />
          <span>Edited {renderedPath}</span>
        </div>
      );
    }
    case 'lookupDocs': {
      const args = loggingSafeParse(lookupDocsParameters, invocation.args);
      if (!args.success) {
        return 'Looking up documentation...';
      }
      return (
        <div className="flex items-center gap-2">
          <FileIcon className="text-content-secondary" />
          <span>Looked up documentation for: {args.data.docs.join(', ')}</span>
        </div>
      );
    }
    case 'addEnvironmentVariables': {
      const args = loggingSafeParse(addEnvironmentVariablesParameters, invocation.args);
      if (!args.success) {
        return 'Adding environment variables...';
      }
      return (
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="text-content-warning" />
          <span className="font-medium text-content-warning">Action Required: Add Environment Variables</span>
        </div>
      );
    }
    case 'getConvexDeploymentName': {
      if (invocation.state === 'partial-call' || invocation.state === 'call') {
        return 'Getting Convex deployment name...';
      } else if (invocation.result?.startsWith('Error:')) {
        return 'Failed to get Convex deployment name';
      } else {
        return (
          <div className="flex items-center gap-2">
            <img className="mr-1 size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
            <span>Got Convex deployment name: {invocation.result}</span>
          </div>
        );
      }
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
      <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
        <pre>{invocation.result}</pre>
      </div>
    );
  }

  // Directory listing
  if (invocation.result.startsWith('Directory:')) {
    const items = invocation.result.split('\n').slice(1);
    return (
      <div className="space-y-1 rounded-lg border p-4 font-mono text-sm text-content-primary">
        {items.map((item: string, i: number) => {
          const isDir = item.includes('(dir)');
          const trimmed = item.replace('(dir)', '').replace('(file)', '').replace('- ', '').trim();
          return (
            <div key={i} className="flex items-center gap-2">
              {isDir ? <FolderIcon className="size-4" /> : <FileIcon />}
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

const LineNumberViewer = memo(function LineNumberViewer({
  lines,
  startLineNumber = 1,
  language = 'typescript',
}: LineNumberViewerProps) {
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
    <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line: string, i: number) => (
              <tr key={i} className="group">
                <td className="w-12 select-none border-r bg-bolt-elements-background-depth-1 px-4 py-1 text-right text-content-tertiary">
                  {i + startLineNumber}
                </td>
                <td className="whitespace-pre py-1 group-hover:bg-bolt-elements-background-depth-2">
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
    <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
      <div className="space-y-4 p-4">
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

function LookupDocsTool({ invocation }: { invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'lookupDocs') {
    throw new Error('LookupDocs tool can only be used for the lookupDocs tool');
  }
  if (invocation.state === 'partial-call' || invocation.state === 'call') {
    return null;
  }
  if (invocation.result.startsWith('Error:')) {
    return (
      <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
        <pre>{invocation.result}</pre>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
      <div className="max-h-[400px] overflow-auto p-4">
        <Markdown html>{invocation.result}</Markdown>
      </div>
    </div>
  );
}

function AddEnvironmentVariablesTool({ invocation }: { invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'addEnvironmentVariables') {
    throw new Error('AddEnvironmentVariablesTool can only be used for the addEnvironmentVariables tool');
  }
  if (invocation.state === 'partial-call' || invocation.state === 'call') {
    return null;
  }
  const args = loggingSafeParse(addEnvironmentVariablesParameters, invocation.args);
  if (!args.success) {
    return null;
  }
  if (invocation.result.startsWith('Error:') || !args.success) {
    return (
      <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
        <pre>{invocation.result}</pre>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
      <div className="space-y-2 p-4">
        <div className="flex  gap-2">
          <span>Configure these environment variables in the Convex dashboard:</span>
          <button
            className="flex items-center rounded-md bg-transparent p-1 text-content-primary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-item-contentActive"
            title="Open dashboard to add environment variables"
            onClick={() => {
              openDashboardToPath('settings/environment-variables');
            }}
          >
            <ExternalLinkIcon />
          </button>
        </div>
        <ul className="list-disc pl-4">
          {args.data.envVarNames.map((name: string) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GetConvexDeploymentNameTool({ invocation }: { invocation: ConvexToolInvocation }) {
  if (invocation.toolName !== 'getConvexDeploymentName') {
    throw new Error('GetConvexDeploymentNameTool can only be used for the getConvexDeploymentName tool');
  }
  if (invocation.state === 'partial-call' || invocation.state === 'call') {
    return null;
  }
  if (invocation.result.startsWith('Error:')) {
    return (
      <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
        <pre>{invocation.result}</pre>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-bolt-elements-background-depth-1 font-mono text-sm text-content-primary">
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <span>Convex Deployment Name:</span>
          <code className="rounded bg-bolt-elements-background-depth-2 px-2 py-1 font-mono">{invocation.result}</code>
        </div>
      </div>
    </div>
  );
}

import { useStore } from '@nanostores/react';
import type { ToolInvocation } from 'ai';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import { memo, useMemo, useRef, useState } from 'react';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { cubicEasingFn } from '~/utils/easings';
import { editorToolParameters } from '~/lib/runtime/editorTool';
import { bashToolParameters } from '~/lib/runtime/bashTool';
import { classNames } from '~/utils/classNames';
import { path } from '~/utils/path';
import { WORK_DIR } from '~/utils/constants';

export const ToolCall = memo((props: { messageId: string; toolCallId: string }) => {
  const { messageId, toolCallId } = props;
  const userToggledAction = useRef(false);
  const [showAction, setShowAction] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[messageId];

  const actions = useStore(artifact.runner.actions);
  const pair = Object.entries(actions).find(([actionId]) => actionId === toolCallId);
  const action = pair && pair[1];

  const toggleAction = () => {
    userToggledAction.current = true;
    setShowAction(!showAction);
  };

  const parsed: ToolInvocation = useMemo(() => JSON.parse(action?.content ?? '{}'), [action?.content]);
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
              disabled={parsed.state === 'partial-call' || parsed.state === 'call'}
              onClick={toggleAction}
            >
              <div className="p-4">
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
                  <ToolUseContents invocation={parsed} />
                </ul>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const ToolUseContents = memo(({ invocation }: { invocation: ToolInvocation }) => {
  if (invocation.state !== 'result') {
    return null;
  }

  if (invocation.toolName === 'bash') {
    return (
      <div className="font-mono text-sm bg-bolt-elements-terminals-background text-bolt-elements-textPrimary p-4 rounded-lg border border-bolt-elements-borderColor overflow-x-auto whitespace-pre">
        {invocation.result}
      </div>
    );
  }

  if (invocation.toolName === 'str_replace_editor') {
    const args = editorToolParameters.parse(invocation.args) as
      | { command: 'create'; path: string; file_text: string }
      | { command: 'view'; path: string }
      | { command: 'str_replace'; path: string; old_str: string; new_str: string }
      | { command: 'insert'; path: string; insert_line: number; new_str: string }
      | { command: 'undo_edit'; path: string };

    if (args.command === 'view') {
      // Directory listing
      if (invocation.result.startsWith('Directory:')) {
        const items = invocation.result.split('\n').slice(1);
        return (
          <div className="space-y-1 font-mono text-sm p-4 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary">
            {items.map((item: string, i: number) => {
              const isDir = item.includes('(dir)');
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={
                      isDir
                        ? 'i-ph:folder-duotone text-bolt-elements-icon-folder'
                        : 'i-ph:file-text-duotone text-bolt-elements-icon-file'
                    }
                  />
                  {item}
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
      const startLine = Number(invocation.result.split('\n')[0].split(':')[0]);
      return <LineNumberViewer lines={lines} startLineNumber={startLine} />;
    }

    if (args.command === 'create') {
      const { file_text: fileText } = args;
      return (
        <div className="space-y-2">
          <LineNumberViewer lines={fileText.split('\n')} />
        </div>
      );
    }

    if (args.command === 'insert') {
      const { insert_line: insertLine, new_str: newStr } = args;
      return (
        <div className="space-y-2">
          <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="px-4 py-1 text-right select-none border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary w-12 bg-bolt-elements-background-depth-1">
                      {insertLine}
                    </td>
                    <td className="py-1 whitespace-pre group-hover:bg-bolt-elements-background-depth-2 bg-green-500/10 dark:bg-green-500/20 border-l-4 border-green-500">
                      {newStr}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (args.command === 'str_replace') {
      const { old_str: oldStr, new_str: newStr } = args;
      return (
        <div className="space-y-2">
          <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {oldStr.split('\n').map((line: string, i: number) => (
                    <tr key={`old-${i}`} className="group">
                      <td className="px-4 py-1 text-right select-none border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary w-12 bg-bolt-elements-background-depth-1">
                        {i + 1}
                      </td>
                      <td className="py-1 whitespace-pre group-hover:bg-bolt-elements-background-depth-2 bg-red-500/10 dark:bg-red-500/20 border-l-4 border-red-500">
                        {line}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-1 text-center text-bolt-elements-textTertiary border-y border-bolt-elements-borderColor"
                    >
                      ↓
                    </td>
                  </tr>
                  {newStr.split('\n').map((line: string, i: number) => (
                    <tr key={`new-${i}`} className="group">
                      <td className="px-4 py-1 text-right select-none border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary w-12 bg-bolt-elements-background-depth-1">
                        {i + 1}
                      </td>
                      <td className="py-1 whitespace-pre group-hover:bg-bolt-elements-background-depth-2 bg-green-500/10 dark:bg-green-500/20 border-l-4 border-green-500">
                        {line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (args.command === 'undo_edit') {
      return (
        <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
          <div className="i-ph:arrow-counter-clockwise text-bolt-elements-icon-success" />
          {invocation.result}
        </div>
      );
    }
  }

  // Fallback for other tool types
  return <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(invocation, null, 2)}</pre>;
});

function statusIcon(status: ActionState['status'], invocation: ToolInvocation) {
  let inner: React.ReactNode;
  let color: string;
  if (invocation.state === 'result' && invocation.result.startsWith('Error:')) {
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

function toolTitle(invocation: ToolInvocation): React.ReactNode {
  switch (invocation.toolName) {
    case 'str_replace_editor': {
      if (invocation.state === 'partial-call') {
        return `Editing file...`;
      } else {
        const args = editorToolParameters.parse(invocation.args);
        const p = path.relative(WORK_DIR, args.path);
        switch (args.command) {
          case 'str_replace': {
            return (
              <div className="flex items-center gap-2">
                <div className="i-ph:pencil-simple text-bolt-elements-textSecondary" />
                <span>Edit {p}</span>
              </div>
            );
          }
          case 'insert': {
            return (
              <div className="flex items-center gap-2">
                <div className="i-ph:pencil-simple text-bolt-elements-textSecondary" />
                <span>
                  Insert into {p} at line {args.insert_line}
                </span>
              </div>
            );
          }
          case 'create': {
            return (
              <div className="flex items-center gap-2">
                <div className="i-ph:file-plus text-bolt-elements-textSecondary" />
                <span>Create {p}</span>
              </div>
            );
          }
          case 'view': {
            let verb = 'Read';
            if (invocation.state === 'result' && invocation.result.startsWith('Directory:')) {
              verb = 'List';
            }
            let extra = '';
            if (args.view_range) {
              const [start, end] = args.view_range;
              extra = ` (lines ${start} - ${end})`;
            }
            return (
              <div className="flex items-center gap-2">
                <div className="i-ph:file-text text-bolt-elements-textSecondary" />
                <span>
                  {verb} {p || '/home/project'}
                  {extra}
                </span>
              </div>
            );
          }
          case 'undo_edit': {
            return (
              <div className="flex items-center gap-2">
                <div className="i-ph:arrow-counter-clockwise text-bolt-elements-textSecondary" />
                <span>Undo edit to {p}</span>
              </div>
            );
          }
        }
      }
    }
    case 'bash': {
      const args = bashToolParameters.parse(invocation.args);
      return (
        <div className="flex items-center gap-2 text-sm">
          <div className="i-ph:terminal-window text-bolt-elements-textSecondary" />
          <code className="font-mono bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md">
            {args.command}
          </code>
        </div>
      );
    }
    default: {
      return invocation.toolName;
    }
  }
}

interface LineNumberViewerProps {
  lines: string[];
  startLineNumber?: number;
}

const LineNumberViewer = memo(({ lines, startLineNumber = 1 }: LineNumberViewerProps) => {
  return (
    <div className="font-mono text-sm bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden text-bolt-elements-textPrimary">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line: string, i: number) => (
              <tr key={i} className="group">
                <td className="px-4 py-1 text-right select-none border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary w-12 bg-bolt-elements-background-depth-1">
                  {i + startLineNumber}
                </td>
                <td className="py-1 whitespace-pre group-hover:bg-bolt-elements-background-depth-2">{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

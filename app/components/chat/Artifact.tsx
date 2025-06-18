import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import { FileIcon, CaretUpIcon, CaretDownIcon, CircleIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { type PartId } from '~/lib/stores/artifacts';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { summarize } from '~/utils/summarize';
import { captureException } from '@sentry/remix';
import type { RelativePath } from 'chef-agent/utils/workDir';
import { getAbsolutePath } from 'chef-agent/utils/workDir';
import { Spinner } from '@ui/Spinner';
const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const shellHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.shellHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.shellHighlighter = shellHighlighter;
}

interface ArtifactProps {
  partId: PartId;
}

export const Artifact = memo(function Artifact({ partId }: ArtifactProps) {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[partId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions);
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0 && artifact.type === 'bundled') {
      const finished = !actions.find((action) => action.status !== 'complete');

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
    // We only want to run this when `actions` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  return (
    <div className="artifact flex w-full flex-col overflow-hidden rounded-lg border">
      <div className="flex">
        <button
          className="flex w-full items-stretch overflow-hidden bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          {artifact.type == 'bundled' && (
            <>
              <div className="p-4">{allActionFinished ? <FileIcon /> : <Spinner />}</div>
              <div className="w-px bg-bolt-elements-artifacts-borderColor" />
            </>
          )}
          <div className="w-full p-3.5 px-5 text-left">
            <div className="w-full text-sm font-medium leading-5 text-content-primary">{artifact?.title}</div>
            <div className="mt-0.5 w-full text-xs text-content-secondary">Click to open Workbench</div>
          </div>
        </button>
        <div className="w-px bg-bolt-elements-artifacts-borderColor" />
        <AnimatePresence>
          {actions.length && artifact.type !== 'bundled' && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              onClick={toggleActions}
            >
              <div className="p-4">{showActions ? <CaretUpIcon /> : <CaretDownIcon />}</div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {artifact.type !== 'bundled' && showActions && actions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="h-px bg-bolt-elements-artifacts-borderColor" />

            <div className="bg-bolt-elements-actions-background p-5 text-left">
              <ActionList actions={actions} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function openArtifactInWorkbench(filePath: RelativePath) {
  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }
  workbenchStore.resumeFollowingStreamedCode();
  workbenchStore.setSelectedFile(getAbsolutePath(filePath));
}

const ActionList = memo(function ActionList({ actions }: ActionListProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-2.5">
        {actions.map((action, index) => {
          const { status, type } = action;
          if (type !== 'file') {
            // This happens a ton, it's just telling us that our TypeScript types are wrong, we have an action that
            // surprises us.
            if (Math.random() < 0.001) {
              captureException(
                `Action is not a file (so our typescript types are wrong): ${JSON.stringify(summarize(action))}`,
              );
            }
            return null;
          }
          const message = action.isEdit ? 'Edit' : 'Create';
          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm">
                <div className={classNames('text-lg', getIconColor(action.status))}>
                  {status === 'running' ? (
                    <Spinner />
                  ) : status === 'pending' ? (
                    <CircleIcon />
                  ) : status === 'complete' ? (
                    <CheckIcon />
                  ) : status === 'failed' || status === 'aborted' ? (
                    <Cross2Icon />
                  ) : null}
                </div>
                <div>
                  {message}{' '}
                  <code
                    className="cursor-pointer rounded-md bg-bolt-elements-artifacts-inlineCode-background px-1.5 py-1 text-bolt-elements-artifacts-inlineCode-text text-bolt-elements-item-contentAccent hover:underline"
                    onClick={() => openArtifactInWorkbench(action.filePath)}
                  >
                    {action.filePath}
                  </code>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-content-tertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-bolt-elements-icon-success';
    }
    case 'aborted': {
      return 'text-content-secondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}

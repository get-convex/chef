import { Button } from '@ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { subchatIndexStore, subchatLoadedStore } from '../ExistingChat.client';
import { classNames } from '~/utils/classNames';
import type { Id } from '@convex/_generated/dataModel';

interface SubchatBarProps {
  subchats?: { subchatIndex: number; description?: string }[];
  currentSubchatIndex: number;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  isStreaming: boolean;
  disableChatMessage: boolean;
  sessionId: Id<'sessions'> | null;
  chatId: string;
  onNavigateToSubchat: (direction: 'prev' | 'next') => void;
}

export function SubchatBar({
  subchats,
  currentSubchatIndex,
  canNavigatePrev,
  canNavigateNext,
  isStreaming,
  disableChatMessage,
  sessionId,
  chatId,
  onNavigateToSubchat,
}: SubchatBarProps) {
  const createSubchat = useMutation(api.subchats.create);

  return (
    <div className="sticky top-0 z-10 mx-auto w-full max-w-chat mb-4 pt-4">
      <div className="flex items-center justify-between rounded-lg border border-content-secondary/20 bg-background-secondary/50 px-4 py-2 backdrop-blur-sm">
        <div className={classNames('flex rounded-lg bg-background-secondary border')}>
          <Button
            size="xs"
            variant="neutral"
            className={classNames('rounded-r-none border-0 border-border-transparent dark:border-border-transparent')}
            icon={<ArrowLeftIcon className="my-[1px]" />}
            inline
            tip="Previous Subchat"
            disabled={!canNavigatePrev || isStreaming}
            onClick={() => {
              onNavigateToSubchat('prev');
            }}
          />
          <Button
            size="xs"
            variant="neutral"
            className={classNames('rounded-l-none border-0 border-border-transparent dark:border-border-transparent')}
            icon={<ArrowRightIcon className="my-[1px]" />}
            inline
            tip="Next Subchat"
            disabled={!canNavigateNext || isStreaming}
            onClick={() => {
              onNavigateToSubchat('next');
            }}
          />
        </div>

        {/* Center: Subchat info */}
        <div className="flex items-center gap-2 text-sm font-medium text-content-secondary">
          <span>Subchat</span>
          <span className="text-content-primary">{currentSubchatIndex + 1}</span>
          <span>of</span>
          <span className="text-content-primary">{Math.max(currentSubchatIndex + 1, subchats?.length ?? 1)}</span>
        </div>

        {/* Right: Add feature button */}
        <div>
          {sessionId ? (
            <Button
              size="xs"
              variant="neutral"
              className={classNames('flex rounded-lg bg-background-secondary border')}
              icon={<PlusIcon className="my-[1px]" />}
              disabled={disableChatMessage || isStreaming || (subchats && currentSubchatIndex !== subchats?.length - 1)}
              inline
              tip="New Subchat"
              onClick={async () => {
                const subchatIndex = await createSubchat({ chatId, sessionId });
                subchatLoadedStore.set(false);
                subchatIndexStore.set(subchatIndex);
              }}
            />
          ) : (
            <div className="w-6" />
          )}
        </div>
      </div>
    </div>
  );
}

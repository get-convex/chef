import type { UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { makePartId } from 'chef-agent/partId';
import { toast } from 'sonner';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { messageParser, processMessage, type PartCache } from '~/lib/hooks/useMessageParser';
import { subchatIndexStore } from '~/lib/stores/subchats';
import { useStore } from '@nanostores/react';

export type ReloadedMessages = {
  partCache: PartCache;
};

export function useReloadMessages(initialMessages: UIMessage[] | undefined): ReloadedMessages | undefined {
  const [reloadState, setReloadState] = useState<ReloadedMessages | undefined>(undefined);
  const subchatIndex = useStore(subchatIndexStore);
  useEffect(() => {
    if (initialMessages === undefined) {
      return;
    }
    const reload = async () => {
      try {
        const partCache: PartCache = new Map();
        for (const message of initialMessages) {
          if (!message.parts) {
            continue;
          }
          for (let i = 0; i < message.parts.length; i++) {
            const partId = makePartId(message.id, i);
            workbenchStore.addReloadedPart(partId);
          }
          processMessage(message, partCache);
        }
        setReloadState({ partCache });
        messageParser.reset();
      } catch (error) {
        toast.error('Failed to load previous chat messages from Convex.');
        console.error('Error reloading messages:', error);
      }
    };
    void reload();
  }, [initialMessages, subchatIndex]);
  return reloadState;
}

import type { Message } from 'ai';
import { useEffect, useState } from 'react';
import { makePartId } from 'chef-agent/partId';
import { toast } from 'sonner';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { processMessage, type PartCache } from '~/lib/hooks/useMessageParser';

export type ReloadedMessages = {
  partCache: PartCache;
};

export function useReloadMessages(initialMessages: Message[] | undefined): ReloadedMessages | undefined {
  const [reloadState, setReloadState] = useState<ReloadedMessages | undefined>(undefined);
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
      } catch (error) {
        toast.error('Failed to load previous chat messages from Convex.');
        console.error('Error reloading messages:', error);
      }
    };
    void reload();
  }, [initialMessages]);
  return reloadState;
}

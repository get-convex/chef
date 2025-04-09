import { useStore } from '@nanostores/react';
import { map } from 'nanostores';
import { chatIdStore } from '~/lib/persistence/chatIdStore';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
});

export function useChatId() {
  return useStore(chatIdStore);
}

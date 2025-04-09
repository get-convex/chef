/* All chats eventually have two IDs:
 * - The initialId is the ID of the chat when it is first created (a UUID)
 * - The urlId is the ID of the chat that is displayed in the URL. This is a human-friendly ID that is
 *   displayed in the URL.
 *
 * Server-side functions accept either, so we call their union a `chatId`.
 */
import { useStore } from '@nanostores/react';
import { atom, computed, map } from 'nanostores';

/*
 * When loading the homepage, we set `pageLoadMixedId` to a randomly generated initialId.
 * When loading `/chat`, the user may provide either an initialId or a urlId.
 */
const pageLoadChatId = atom<string | undefined>(undefined);

export function setPageLoadChatId(chatId: string) {
  const existing = pageLoadChatId.get();
  if (existing !== undefined && existing !== chatId) {
    throw new Error(`pageLoadChatId already set to ${existing} but trying to set to ${chatId}`);
  }
  pageLoadChatId.set(chatId);
}

/*
 * If the user loads `/chat` with a urlId, we only know the `initialId` after we're done
 * loading the chat.
 */
const knownInitialId = atom<string | undefined>(undefined);

export function getKnownInitialId() {
  return knownInitialId.get();
}

export function setKnownInitialId(initialId: string) {
  if (!knownInitialId.get() && !knownUrlId.get()) {
    navigateChat(initialId);
  }
  knownInitialId.set(initialId);
}

/*
 * We may not know a chat's `urlId` until its first message.
 */
const knownUrlId = atom<string | undefined>(undefined);

export function getKnownUrlId() {
  return knownUrlId.get();
}

export function setKnownUrlId(urlId: string) {
  if (!knownUrlId.get()) {
    navigateChat(urlId);
  }
  knownUrlId.set(urlId);
}

export const chatIdStore = computed(
  [pageLoadChatId, knownInitialId, knownUrlId],
  (pageLoadChatId, knownInitialId, knownUrlId) => {
    if (knownUrlId !== undefined) {
      return knownUrlId;
    }
    if (knownInitialId !== undefined) {
      return knownInitialId;
    }
    if (pageLoadChatId === undefined) {
      throw new Error('chatIdStore used before pageLoadChatId was set');
    }
    return pageLoadChatId;
  },
);

export function useChatId() {
  return useStore(chatIdStore);
}

// Very important: This *only* updates the state in `window.history` and
// does not reload the app. This way we keep all our in-memory state
// intact.
function navigateChat(chatId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${chatId}`;
  window.history.replaceState({}, '', url);
}

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
});

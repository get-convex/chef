import type { Id } from '@convex/_generated/dataModel';
import { type ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CONVEX_INVITE_CODE_QUERY_PARAM } from '~/lib/persistence/convex';

export function removeCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(CONVEX_INVITE_CODE_QUERY_PARAM);
  window.history.replaceState({}, '', url);
}

export async function validateAccessCode(
  convex: ConvexReactClient,
  args: { code: string | null; localStorageEntry: string | null },
): Promise<Id<'sessions'> | null> {
  if (args.localStorageEntry) {
    let isValidSession: boolean = false;
    try {
      isValidSession = await convex.query(api.sessions.verifySession, {
        sessionId: args.localStorageEntry as Id<'sessions'>,
        flexAuthMode: 'InviteCode',
      });
    } catch (_error) {
      return null;
    }
    if (isValidSession) {
      return args.localStorageEntry as Id<'sessions'>;
    }
    return null;
  }
  if (args.code === null) {
    return null;
  }
  let sessionId: Id<'sessions'> | null = null;
  try {
    sessionId = await convex.mutation(api.sessions.getSession, { code: args.code });
  } catch (_error) {
    return null;
  }
  if (sessionId) {
    return sessionId;
  }
  return null;
}

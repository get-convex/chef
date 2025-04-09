import type { LoaderFunctionArgs } from '@vercel/remix';
import { json } from '@vercel/remix';
import { meta as IndexMeta } from './_index';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { SafariWarning } from '~/components/SafariWarning';
import { ExistingChat } from '~/components/ExistingChat.client';
import { redirect, useLoaderData } from '@remix-run/react';

export const meta = IndexMeta;

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const code = url.searchParams.get('code');
  return json({ id: args.params.id, code });
}

// This route is *only* used when reloading an existing chat. The flow
// of going to the homepage and typing in a prompt goes through
// `_index.tsx` and then does a client navigation without rendering
// `ChatRoute` directly.
//
// So, this route is less latency critical the the homepage, and we're
// more comfortable showing spinners to rehydrate the app state.
export default function ChatRoute() {
  const loaderData = useLoaderData<{ id: string }>();
  if (!loaderData.id) {
    redirect('/');
  }
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ClientOnly>
        {() => (
          <>
            <ExistingChat chatId={loaderData.id} />
            <SafariWarning />
          </>
        )}
      </ClientOnly>
    </div>
  );
}

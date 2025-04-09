import type { AppLoadContext, EntryContext } from '@vercel/remix';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import * as Sentry from '@sentry/remix';
import { waitUntil } from '@vercel/functions';
import type { renderToReadableStream as RenderToReadableStream } from 'react-dom/server';
// @ts-ignore There just aren't types for it, long-standing issue
import { renderToReadableStream as renderToReadableStreamSSR } from 'react-dom/server.browser';
import { renderHeadToString } from 'remix-island';
const renderToReadableStream = renderToReadableStreamSSR as typeof RenderToReadableStream;
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

Sentry.init({
  dsn: 'https://16615d9875b4630cfabeed5d376c4343@o1192621.ingest.us.sentry.io/4509097600811008',
  tracesSampleRate: 1,
});

export function handleError(error: Error, { request }: { request: Request }) {
  Sentry.captureRemixServerException(error, 'remix.server', request);
  console.log('this is the handleErr');
  waitUntil(Sentry.flush());
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    // TODO we ought to abort, say by timeout, but it looked involved:
    // see https://github.com/vercel/next.js/issues/56919
    // and https://github.com/remix-run/remix/issues/10014
    // and https://github.com/remix-run/remix/pull/10047/files/4b9036ed72a21008e8559bd06c6292c457f9e0db
    //signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
              controller.close();

              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            controller.error(error);
            readable.cancel();
          });
      }
      read();
    },

    cancel() {
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

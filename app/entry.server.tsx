import type { AppLoadContext, EntryContext } from '@vercel/remix';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';

import type { renderToReadableStream as RenderToReadableStream } from 'react-dom/server';
// @ts-ignore There just aren't types for it, long-standing issue
import { renderToReadableStream as renderToReadableStreamSSR } from 'react-dom/server.browser';
const renderToReadableStream = renderToReadableStreamSSR as typeof RenderToReadableStream;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  const body = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
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

  if (isbot(request.headers.get('user-agent') || '')) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

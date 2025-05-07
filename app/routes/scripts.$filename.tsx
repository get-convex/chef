import type { LoaderFunction } from '@vercel/remix';

// This is a separate codebase.
// eslint-disable-next-line no-restricted-imports
import IFRAME_WORKER_SERVER_SOURCE from '../../iframe-worker/worker.bundled.mjs?raw';

export const loader: LoaderFunction = async ({ params }) => {
  const filename = params.filename || params['*'];

  if (filename === 'worker.bundled.mjs') {
    return new Response(IFRAME_WORKER_SERVER_SOURCE, {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000',
        // We can't echo the origin back because some WebContainer origins don't match the origins they send!
        // e.g. a network request may send an Origin of
        // https://k03e2io1v3fx9wvj0vr8qd5q58o56n-fkdo--50415--d4eba4a9.local-credentialless.webcontainer-api.io
        // while that window's actual origin is
        // https://k03e2io1v3fx9wvj0vr8qd5q58o56n-fkdo-p263xdja--50415--d4eba4a9.local-credentialless.webcontainer-api.io
        // when it's the second webcontainer on that machine on that port.
        // Something to do with some multiplexing?
        // Another option is to disallow multiple web containers or not reuse proxy ports across browser tabs.
        // But we don't need it: these requests don't use credentials, the only reason you need to not use *.
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  return new Response('script not found', {
    status: 404,
  });
};

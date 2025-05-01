import type { LoaderFunction } from '@vercel/remix';

// This is a separate codebase.
// eslint-disable-next-line no-restricted-imports
import IFRAME_WORKER_SERVER_SOURCE from '../../iframe-worker/worker.bundled.mjs?raw';

export const loader: LoaderFunction = async ({ params, request }) => {
  const filename = params.filename || params['*'];

  const origin = request.headers.get('Origin') || '';

  if (filename === 'worker.bundled.mjs') {
    return new Response(IFRAME_WORKER_SERVER_SOURCE, {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000',
        // CORS headers
        'Access-Control-Allow-Origin': origin, // Allow any domain to access
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  return new Response('script not found', {
    status: 404,
  });
};

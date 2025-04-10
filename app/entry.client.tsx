import * as Sentry from '@sentry/remix';
import { RemixBrowser, useLocation, useMatches } from '@remix-run/react';
import { startTransition, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

Sentry.init({
  dsn: 'https://16615d9875b4630cfabeed5d376c4343@o1192621.ingest.us.sentry.io/4509097600811008',
  tracesSampleRate: 1,

  integrations: [
    Sentry.feedbackIntegration({
      colorScheme: 'system',
      autoInject: false,
      showName: false,
      showEmail: false,
    }),
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
});

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

import * as Sentry from '@sentry/remix';
import { RemixBrowser, useLocation, useMatches } from '@remix-run/react';
import { startTransition, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

const enableSentry = // exposed via vite.config.ts
  globalThis.process.env.VERCEL_ENV === 'production' || globalThis.process.env.VERCEL_GIT_COMMIT_REF === 'staging';

if (typeof window !== 'undefined') {
  (window as any).chefSentryEnabled = enableSentry;
}

Sentry.init({
  dsn: 'https://16615d9875b4630cfabeed5d376c4343@o1192621.ingest.us.sentry.io/4509097600811008',
  enabled: enableSentry,
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
      maskAllInputs: false,
    }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
});

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

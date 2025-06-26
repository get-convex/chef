import { captureMessage, captureRemixErrorBoundaryError } from '@sentry/remix';
import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@vercel/remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react';
import { themeStore } from '~/lib/stores/theme';
import { stripIndents } from 'chef-agent/utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import globalStyles from '~/styles/index.css?url';
import '@convex-dev/design-system/styles/shared.css';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';
import posthog from 'posthog-js';

import 'allotment/dist/style.css';

import { ErrorDisplay } from '~/components/ErrorComponent';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('class', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || globalThis.process.env.CONVEX_URL!;

if (!CONVEX_URL) {
  throw new Error(`Missing CONVEX_URL: ${CONVEX_URL}`);
}
const convex = new ConvexReactClient(CONVEX_URL, {
  onServerDisconnectError: (message) => captureMessage(message),
});

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  // TODO does it still make sense?
  useEffect(() => {
    document.querySelector('html')?.setAttribute('class', theme);
  }, [theme]);

  useEffect(() => {
    // Note that this is the 'Project API Key' from PostHog, which is
    // write-only and PostHog says is safe to use in public apps.
    const key = import.meta.env.VITE_POSTHOG_KEY || '';
    const apiHost = import.meta.env.VITE_POSTHOG_HOST || '';

    // See https://posthog.com/docs/libraries/js#config
    posthog.init(key, {
      api_host: apiHost,
      ui_host: 'https://us.posthog.com/',
      // Set to true to log PostHog events to the console.
      debug: false,
      enable_recording_console_log: false,
      capture_pageview: true,
      // By default, we use 'cookieless' tracking
      // (https://posthog.com/tutorials/cookieless-tracking) and may change this
      // later if we add a cookie banner.
      persistence: 'memory',
    });
  }, []);

  return (
    <>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  return <ErrorDisplay error={error} />;
};

export default function App() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

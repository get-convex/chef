import { captureRemixErrorBoundaryError, captureMessage } from '@sentry/remix';
import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@vercel/remix';
import { json } from '@vercel/remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData, useRouteError } from '@remix-run/react';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from 'chef-agent/utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { ConvexProviderWithAuthKit } from '@convex-dev/workos';
import { ConvexReactClient } from 'convex/react';
import globalStyles from './styles/index.css?url';
import '@convex-dev/design-system/styles/shared.css';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';
import posthog from 'posthog-js';

import 'allotment/dist/style.css';

import { ErrorDisplay } from './components/ErrorComponent';
import useVersionNotificationBanner from './components/VersionNotificationBanner';

export async function loader() {
  // These environment variables are available in the client (they aren't secret).
  // eslint-disable-next-line local/no-direct-process-env
  const CONVEX_URL = process.env.VITE_CONVEX_URL || globalThis.process.env.CONVEX_URL!;
  const CONVEX_OAUTH_CLIENT_ID = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID!;
  const WORKOS_REDIRECT_URI =
    globalThis.process.env.VITE_WORKOS_REDIRECT_URI || globalThis.process.env.VERCEL_BRANCH_URL!;
  return json({
    ENV: { CONVEX_URL, CONVEX_OAUTH_CLIENT_ID, WORKOS_REDIRECT_URI },
  });
}

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

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);
  const loaderData = useRouteLoaderData<typeof loader>('root');
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || (loaderData as any)?.ENV.CONVEX_URL;
  if (!CONVEX_URL) {
    throw new Error(`Missing CONVEX_URL: ${CONVEX_URL}`);
  }

  const [convex] = useState(
    () =>
      new ConvexReactClient(
        CONVEX_URL,
        // TODO: There's a potential issue in the convex client where the warning triggers
        // even though in flight requests have completed
        {
          unsavedChangesWarning: false,
          onServerDisconnectError: (message) => captureMessage(message),
        },
      ),
  );

  // TODO does it still make sense?
  useEffect(() => {
    document.querySelector('html')?.setAttribute('class', theme);
  }, [theme]);

  // Initialize PostHog.
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin/')) {
      // Don't log in admin routes, there's a big perf penalty somehow.
      return;
    }
    // Note that this the the 'Project API Key' from PostHog, which is
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

  useVersionNotificationBanner();

  return (
    <>
      <AuthKitProvider
        clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
        redirectUri={globalThis.process.env.WORKOS_REDIRECT_URI}
        apiHostname={import.meta.env.VITE_WORKOS_API_HOSTNAME}
      >
        <ClientOnly>
          {() => {
            return (
              <DndProvider backend={HTML5Backend}>
                <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
                  {children}
                </ConvexProviderWithAuthKit>
              </DndProvider>
            );
          }}
        </ClientOnly>
      </AuthKitProvider>

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

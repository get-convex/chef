import { captureRemixErrorBoundaryError } from '@sentry/remix';
import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@vercel/remix';
import { json } from '@vercel/remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData, useRouteError } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { Auth0Provider } from '@auth0/auth0-react';
import { ConvexProviderWithAuth0 } from 'convex/react-auth0';
import { ConvexReactClient } from 'convex/react';
import {
  getFlexAuthModeInLoader,
  getConvexUrlInLoader,
  getConvexOAuthClientIdInLoader,
} from './lib/persistence/convex';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';
import { ErrorDisplay } from './components/ErrorComponent';

export async function loader() {
  const convexUrl = getConvexUrlInLoader();
  const convexOauthClientId = getConvexOAuthClientIdInLoader();
  const authMode = getFlexAuthModeInLoader();
  // These environment variables are available in the client (they aren't secret).
  return json({
    ENV: { CONVEX_URL: convexUrl, FLEX_AUTH_MODE: authMode, CONVEX_OAUTH_CLIENT_ID: convexOauthClientId },
  });
}

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: tailwindReset },
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

    document.querySelector('html')?.setAttribute('data-theme', theme);
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
        { unsavedChangesWarning: false },
      ),
  );

  // TODO does it still make sense?
  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>
        {() => (
          <DndProvider backend={HTML5Backend}>
            <Auth0Provider
              domain={import.meta.env.VITE_AUTH0_DOMAIN}
              clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
              authorizationParams={{
                redirect_uri: window.location.origin,
              }}
              useRefreshTokens={true}
              cacheLocation="localstorage"
            >
              <ConvexProviderWithAuth0 client={convex}>{children}</ConvexProviderWithAuth0>
            </Auth0Provider>
          </DndProvider>
        )}
      </ClientOnly>
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

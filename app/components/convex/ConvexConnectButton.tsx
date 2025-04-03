import { useRouteLoaderData } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { convexStore, useConvexSessionId, useFlexAuthMode } from '~/lib/stores/convex';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chat';
import type { loader } from '~/root';

export function ConvexConnectButton() {
  const flexAuthMode = useFlexAuthMode();
  if (flexAuthMode === 'InviteCode') {
    return <ConvexConnectButtonForInviteCode />;
  }
  return <ConvexConnectButtonViaOauth />;
}

export function ConvexConnectButtonForInviteCode() {
  const convexClient = useConvex();
  const sessionId = useConvexSessionId();
  const chatId = useChatId();
  const credentials = useQuery(api.convexProjects.loadConnectedConvexProjectCredentials, {
    sessionId,
    chatId,
  });

  useEffect(() => {
    if (credentials?.kind === 'connected') {
      convexStore.set({
        token: credentials.adminKey,
        deploymentName: credentials.projectSlug,
        deploymentUrl: credentials.teamSlug,
      });
    }
  }, [credentials]);

  const handleClick = async () => {
    if (credentials?.kind === 'connected') {
      await convexClient.mutation(api.convexProjects.disconnectConvexProject, {
        sessionId,
        chatId,
      });
      await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
        sessionId,
        chatId,
      });
    } else {
      await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
        sessionId,
        chatId,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={credentials === undefined || credentials?.kind === 'connecting'}
      className={classNames(
        'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
        'bg-[#8B5CF6] text-white',
        'hover:bg-[#7C3AED]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    >
      {credentials?.kind === 'connecting' ? (
        <>
          <div className="i-ph:spinner-gap animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <div className="i-ph:plug-charging w-4 h-4" />
          {credentials?.kind === 'connected' ? 'Connect a different project' : 'Connect'}
        </>
      )}
    </button>
  );
}

export function ConvexConnectButtonViaOauth() {
  const [isLoading, setIsLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const convexClient = useConvex();
  const sessionId = useConvexSessionId();
  const chatId = useChatId();
  const {
    ENV: { CONVEX_OAUTH_CLIENT_ID },
  } = useRouteLoaderData<typeof loader>('root')!;

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const handleOAuthClick = async () => {
    setIsLoading(true);

    const state = JSON.stringify({
      random: Math.random().toString(36).substring(2),
      extraState: 1,
    });
    localStorage.setItem('convexOAuthState', state);

    const params = new URLSearchParams({
      client_id: CONVEX_OAUTH_CLIENT_ID,
      redirect_uri: window.location.origin + '/convex/callback',
      response_type: 'code',
      state,
    });

    // Open our loading page first, which will then redirect to Convex
    const connectUrl = `/convex/connect?${params.toString()}`;
    window.open(connectUrl, 'ConvexAuth', 'width=600,height=600,top=200,left=200');

    // Poll for token in local storage because COOP + COEP headers make postMessage more involved.
    const interval = setInterval(() => {
      const token = localStorage.getItem('convexProjectToken');
      const deploymentName = localStorage.getItem('convexProjectDeploymentName');
      const deploymentUrl = localStorage.getItem('convexProjectDeploymentUrl');

      if (token && deploymentName && deploymentUrl) {
        clearInterval(interval);
        setPollInterval(null);
        setIsLoading(false);

        void convexClient.mutation(api.convexProjects.registerConvexProjectViaOauth, {
          sessionId,
          chatId,
          token,
          deploymentName,
          deploymentUrl,
        });

        localStorage.removeItem('convexProjectToken');
        localStorage.removeItem('convexProjectDeploymentName');
        localStorage.removeItem('convexProjectDeploymentUrl');
      }
    }, 500);

    setPollInterval(interval);
  };

  const isConnected = useStore(convexStore) !== null;

  return (
    <button
      onClick={handleOAuthClick}
      disabled={isLoading}
      className={classNames(
        'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
        'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text hover:text-bolt-elements-button-primary-textHover',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    >
      {isLoading ? (
        <>
          <div className="i-ph:spinner-gap animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <div className="i-ph:plug-charging w-4 h-4" />
          {isConnected ? 'Connect a different project' : 'Connect'}
        </>
      )}
    </button>
  );
}

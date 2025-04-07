import { useRouteLoaderData } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { convexStore, useConvexSessionId, useFlexAuthMode } from '~/lib/stores/convex';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chat';
import type { loader } from '~/root';
import { useAuth0 } from '@auth0/auth0-react';

export function ConvexConnectButton() {
  const flexAuthMode = useFlexAuthMode();
  if (flexAuthMode === 'InviteCode') {
    return <ConvexConnectButtonForInviteCode />;
  }
  return <ConvexConnectButtonViaOauth />;
}

function ConvexConnectButtonForInviteCode() {
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

// These match what we use for the Convex dashboard and what Big Brain expects
const authParams = {
  audience: 'https://console.convex.dev/api/',
  scope: 'openid profile email list:instances manage:instances offline_access',
};

function ConvexConnectButtonViaOauth() {
  const convexClient = useConvex();
  const sessionId = useConvexSessionId();
  const chatId = useChatId();
  const credentials = useQuery(api.convexProjects.loadConnectedConvexProjectCredentials, {
    sessionId,
    chatId,
  });
  const { getAccessTokenSilently } = useAuth0();

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
      const accessToken = await getAccessTokenSilently({
        authorizationParams: authParams,
      });
      await convexClient.mutation(api.convexProjects.disconnectConvexProject, {
        sessionId,
        chatId,
      });
      await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
        sessionId,
        chatId,
        accessToken,
        teamSlug: 'sshader-test', // TODO: Hook this up to team picker
      });
    } else {
      const accessToken = await getAccessTokenSilently({
        authorizationParams: authParams,
      });
      await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
        sessionId,
        chatId,
        accessToken,
        teamSlug: 'sshader-test',
      });
    }
  };

  const isConnected = useStore(convexStore) !== null;
  const isLoading = credentials === undefined || credentials?.kind === 'connecting';

  return (
    <button
      onClick={handleClick}
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

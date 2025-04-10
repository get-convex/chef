import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setExtra, setUser } from '@sentry/remix';
import { useConvex } from 'convex/react';
import { useConvexSessionIdOrNullOrLoading, getConvexAuthToken } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { setProfile } from '~/lib/stores/profile';
import { getConvexProfile } from '~/lib/convexProfile';
import { useLDClient, withLDProvider } from 'launchdarkly-react-client-sdk';

export const UserProvider = withLDProvider<any>({
  clientSideID: import.meta.env.VITE_LD_CLIENT_SIDE_ID,
})(UserProviderInner);

function UserProviderInner({ children }: { children: React.ReactNode }) {
  const launchdarkly = useLDClient();
  const { user } = useAuth0();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();
  const convex = useConvex();

  useEffect(() => {
    if (sessionId) {
      setExtra('sessionId', sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    setExtra('chatId', chatId);
  }, [chatId]);

  useEffect(() => {
    async function updateProfile() {
      if (user) {
        launchdarkly?.identify({
          key: user.sub ?? '',
          name: user.name ?? user.nickname ?? '',
          email: user.email ?? '',
        });
        setUser({
          id: user.sub ?? undefined,
          username: user.name ?? user.nickname ?? undefined,
          email: user.email ?? undefined,
        });

        // Get additional profile info from Convex
        try {
          const token = getConvexAuthToken(convex);
          if (token) {
            const convexProfile = await getConvexProfile(token);
            setProfile({
              username: convexProfile.name || user.name || user.nickname || '',
              email: convexProfile.email || user.email || '',
              avatar: user.picture || '',
              id: convexProfile.id || user.sub || '',
            });
          }
        } catch (error) {
          console.error('Failed to fetch Convex profile:', error);
          // Fallback to Auth0 profile if Convex profile fetch fails
          setProfile({
            username: user.name ?? user.nickname ?? '',
            email: user.email ?? '',
            avatar: user.picture ?? '',
            id: user.sub ?? '',
          });
        }
      } else {
        launchdarkly?.identify({
          anonymous: true,
        });
      }
    }
    void updateProfile();
  }, [user, convex]);

  return children;
}

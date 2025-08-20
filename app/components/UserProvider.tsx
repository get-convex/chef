import { useEffect } from 'react';
import { setExtra, setUser } from '@sentry/remix';
import { useConvex } from 'convex/react';
import { useConvexSessionIdOrNullOrLoading, getConvexAuthToken } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { setProfile } from '~/lib/stores/profile';
import { getConvexProfile } from '~/lib/convexProfile';
import { useLDClient, withLDProvider, basicLogger } from 'launchdarkly-react-client-sdk';
import { api } from '@convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-react';

export const UserProvider = withLDProvider<any>({
  clientSideID: import.meta.env.VITE_LD_CLIENT_SIDE_ID,
  options: {
    logger: basicLogger({ level: 'error' }),
  },
})(UserProviderInner);

function UserProviderInner({ children }: { children: React.ReactNode }) {
  const launchdarkly = useLDClient();
  const { user } = useAuth();
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

  const tokenValue = (convex as any)?.sync?.state?.auth?.value;

  useEffect(() => {
    async function updateProfile() {
      if (user) {
        launchdarkly?.identify({
          key: user.id ?? '',
          email: user.email ?? '',
        });
        setUser({
          id: user.id,
          username: user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : '',
          email: user.email ?? undefined,
        });

        // Get additional profile info from Convex
        try {
          const token = getConvexAuthToken(convex);
          if (token) {
            void convex.action(api.sessions.updateCachedProfile, { convexAuthToken: token });
            const convexProfile = await getConvexProfile(token);
            setProfile({
              username:
                convexProfile.name ??
                (user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : ''),
              email: convexProfile.email || user.email || '',
              avatar: user.profilePictureUrl || '',
              id: convexProfile.id || user.id || '',
            });
          }
        } catch (error) {
          console.error('Failed to fetch Convex profile:', error);
          // Fallback to WorkOS profile if Convex profile fetch fails
          setProfile({
            username: user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : '',
            email: user.email ?? '',
            avatar: user.profilePictureUrl ?? '',
            id: user.id ?? '',
          });
        }
      } else {
        launchdarkly?.identify({
          anonymous: true,
        });
      }
    }
    void updateProfile();
    // Including tokenValue is important here even though it's not a direct dependency
  }, [launchdarkly, user, convex, tokenValue]);

  return children;
}

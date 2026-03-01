import { useEffect } from 'react';
import { setExtra, setUser } from '@sentry/remix';
import { useConvex, useQuery } from 'convex/react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { setProfile } from '~/lib/stores/profile';
import { getConvexProfile } from '~/lib/convexProfile';
import { getConvexDashboardToken } from '~/lib/stores/convexDashboardAuth';
import { useLDClient, withLDProvider, basicLogger } from 'launchdarkly-react-client-sdk';
import { api } from '@convex/_generated/api';
import { useAuth } from '~/lib/auth/GoogleAuthProvider';

export const UserProvider = withLDProvider<any>({
  clientSideID: import.meta.env.VITE_LD_CLIENT_SIDE_ID,
  options: {
    logger: basicLogger({ level: 'error' }),
  },
})(UserProviderInner);

function UserProviderInner({ children }: { children: React.ReactNode }) {
  const launchdarkly = useLDClient();
  const { user } = useAuth();
  const convexMemberId = useQuery(api.sessions.convexMemberId);
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
          key: convexMemberId ?? '',
          email: user.email ?? '',
        });
        setUser({
          id: convexMemberId ?? '',
          username: user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : '',
          email: user.email ?? undefined,
        });

        // Get additional profile info from Convex (only if dashboard token is available)
        const dashboardToken = getConvexDashboardToken();
        if (dashboardToken) {
          try {
            const convexProfile = await getConvexProfile(dashboardToken);
            setProfile({
              username:
                convexProfile.name ??
                (user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : ''),
              email: convexProfile.email || user.email || '',
              avatar: user.profilePictureUrl || '',
              id: convexProfile.id || user.id || '',
            });
          } catch (error) {
            console.warn('Failed to fetch Convex profile (not connected yet):', error);
            // Fallback to Google profile if Convex profile fetch fails
            setProfile({
              username: user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : '',
              email: user.email ?? '',
              avatar: user.profilePictureUrl ?? '',
              id: user.id ?? '',
            });
          }
        } else {
          // No Convex dashboard token - use Google profile
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
  }, [launchdarkly, user, convex, tokenValue, convexMemberId]);

  return children;
}

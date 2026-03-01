import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

interface GoogleAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
  } | null;
  signIn: () => void;
  signOut: (options?: { returnTo?: string }) => void;
  getAccessToken: () => Promise<string | null>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null);

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
  }
  return context;
}

interface GoogleAuthProviderProps {
  children: React.ReactNode;
  client: ConvexReactClient;
}

export function GoogleAuthProvider({ children, client }: GoogleAuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GoogleAuthContextType['user']>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Handle OAuth state
  useEffect(() => {
    const initializeAuth = async () => {
      // Check for existing tokens
      const storedIdToken = localStorage.getItem('google_id_token');
      const storedUserInfo = localStorage.getItem('user_info');

      if (storedIdToken && storedUserInfo) {
        setAccessToken(storedIdToken);
        setIsAuthenticated(true);
        try {
          const parsedUserInfo = JSON.parse(storedUserInfo);
          setUser({
            id: parsedUserInfo.id,
            email: parsedUserInfo.email,
            firstName: parsedUserInfo.given_name,
            lastName: parsedUserInfo.family_name,
            profilePictureUrl: parsedUserInfo.picture,
          });
        } catch (e) {
          console.error('Failed to parse user info:', e);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);


  // Sign in - redirect to Google OAuth directly
  const signIn = useCallback(() => {
    const GOOGLE_CLIENT_ID = '561957498361-0f9mtcp25437nifbss26eei9a1b8rm6o.apps.googleusercontent.com';
    const redirectUri = `${window.location.origin}/api/auth/google/callback`;
    const state = 'google-' + Math.random().toString(36).substring(7);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    window.location.href = authUrl.toString();
  }, []);

  // Sign out
  const signOut = useCallback((options?: { returnTo?: string }) => {
    setIsAuthenticated(false);
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('convex_access_token');
    localStorage.removeItem('google_id_token');
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('user_info');

    if (options?.returnTo) {
      window.location.href = options.returnTo;
    }
  }, []);

  // Get access token (returns the Google ID token for Convex auth)
  const getAccessToken = useCallback(async () => {
    return accessToken || localStorage.getItem('google_id_token');
  }, [accessToken]);

  // Set up Convex auth
  useEffect(() => {
    if (accessToken) {
      client.setAuth(async () => accessToken);
    } else {
      client.clearAuth();
    }
  }, [accessToken, client]);

  const value: GoogleAuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    signIn,
    signOut,
    getAccessToken,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      <ConvexProvider client={client}>
        {children}
      </ConvexProvider>
    </GoogleAuthContext.Provider>
  );
}

// Alias for compatibility with WorkOS useAuth
export const useAuth = useGoogleAuth;

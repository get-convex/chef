import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

export const meta: MetaFunction = () => {
  return [{ title: 'Loading | Chef' }];
};

type TokenResponse =
  | {
      token: string;
      deploymentName: string;
      deploymentUrl: string;
    }
  | {
      error: string;
    };

export default function ConvexCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      window.close();
      return;
    }

    // Exchange the code for a token
    fetch('/api/convex/callback?' + searchParams.toString())
      .then((response) => response.json())
      .then((data: unknown) => {
        const tokenData = data as TokenResponse;

        if ('token' in tokenData) {
          localStorage.setItem('convexProjectToken', tokenData.token);
          localStorage.setItem('convexProjectDeploymentName', tokenData.deploymentName);
          localStorage.setItem('convexProjectDeploymentUrl', tokenData.deploymentUrl);
          window.close();
        } else {
          console.error('Failed to exchange code for token:', tokenData.error);
          window.close();
        }
      })
      .catch((error) => {
        console.error('Error exchanging code:', error);
        window.close();
      });
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="i-ph:spinner-gap animate-spin w-8 h-8" />
    </div>
  );
}

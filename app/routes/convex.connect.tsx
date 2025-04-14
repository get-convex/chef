import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';
import { Spinner } from '~/components/ui/Spinner';

export const meta: MetaFunction = () => {
  return [{ title: 'Loading | Chef' }];
};

export default function ConvexConnect() {
  const [searchParams] = useSearchParams();

  const dashboardHost = import.meta.env.VITE_DASHBOARD_HOST || 'https://dashboard.convex.dev';

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const authUrl = `${dashboardHost}/oauth/authorize/project?${params.toString()}`;
    window.location.href = authUrl;
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f9f7ee' }}>
      <Spinner />
    </div>
  );
}

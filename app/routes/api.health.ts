import { json, type LoaderFunctionArgs } from '@vercel/remix';

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};

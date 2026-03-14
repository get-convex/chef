import { json, type LoaderFunctionArgs } from '@remix-run/node';

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};

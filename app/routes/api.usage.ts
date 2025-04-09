import { json, type ActionFunctionArgs } from '@vercel/remix';
import { checkTokenUsage } from '~/lib/.server/usage';

export async function action(args: ActionFunctionArgs) {
  const enableRateLimiting = globalThis.process.env.ENABLE_RATE_LIMITING;
  if (!enableRateLimiting) {
    return json({ tokensUsed: null, tokensQuota: null });
  }
  const { token, teamSlug, deploymentName }: { token: string; teamSlug: string; deploymentName: string | undefined } =
    await args.request.json();
  const PROVISION_HOST = globalThis.process.env.PROVISION_HOST || 'https://api.convex.dev';
  const response = await checkTokenUsage(PROVISION_HOST, token, teamSlug, deploymentName);
  if (response.status === 'error') {
    return response.response;
  }
  const { tokensUsed, tokensQuota } = response;
  return json({ tokensUsed, tokensQuota });
}

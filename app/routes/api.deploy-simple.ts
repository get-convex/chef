import type { ActionFunctionArgs } from '@vercel/remix';
import { deploy } from '~/lib/.server/deploy-simple';

export async function action(args: ActionFunctionArgs) {
  return await deploy(args);
}

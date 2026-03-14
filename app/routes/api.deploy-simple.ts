import type { ActionFunctionArgs } from '@remix-run/node';
import { deploy } from '~/lib/.server/deploy-simple';

export async function action(args: ActionFunctionArgs) {
  return await deploy(args);
}

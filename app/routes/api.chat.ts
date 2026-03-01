import type { ActionFunctionArgs } from '@remix-run/node';
import { chatAction } from '~/lib/.server/chat';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

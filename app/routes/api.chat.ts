import type { ActionFunctionArgs } from '@vercel/remix';
import { chatAction } from '~/lib/.server/chat';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

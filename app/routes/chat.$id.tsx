import type { LoaderFunctionArgs } from '@vercel/remix';
import { default as IndexRoute, meta as IndexMeta } from './_index';
import { getFlexAuthModeInLoader } from '~/lib/persistence/convex';

export const meta = IndexMeta;

export async function loader(args: LoaderFunctionArgs) {
  const flexAuthMode = getFlexAuthModeInLoader();
  const url = new URL(args.request.url);
  const code = url.searchParams.get('code');
  return Response.json({ id: args.params.id, flexAuthMode, code });
}

export default IndexRoute;

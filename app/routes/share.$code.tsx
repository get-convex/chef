import type { LoaderFunctionArgs, MetaFunction } from '@vercel/remix';
import { redirect } from '@vercel/remix';
import { json } from '@vercel/remix';
import { useLoaderData } from '@remix-run/react';
import { Show } from '~/components/Show';
import { api } from '@convex/_generated/api';
import { preloadedQueryResult, preloadQuery } from 'convex/nextjs';
import type { Preloaded } from 'convex/react';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.shareQuery) {
    return [{ title: 'Not Found | Chef' }];
  }

  const share = preloadedQueryResult(data.shareQuery as Preloaded<typeof api.socialShare.getSocialShare>);

  const { description, thumbnailUrl, author } = share;
  const authorText = author ? `by ${author.username}` : '';
  const title = description ? `${description} ${authorText} | Chef` : `Shared Project ${authorText} | Chef`;
  const ogTitle = description || 'Shared Project';
  const ogDesc = `Cooked with Chef ${authorText}`;

  return [
    { title },
    { name: 'description', content: ogDesc },
    { property: 'og:title', content: ogTitle },
    { property: 'og:description', content: ogDesc },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Chef' },
    {
      property: 'og:image',
      content: thumbnailUrl || 'https://chef.convex.dev/social_preview_share.png',
    },
    { property: 'twitter:card', content: 'summary_large_image' },
    {
      property: 'twitter:image',
      content: thumbnailUrl || 'https://chef.convex.dev/social_preview_share.png',
    },
    { property: 'twitter:title', content: ogTitle },
    { property: 'twitter:description', content: ogDesc },
    ...(author ? [{ property: 'twitter:creator', content: `@${author.username}` }] : []),
  ];
};

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || globalThis.process.env.CONVEX_URL!;

export async function loader({ params }: LoaderFunctionArgs) {
  const { code } = params;
  if (!code) {
    throw new Response('Not Found', { status: 404 });
  }

  const shareQuery = await preloadQuery(api.socialShare.getSocialShareOrIsSnapshotShare, { code }, { url: CONVEX_URL });
  const share = preloadedQueryResult(shareQuery);
  if (!share) {
    throw new Response('Not Found', { status: 404 });
  }
  if ('isSnapshotShare' in share && share.isSnapshotShare) {
    return redirect(`/create/${code}`);
  }

  return json({
    shareQuery,
  });
}

export default function ShowRoute() {
  const { shareQuery } = useLoaderData<typeof loader>() as {
    shareQuery: Preloaded<typeof api.socialShare.getSocialShare>;
  };

  return (
    <div className="flex size-full flex-col bg-bolt-elements-background-depth-1">
      <Show preloadedShareQuery={shareQuery} />
    </div>
  );
}

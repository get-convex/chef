import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { ClientOnly } from 'remix-utils/client-only';
import { ModernHomepage } from '~/components/ModernHomepage.client';

export const meta: MetaFunction = () => {
  return [
    { title: 'Chef by Convex | Generate realtime full‑stack apps' },
    { name: 'description', content: 'Cook up something hot with Chef, the full-stack AI coding agent from Convex' },
    {
      property: 'og:image',
      content: '/social_preview_index.png',
    },
  ];
};

export const links: LinksFunction = () => [
  {
    rel: 'canonical',
    href: 'https://chef.convex.dev/',
  },
];

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // If state is also set, this is probably the GitHub OAuth login flow finishing.
  // The code is probably not for us.
  if (state) {
    code = null;
  }
  return json({ code });
};

// Modern home page with Lovable.dev inspired design that provides a seamless
// experience from landing page to chat interface to workbench. The new design
// features a clean, modern aesthetic with smooth transitions and improved UX.
export default function Index() {
  return (
    <ClientOnly>{() => <ModernHomepage />}</ClientOnly>
  );
}

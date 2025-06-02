import type { MetaFunction } from '@vercel/remix';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => [
  { title: 'You can close this window' },
  { name: 'description', content: 'You can now close this window and return to your project.' },
];

export default function CloseMe() {
  return (
    <div className="flex size-full flex-col bg-bolt-elements-background-depth-1">
      <Header hideSidebarIcon />
      <div className="flex flex-1 flex-col items-center justify-center">
        <h2 className="mb-2">All done!</h2>
        <div className="text-lg text-content-secondary">You may now close this window.</div>
      </div>
    </div>
  );
}

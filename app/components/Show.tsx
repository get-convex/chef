import { Link } from '@remix-run/react';
import { ExternalLinkIcon, CopyIcon } from '@radix-ui/react-icons';
import { usePreloadedQuery, useQuery, type Preloaded } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState, type FC } from 'react';

function generateDefaultAvatar(username: string): string {
  // Get initials (up to 2 characters)
  const initials = username
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Create an SVG with the initials
  const svg = `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#4F46E5"/>
      <text
        x="50"
        y="50"
        text-anchor="middle"
        dy="0.35em"
        fill="white"
        font-family="system-ui, sans-serif"
        font-size="40"
        font-weight="bold"
      >${initials}</text>
    </svg>
  `;

  // Convert to a data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface ShareData {
  description: string | null;
  code: string;
  shared: boolean;
  allowShowInGallery: boolean;
  hasBeenDeployed: boolean;
  deployedUrl: string | null;
  thumbnailUrl: string | null;
  author: {
    username: string;
    avatar: string;
  } | null;
}

interface ShowInnerProps {
  share: ShareData;
  preview?: boolean;
  className?: string;
}

interface StaticShowProps extends Omit<ShowInnerProps, 'share'> {
  share: ShareData;
}

interface PreloadedShowProps extends Omit<ShowInnerProps, 'share'> {
  preloadedShareQuery: Preloaded<typeof api.socialShare.getSocialShareOrIsSnapshotShare>;
}

interface CodeShowProps extends Omit<ShowInnerProps, 'share'> {
  code: string;
}

type ShowProps = StaticShowProps | PreloadedShowProps | CodeShowProps;

const PreloadedShow: FC<PreloadedShowProps> = ({ preloadedShareQuery, ...props }) => {
  const share = usePreloadedQuery(preloadedShareQuery);
  if ('isSnapshotShare' in share) {
    throw new Error('Share code  is for a snapshot');
  }
  return <ShowInner share={share} {...props} />;
};

const StaticShow: FC<StaticShowProps> = ({ share, ...props }) => {
  return <ShowInner share={share} {...props} />;
};

const CodeShow: FC<CodeShowProps> = ({ code, ...props }) => {
  const share = useQuery(api.socialShare.getSocialShare, { code });
  if (share === undefined) {
    return <div className="p-4">Loading...</div>;
  }
  return <ShowInner share={share} {...props} />;
};

const ShowInner: FC<ShowInnerProps> = ({ share, preview = false, className }) => {
  const [showIframe, setShowIframe] = useState(false);
  const defaultAuthor = {
    username: 'Chef User',
    avatar: '',
  } as const;

  const author = share.author ?? defaultAuthor;
  const avatarSrc = author.avatar || generateDefaultAvatar(author.username);

  return (
    <div
      className={['mx-auto flex w-full flex-col', preview ? 'gap-4 p-4' : 'gap-8 p-8 md:max-w-7xl', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={['flex items-start', preview ? 'justify-start' : 'justify-between flex-col gap-4 md:flex-row']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-3">
            <img
              src={avatarSrc}
              alt={author.username}
              className={['rounded-full', preview ? 'size-8' : 'size-12'].filter(Boolean).join(' ')}
            />
            <div className="flex flex-col">
              <span className={['font-medium', preview ? 'text-sm' : 'text-base'].filter(Boolean).join(' ')}>
                {share.description}
              </span>
              <span className={['text-content-secondary', preview ? 'text-xs' : 'text-sm'].filter(Boolean).join(' ')}>
                {author.username}
              </span>
            </div>
          </div>
        </div>

        {!preview && (
          <div className="flex items-center gap-3">
            <Link
              to={`/create/${share.code}`}
              className="flex items-center gap-2 rounded bg-bolt-elements-background-depth-3 px-4 py-2 text-sm font-medium hover:bg-bolt-elements-background-depth-4"
            >
              <CopyIcon />
              Clone this app in Chef
            </Link>

            {share.hasBeenDeployed && share.deployedUrl && (
              <a
                href={share.deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded bg-bolt-elements-background-depth-3 px-4 py-2 text-sm font-medium hover:bg-bolt-elements-background-depth-4"
              >
                <ExternalLinkIcon />
                Open app
              </a>
            )}
          </div>
        )}
      </div>

      <div
        className={[
          'relative overflow-hidden rounded-lg border border-bolt-elements-background-depth-3',
          preview ? 'h-[120px]' : 'h-[calc(100vh-12rem)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!preview && showIframe && share.deployedUrl ? (
          <iframe
            src={share.deployedUrl}
            className="size-full border-none"
            title="App preview"
            sandbox="allow-scripts allow-forms allow-same-origin"
            allow="camera; microphone"
            referrerPolicy="no-referrer"
          />
        ) : (
          share.thumbnailUrl && (
            <div className={preview ? 'size-full' : 'group relative size-full'}>
              <img
                src={share.thumbnailUrl}
                alt="App preview"
                className={`size-full object-contain ${
                  !preview && share.hasBeenDeployed && share.deployedUrl
                    ? 'transition-opacity group-hover:opacity-50'
                    : ''
                }`}
                crossOrigin="anonymous"
              />
              {!preview && share.hasBeenDeployed && share.deployedUrl && (
                <button
                  type="button"
                  onClick={() => setShowIframe(true)}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-8 py-3 text-lg font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 hover:bg-blue-700"
                >
                  Try App
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export const Show: FC<ShowProps> = (props) => {
  if ('preloadedShareQuery' in props) {
    return <PreloadedShow {...props} />;
  }
  if ('share' in props) {
    return <StaticShow {...props} />;
  }
  if ('code' in props) {
    return <CodeShow {...props} />;
  }
  throw new Error('Must pass share or preloadedShareQuery to Show component');
};

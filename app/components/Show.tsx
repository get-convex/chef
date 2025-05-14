import { api } from '@convex/_generated/api';
import { Button } from '@ui/Button';
import { usePreloadedQuery, useQuery, type Preloaded } from 'convex/react';
import { useState, type FC } from 'react';
import { classNames } from '~/utils/classNames';

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
  shared: 'shared' | 'expresslyUnshared' | 'noPreferenceExpressed';
  allowShowInGallery: boolean;
  hasBeenDeployed: boolean;
  deployedUrl: string | null;
  thumbnailUrl: string | null;
  referralCode: string | undefined;
  author: {
    username: string;
    avatar: string;
  } | null;
}

interface ShowInnerProps {
  share: ShareData;
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
  const shareRaw = usePreloadedQuery(preloadedShareQuery);
  if ('isSnapshotShare' in shareRaw) {
    throw new Error('Share code  is for a snapshot');
  }
  const share = { ...shareRaw, referralCode: shareRaw.referralCode ?? undefined };
  return <ShowInner share={share} {...props} />;
};

const StaticShow: FC<StaticShowProps> = ({ share, ...props }) => {
  const fixedShare = { ...share, referralCode: share.referralCode ?? undefined };
  return <ShowInner share={fixedShare} {...props} />;
};

const CodeShow: FC<CodeShowProps> = ({ code, ...props }) => {
  const shareRaw = useQuery(api.socialShare.getSocialShare, { code });
  if (shareRaw === undefined) {
    return <div className="p-4">Loading...</div>;
  }
  const share = { ...shareRaw, referralCode: shareRaw.referralCode ?? undefined };
  return <ShowInner share={share} {...props} />;
};

const ShowInner: FC<ShowInnerProps> = ({ share, className }) => {
  const [showIframe, setShowIframe] = useState(false);
  const defaultAuthor = {
    username: 'Chef User',
    avatar: '',
  } as const;

  const author = share.author ?? defaultAuthor;
  const avatarSrc = author.avatar || generateDefaultAvatar(author.username);

  // Chef SVG icon inline
  const ChefIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="20" height="12" viewBox="0 0 72 42" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M70.2469 18.1945L68.3899 17.3926C67.7147 17.0972 66.7017 16.7173 65.5622 16.4641C62.9455 15.9154 60.7086 16.1687 58.9782 17.2238C57.5854 18.0679 56.5303 19.334 55.8972 21.0222L53.787 20.6002L53.5337 21.7819C52.0987 20.7268 50.2839 20.0515 48.1315 19.8405C45.2615 19.5873 42.687 20.2625 40.7456 21.8663C40.5345 22.0352 40.2813 22.2462 40.1125 22.4572C38.9307 20.3048 36.8205 19.123 33.9927 19.2074C33.3597 19.2074 32.7688 19.2918 32.2201 19.4607L32.0513 13.3831L21.4156 13.6786L21.5 17.688C19.0099 15.4934 15.4647 14.5649 11.413 15.2824C4.0271 16.5485 -0.0667901 22.4994 1.24157 30.0963C1.87465 33.8526 3.56285 36.8492 6.09516 38.664C7.99439 40.0568 10.3579 40.732 12.9746 40.732C15.5913 40.732 14.7894 40.6476 15.7179 40.4788C18.2502 40.0568 20.3605 39.086 22.0065 37.7355V38.7484L41.4631 38.2419V37.6933C42.898 38.5796 44.6707 39.1705 46.6965 39.3393C47.0763 39.3393 47.4562 39.3815 47.7938 39.3815C49.3554 39.3815 50.8748 39.0438 52.2254 38.453L52.0143 39.4659L62.439 41.5761L64.4648 31.5313L67.4192 32.1222L69.1074 23.6812L70.2047 18.1945H70.2469ZM21.7111 26.931L19.6008 26.8043L21.6688 26.0025V26.8888L21.7111 26.931ZM14.1563 30.8983C13.5655 30.9827 13.27 30.8138 13.059 30.6028C12.7636 30.3496 12.2571 29.6743 12.0039 28.1549C11.8773 27.3952 11.5818 24.9895 12.8902 24.7363C12.9746 24.7363 13.059 24.7363 13.1434 24.7363C13.4389 24.7363 13.7765 24.9051 14.0297 26.0025L14.6628 28.3659V29.3789C14.7472 30.8138 14.3674 30.856 14.1141 30.8983H14.1563Z"
        fill="#EE342F"
      />
      <path
        d="M3.73169 29.5899C2.67657 23.3857 5.88416 18.7432 11.8351 17.688C16.8575 16.8439 20.8248 18.912 22.0909 23.1747L16.5199 25.285C15.8868 22.9637 14.4518 21.9086 12.5104 22.204C10.0625 22.626 8.92295 24.9895 9.55602 28.5348C10.1469 31.9956 12.0883 33.7682 14.6206 33.3461C16.4355 33.0507 17.4062 31.5735 17.2796 29.21L23.3149 29.5055C23.0617 34.0214 20.1495 37.0602 15.2537 37.9043C9.04956 38.9594 4.78682 35.8784 3.73169 29.5477V29.5899Z"
        fill="#FDEFD2"
      />
      <path
        d="M24.4545 36.0895L23.948 16.0842L29.5191 15.9576L29.7301 24.5253C30.5742 22.6682 31.967 21.7819 33.9506 21.6975C36.9472 21.6131 38.5088 23.4701 38.5932 27.142L38.8042 35.7096L33.2331 35.8362L33.0221 27.8173C33.0221 26.4667 32.4734 25.8336 31.4605 25.8336C30.3632 25.8336 29.7723 26.7199 29.8145 28.3237L30.0256 35.8785L24.4545 36.0051V36.0895Z"
        fill="#FDEFD2"
      />
      <path
        d="M54.2512 31.4047L44.8395 30.5184C44.7129 31.9112 45.7258 32.8819 47.2452 33.0507C48.3425 33.1351 49.271 32.7131 49.9885 31.7423L53.787 33.9792C52.3942 36.0051 49.7353 37.1024 46.8231 36.8492C41.9696 36.3849 39.2684 33.4305 39.6905 28.999C40.1125 24.5675 43.2779 21.9507 47.7939 22.415C52.4364 22.8371 54.7577 25.8336 54.3357 30.3074L54.209 31.4469L54.2512 31.4047ZM49.1866 28.0705C49.3554 26.4667 48.7224 25.496 47.414 25.3694C46.1056 25.2427 45.3037 26.0869 45.0927 27.6906L49.1444 28.0705H49.1866Z"
        fill="#FDEFD2"
      />
      <path
        d="M63.1564 25.0739L66.1108 25.6648L65.3933 29.1256L62.4389 28.5348L60.4131 38.5796L54.9686 37.4823L56.9945 27.4374L55.0108 27.0154L55.7283 23.5546L57.712 23.9766L57.8808 23.1747C58.5983 19.5451 61.004 18.1523 65.0557 18.9542C65.8576 19.123 66.6595 19.3763 67.3769 19.7139L66.6172 23.4702C66.1952 23.3013 65.7731 23.1747 65.3933 23.0903C64.2959 22.8793 63.5363 23.3013 63.3675 24.2721L63.1986 25.0739H63.1564Z"
        fill="#FDEFD2"
      />
      <path
        d="M57.2477 4.73105C56.8678 2.78962 54.5888 1.27023 51.8032 1.27023C49.0177 1.27023 48.258 1.94552 47.2873 3.00065C46.2743 3.08506 45.3036 3.38049 44.4595 3.97136C43.2356 4.81546 42.3915 6.12382 42.1382 7.601C41.885 9.07818 42.1804 10.5554 43.0667 11.7793C43.4888 12.4124 44.0797 12.9189 44.7128 13.3409L43.742 18.6588C43.6154 19.4184 46.1055 20.4736 49.3553 21.0644C52.5629 21.6553 55.3062 21.5287 55.4328 20.769L56.4036 15.4512C58.7671 14.9447 60.6663 12.9189 60.8351 10.3865C61.0039 7.85424 59.4846 5.61736 57.2477 4.73105Z"
        fill="white"
      />
      <path
        d="M58.2607 3.33829C57.0368 1.69229 55.1797 0.510555 53.1116 0.130709C51.0014 -0.249137 48.8911 0.215121 47.1607 1.31245C45.8524 1.39686 44.6284 1.81892 43.5311 2.57861C41.9273 3.67594 40.8722 5.36414 40.5345 7.26337C40.1969 9.1626 40.6189 11.104 41.7163 12.7078C42.2227 13.4675 42.898 14.1006 43.6577 14.6071L42.9402 18.5743C42.8136 19.334 43.4467 20.8112 49.2288 21.8663C50.6638 22.1196 52.0565 22.2462 53.1539 22.2462C54.2512 22.2462 53.4493 22.2462 53.5759 22.2462C54.631 22.2462 56.066 22.0352 56.2348 20.98L56.9523 17.0128C59.9489 16.2953 62.2702 13.7208 62.4812 10.471C62.6922 7.34779 60.9196 4.56225 58.2607 3.29609V3.33829ZM54.5888 20.4736C54.0402 20.6424 52.2254 20.7268 49.4398 20.2626C46.6965 19.7561 45.0083 19.0386 44.544 18.701L44.7128 17.7302C45.6836 18.1945 47.2873 18.7854 49.6086 19.2074C51.1702 19.5029 52.4364 19.5873 53.4493 19.5873C54.4622 19.5873 54.3778 19.5873 54.7155 19.5451L54.5466 20.5158L54.5888 20.4736ZM55.0953 17.7725C54.2512 17.8569 52.4786 17.9835 49.9463 17.5192C47.414 17.055 45.8102 16.3375 45.0505 15.9576L45.1349 15.4512L45.3037 14.396C46.1056 15.1557 47.1607 15.6622 48.3003 15.831C48.8911 15.9576 49.5242 15.9576 50.1573 15.9154C50.7904 16.2109 51.4235 16.4219 52.0987 16.5485C52.4364 16.5907 52.8162 16.6329 53.1539 16.6329C53.9136 16.6329 54.6311 16.5063 55.3063 16.2109L55.1375 17.1816L55.0531 17.688L55.0953 17.7725ZM60.793 10.3866C60.6242 12.7922 58.936 14.6915 56.7835 15.3668C57.2478 14.9025 57.5854 14.3538 57.7964 13.763C57.923 13.2987 57.6698 12.8345 57.2056 12.7078C56.7413 12.5812 56.2771 12.8345 56.1504 13.2987C55.9816 13.9318 55.4752 14.4805 54.7155 14.7759C54.0824 15.0291 53.3649 15.1135 52.6474 15.0291C52.3098 15.0291 51.9721 14.9025 51.6345 14.7759C51.5501 14.7759 51.4235 14.6915 51.3391 14.6493L51.6345 13.1299C51.7189 12.6656 51.4235 12.2436 50.9592 12.1592C50.4949 12.0748 50.0729 12.3702 49.9885 12.8344L49.7352 14.3538C49.6508 14.3538 49.5242 14.3538 49.4398 14.3538C49.1022 14.3538 48.7645 14.3116 48.4691 14.2272C47.7516 14.0584 47.0763 13.7208 46.5699 13.2565C45.979 12.7078 45.6835 12.0326 45.7257 11.4417C45.7257 10.9774 45.3881 10.5976 44.9239 10.5554C44.4596 10.5554 44.0797 10.893 44.0375 11.3573C44.0375 11.9903 44.1642 12.6656 44.5018 13.2565C43.9954 12.8767 43.5311 12.4546 43.1512 11.9059C42.3071 10.682 41.9695 9.20481 42.2227 7.72763C42.476 6.25045 43.3201 4.9843 44.544 4.09799C44.5862 4.09799 44.6706 4.01358 44.7128 3.97137C44.6284 4.30901 44.7128 4.68886 45.0505 4.89989C45.4303 5.15312 45.979 5.06871 46.2322 4.68886V4.60445C46.6965 4.01358 47.2029 3.50712 47.7516 3.08507C48.5535 2.4942 49.4398 2.11435 50.4105 1.90332C51.2124 1.7345 52.0143 1.7345 52.8584 1.90332C53.6603 2.02994 54.4622 2.36758 55.1375 2.78963C55.9816 3.29609 56.6991 4.01358 57.2056 4.81547C57.5854 5.40635 57.8808 6.08163 58.0919 6.75691C58.1763 7.13676 58.5139 7.38999 58.8938 7.38999C59.2736 7.38999 59.0204 7.38999 59.1048 7.38999C59.4424 7.30558 59.6957 7.01014 59.7379 6.6725C60.5398 7.72763 60.9618 9.03599 60.8774 10.471L60.793 10.3866Z"
        fill="#EE342F"
      />
    </svg>
  );

  return (
    <div className={classNames('mx-auto flex w-full flex-col gap-2 p-4 md:max-w-3xl min-h-screen', className)}>
      {/* Responsive grid/flex layout for header */}
      <div className="mb-1 grid w-full grid-cols-1 items-center gap-2 md:grid-cols-2">
        {/* Title, smaller on mobile */}
        <h1 className="m-0 truncate text-left text-lg font-semibold md:text-xl">{share.description}</h1>
        {/* Desktop: Clone app in Chef with Chef icon, mobile: What's Chef? */}
        <div className="flex justify-end md:justify-end">
          <Button
            href={
              typeof window !== 'undefined' && window.innerWidth < 768
                ? '/'
                : `/create/${share.code}` /* TODO this is buggy */
            }
            variant="neutral"
            className="flex items-center gap-2"
            icon={<ChefIcon />}
            tip={
              typeof window !== 'undefined' && window.innerWidth < 768
                ? undefined
                : `New users: clone this app and get 85,000 bonus Chef tokens, plus some for the author of this app!
` /* TODO this is buggy */
            }
          >
            <span className="hidden md:inline">Clone app in Chef</span>
            <span className="inline md:hidden">What&apos;s Chef?</span>
          </Button>
        </div>
      </div>
      {/* Second row: author and Try App/Chef button, responsive */}
      <div className="mb-1 grid w-full grid-cols-1 items-center gap-2 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <img src={avatarSrc} alt={author.username} className="size-8 rounded-md" />
          <span className="text-sm text-content-secondary md:text-base">Created by {author.username}</span>
        </div>
        <div className="flex justify-end md:justify-end">
          {share.hasBeenDeployed && share.deployedUrl ? (
            <Button href={share.deployedUrl} target="_blank" variant="primary" className="ml-2">
              Try app
            </Button>
          ) : (
            <Button href="/" variant="primary" className="ml-2">
              Try Chef
            </Button>
          )}
        </div>
      </div>
      <div
        className={classNames(
          'relative overflow-hidden rounded-lg border border-bolt-elements-background-depth-3',
          showIframe ? 'h-[calc(100vh-10rem)]' : 'min-h-[300px] max-h-[50vh]',
        )}
        style={{ background: '#fff' }}
      >
        {showIframe && share.deployedUrl ? (
          <iframe
            src={share.deployedUrl}
            className="size-full min-h-[300px] border-none"
            title="App preview"
            sandbox="allow-scripts allow-forms allow-same-origin"
            allow="camera; microphone"
            referrerPolicy="no-referrer"
          />
        ) : (
          share.thumbnailUrl && (
            <div className="group relative size-full min-h-[300px]">
              <img
                src={share.thumbnailUrl}
                alt="App thumbnail"
                className={`size-full object-contain ${
                  share.hasBeenDeployed && share.deployedUrl ? 'transition-opacity group-hover:opacity-50' : ''
                }`}
                crossOrigin="anonymous"
                style={{ background: '#fff' }}
              />
              {share.hasBeenDeployed && share.deployedUrl && (
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

      {share.referralCode && (
        <div className="mt-2 hidden rounded-lg border border-bolt-elements-background-depth-3 bg-bolt-elements-background-depth-2 p-4 md:block">
          <div className="text-center">
            <p className="text-base font-medium text-content-primary">Join Convex and get 85,000 bonus Chef tokens.</p>
            <p className="mt-1 text-xs text-content-secondary">
              When you sign up, {author.username} will earn bonus resources too!
            </p>
            <Button
              href={`https://convex.dev/try-chef/${share.referralCode}`}
              target="_blank"
              variant="primary"
              className="mt-2"
            >
              Sign up for Convex
            </Button>
          </div>
        </div>
      )}

      {!share.referralCode && (
        <div className="text-center">
          <a
            href="https://www.convex.dev/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            Sign up for Convex to build your own app
          </a>
        </div>
      )}
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

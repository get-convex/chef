import { ComputerDesktopIcon, KeyIcon } from '@heroicons/react/24/outline';
import { LockClosedIcon, RocketIcon, Share2Icon } from '@radix-ui/react-icons';
import { classNames } from '~/utils/classNames';

const features: { icon?: React.ReactNode; title: string; description: string }[] = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_47_2)">
          <path
            d="M34.9965 43.7113C42.8948 42.8311 50.3413 38.609 54.4413 31.5622C52.4996 48.992 33.5013 60.0084 17.9938 53.2447C16.5649 52.6231 15.3349 51.589 14.4908 50.2595C11.0058 44.7699 9.86027 37.7846 11.5063 31.4453C16.2091 39.5877 25.7717 44.5788 34.9965 43.7113Z"
            fill="currentColor"
          />
          <path
            d="M11.2179 26.331C8.01631 33.7531 7.87766 42.4433 11.8027 49.5948C-2.01047 39.1695 -1.85973 16.8593 11.6339 6.53821C12.882 5.58426 14.3652 5.01803 15.9208 4.93188C22.3179 4.59337 28.8176 7.07365 33.3757 11.6957C24.1147 11.788 15.0948 17.7394 11.2179 26.331Z"
            fill="currentColor"
          />
          <path
            d="M37.8422 13.9794C33.1696 7.44334 25.8559 2.99367 17.8429 2.85828C33.3322 -4.19477 52.3848 7.24026 54.4591 24.1466C54.6522 25.716 54.3987 27.3162 53.7052 28.7317C50.8113 34.6276 45.4452 39.2004 39.1748 40.8928C43.7691 32.3443 43.2022 21.9002 37.8422 13.9794Z"
            fill="currentColor"
          />
        </g>
      </svg>
    ),
    title: 'Made by Convex',
    description:
      "Chef is an AI agent for building real-time, full-stack apps on Convex. Chef apps use Convex's AI-optimized APIs, built-in database, edge functions, file storage, and a background scheduler to run AI jobs or build Instagram clones.",
  },
  {
    icon: <ComputerDesktopIcon className="size-6" />,
    title: 'Convex Dashboard',
    description:
      "Chef embeds Convex's full dashboard into the builder, so you can manage real-time data, logs, and environment variables without leaving the interface.",
  },
  {
    icon: <RocketIcon className="size-6" />,
    title: 'One-click Deploy and Live previews',
    description:
      'Chef instantly hosts and deploys your app with a convex.app link, so real users can start using it in seconds.',
  },
  {
    icon: <KeyIcon className="size-6" />,
    title: 'Multi-LLM Support',
    description: 'Chef generates code with multiple model providers. You can use your own API keys to cook with Chef.',
  },
  {
    icon: <LockClosedIcon className="size-6" />,
    title: 'Zero Config Auth',
    description:
      'Chef sets up authentication automatically with Convex Auth, so you can deploy and sign in users without any extra setup.',
  },
  {
    icon: <Share2Icon className="size-6" />,
    title: 'Easy Cloning and Sharing',
    description:
      'Chef lets others clone your app, view your prompt history, and build on your idea—all from a simple shared link.',
  },
];

export default function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => (
        <div
          key={index}
          className={classNames('border-neutral-1 px-4 py-6 dark:border-neutral-10 relative group', {
            'border-b': index !== 5,
            'md:border-b-0': index === 4,
            'lg:border-b-0': index === 3,
            'md:border-r': index % 2 === 0,
            'lg:border-r-0': index === 2,
            'lg:border-r': [1, 3].includes(index),
          })}
        >
          <div className="relative z-10 mb-4 text-neutral-9 transition-colors group-hover:text-neutral-12 dark:text-neutral-2 dark:group-hover:text-white">
            {feature.icon}
          </div>
          <div className="relative z-10 mb-2 inline-flex flex-col items-start justify-start">
            <h2 className="pb-2 text-xl font-semibold leading-none">{feature.title}</h2>
            <div
              className="h-1 w-0 rounded-full bg-[#EE342F] transition-all duration-300 group-hover:w-full"
              aria-hidden
            />
          </div>
          <p className="relative z-10 text-pretty text-sm text-neutral-10 dark:text-neutral-4 lg:text-base">
            {feature.description}
          </p>
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#F7F3F1] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:from-neutral-1/10"
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
}

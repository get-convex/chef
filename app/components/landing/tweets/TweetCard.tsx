import { classNames } from '~/utils/classNames';

export type Tweet = {
  author: string;
  handle: string;
  text: string;
  link: string;
};

export default function TweetCard({ tweet, className }: { tweet: Tweet; className?: string }) {
  return (
    <div
      className={classNames(
        'flex flex-col gap-4 rounded-xl border border-neutral-1 bg-[#F7F3F1] p-3 dark:border-neutral-9 dark:bg-neutral-9/25',
        className,
      )}
    >
      <div className="grow whitespace-pre-line leading-snug text-neutral-9 dark:text-neutral-2">{tweet.text}</div>
      <div className="flex items-center gap-3">
        <img
          src={`/landing/avatars/${tweet.handle}.jpg`}
          alt={`${tweet.author}'s avatar`}
          className="size-10 rounded-full object-cover"
        />
        <div className="flex flex-col gap-1">
          <span className="leading-tight">{tweet.author}</span>
          <a
            href={tweet.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm leading-none text-blue-800 hover:underline dark:text-blue-300"
          >
            @{tweet.handle}
          </a>
        </div>
      </div>
    </div>
  );
}

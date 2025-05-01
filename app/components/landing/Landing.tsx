import Dashboard from './Dashboard';
import FeatureGrid from './FeatureGrid';
import Tweets from './Tweets';

export default function Landing() {
  return (
    <div className="my-12 flex w-full max-w-7xl flex-col gap-16 font-display lg:mb-14 lg:mt-24 lg:gap-28">
      <FeatureGrid />
      <Dashboard />
      <div className="flex flex-col items-center">
        <h2 className="mb-2 text-balance text-center text-2xl font-bold leading-none tracking-tight lg:text-3xl">
          AI models for full-stack Convex apps
        </h2>
        <div className="mb-6 max-w-prose text-balance text-center text-neutral-9 dark:text-neutral-2">
          Pick a faster model when you need speed. Switch to a smarter one when the task gets tricky.
        </div>
        <ul className="flex flex-wrap justify-center gap-8">
          <li className="flex flex-col items-center gap-1 text-sm font-medium">
            <img src="/landing/openAI.svg" alt="OpenAI" width={48} height={48} className="dark:invert" />
            OpenAI
          </li>
          <li className="flex flex-col items-center gap-1 text-sm font-medium">
            <img src="/landing/anthropic.svg" alt="Anthropic" width={48} height={48} className="dark:invert" />
            Anthropic
          </li>
          <li className="flex flex-col items-center gap-1 text-sm font-medium">
            <img src="/landing/google.svg" alt="Google" width={48} height={48} className="dark:invert" />
            Google
          </li>
          <li className="flex flex-col items-center gap-1 text-sm font-medium">
            <img src="/landing/xAI.svg" alt="xAI" width={48} height={48} className="dark:invert" />
            xAI
          </li>
        </ul>
      </div>
      <div className="flex flex-col items-center rounded-xl border border-neutral-1 bg-[#F7F3F1] px-6 py-10 dark:border-neutral-10 dark:bg-neutral-11">
        <h2 className="mb-2 text-balance text-center text-2xl font-bold leading-none tracking-tight lg:text-3xl">
          Building an AI Coding Platform? Use Convex.
        </h2>
        <div className="mb-4 max-w-prose text-balance text-center text-neutral-9 dark:text-neutral-2">
          Convex is the best way for AI to generate the database and backend for your AI coding platform. Entirely in
          code.
        </div>
        <a
          href="https://www.convex.dev/ai-platforms"
          className="whitespace-nowrap rounded-full bg-yellow-400 px-8 py-3 text-sm font-bold text-neutral-12 "
        >
          Learn more
        </a>
      </div>
      <div className="flex flex-col items-center">
        <h2 className="mb-2 text-balance text-center text-2xl font-bold leading-none tracking-tight lg:text-3xl">
          What Developers and Vibe Coders Are Saying
        </h2>
        <div className="mb-6 max-w-prose text-balance text-center text-neutral-9 dark:text-neutral-2">
          Straight from developers and vibe coders in the kitchen.
        </div>
        <Tweets />
      </div>
    </div>
  );
}

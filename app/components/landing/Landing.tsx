export default function Landing() {
  return (
    <div className="max-w-prose flex flex-col gap-6 my-12 text-lg text-neutral-9 dark:text-neutral-2">
      <p>
        <a
          href="https://chef.convex.dev"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          Chef
        </a>{' '}
        is the only AI app builder that knows backend. It builds full-stack web apps with a built-in database, zero
        config auth, file uploads, real-time UIs, and background workflows. If you want to check out the secret sauce
        that powers Chef, you can view or download the system prompt{' '}
        <a
          href="https://github.com/get-convex/chef/releases/latest"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          here
        </a>
        .
      </p>
      <p>
        Chef's capabilities are enabled by being built on top of{' '}
        <a
          href="https://convex.dev"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          Convex
        </a>
        , the open-source reactive database designed to make life easy for web app developers. The "magic" in Chef is
        just the fact that it's using Convex's APIs, which are an ideal fit for codegen.
      </p>
      <p>
        Development of the Chef is led by the Convex team. We{' '}
        <a
          href="https://github.com/get-convex/chef/blob/main/CONTRIBUTING.md"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          welcome bug fixes
        </a>{' '}
        and{' '}
        <a
          href="https://discord.gg/convex"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          love receiving feedback
        </a>
        .
      </p>
      <p>
        This project is a fork of the{' '}
        <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">stable</code> branch of{' '}
        <a
          href="https://github.com/stackblitz-labs/bolt.diy"
          className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
        >
          bolt.diy
        </a>
        .
      </p>
      <div className="flex justify-center pt-4">
        <a
          href="https://github.com/get-convex/chef"
          className="inline-flex items-center gap-2 rounded-xl bg-bolt-elements-button-primary-backgroundHover px-5 py-3 text-lg font-semibold text-bolt-elements-button-primary-text shadow-lg transition-all hover:bg-bolt-elements-button-primary-background hover:shadow-xl"
        >
          <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          View on GitHub
        </a>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="max-w-chat flex flex-col my-12">
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              focusable="false"
              className="octicon octicon-book"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="currentColor"
              style={{ display: 'inline-block', overflow: 'visible', verticalAlign: 'text-bottom' }}
            >
              <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z" />
            </svg>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">README</span>
          </div>
        </div>
        <div className="px-4 py-6 flex flex-col gap-6 text-lg text-neutral-9 dark:text-neutral-2">
          <p>
            <a
              href="https://chef.convex.dev"
              className="text-bolt-elements-button-primary-backgroundHover dark:text-white hover:underline font-semibold"
            >
              Chef
            </a>{' '}
            is the only AI app builder that knows backend. It builds full-stack web apps with a built-in database, zero
            config auth, file uploads, real-time UIs, and background workflows. If you want to check out the secret
            sauce that powers Chef, you can view or download the system prompt{' '}
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
            , the open-source reactive database designed to make life easy for web app developers. The "magic" in Chef
            is just the fact that it's using Convex's APIs, which are an ideal fit for codegen.
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
          <div className="flex justify-center">
            <a
              href="https://github.com/get-convex/chef"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-3 py-2 text-lg text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 transition-all"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      </div>
    </div>
  );
}

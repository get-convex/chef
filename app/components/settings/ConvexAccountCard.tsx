import { ConvexAccountConnect } from '~/components/convex/ConvexAccountConnect';

export function ConvexAccountCard() {
  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Convex Account</h2>
          <p className="mt-1 text-sm text-content-secondary">
            Connect your Convex account to create and manage Convex projects.
          </p>
          <p className="mt-2 text-xs text-content-tertiary">
            Note: Team management, usage, and billing are handled directly in the{' '}
            <a
              href="https://dashboard.convex.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bolt-elements-textTertiary underline hover:text-bolt-elements-textPrimary"
            >
              Convex Dashboard
            </a>
            .
          </p>
        </div>
        <ConvexAccountConnect />
      </div>
    </div>
  );
}

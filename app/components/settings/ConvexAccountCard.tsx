import { ConvexAccountConnect } from '~/components/convex/ConvexAccountConnect';

export function ConvexAccountCard() {
  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Convex Account</h2>
          <p className="mt-1 text-sm text-content-secondary">
            Connect your Convex account to access your teams, create projects, and view usage.
          </p>
        </div>
        <ConvexAccountConnect />
      </div>
    </div>
  );
}

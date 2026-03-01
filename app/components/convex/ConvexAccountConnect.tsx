import { useStore } from '@nanostores/react';
import { convexDashboardTokenStore } from '~/lib/stores/convexDashboardAuth';
import { Button } from '@ui/Button';
import { CheckCircledIcon, Link2Icon } from '@radix-ui/react-icons';

/**
 * Component to connect/reconnect Convex account for dashboard access.
 * Shows connection status and allows user to initiate OAuth flow.
 */
export function ConvexAccountConnect() {
  const dashboardToken = useStore(convexDashboardTokenStore);
  const isConnected = dashboardToken !== null;

  const handleConnect = () => {
    // Open Convex OAuth in a popup window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      '/convex/connect-dashboard',
      'Connect Convex Account',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth completion
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === 'convex_dashboard_connected') {
        window.location.reload(); // Reload to fetch teams with new token
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup listener when popup closes
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        window.removeEventListener('message', handleMessage);
      }
    }, 500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <CheckCircledIcon className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">Convex Account Connected</span>
            </>
          ) : (
            <>
              <Link2Icon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Convex Account Not Connected</span>
            </>
          )}
        </div>
        <Button
          onClick={handleConnect}
          variant={isConnected ? 'outline' : 'default'}
          size="sm"
        >
          {isConnected ? 'Reconnect' : 'Connect Convex Account'}
        </Button>
      </div>

      {!isConnected && (
        <p className="text-sm text-gray-500">
          Connect your Convex account to access your teams, projects, and usage data.
        </p>
      )}
    </div>
  );
}

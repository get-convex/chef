import { useStore } from "@nanostores/react";
import { profileStore } from "~/lib/stores/profile";
import { useAuth0 } from "@auth0/auth0-react";

export function ProfileCard() {
    const profile = useStore(profileStore);
    const { logout } = useAuth0();
    const handleLogout = () => {
      logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    };
    return (
      <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="min-w-[5rem] w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile?.username || 'User'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="i-ph:user-fill text-4xl text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{profile?.username || 'User'}</h3>
              {profile?.email && <p className="text-sm text-bolt-elements-textSecondary">{profile.email}</p>}
              <div className="flex flex-col gap-2 mt-2">
                <a
                  href="https://dashboard.convex.dev/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <div className="i-ph:arrow-square-out min-w-[1rem]" />
                  Manage your profile on the Convex Dashboard
                </a>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-transparent"
                >
                  <div className="i-ph:sign-out min-w--[1rem]" />
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

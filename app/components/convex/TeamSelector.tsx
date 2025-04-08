import { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { classNames } from '~/utils/classNames';
import {
  initializeSelectedTeamSlug,
  setSelectedTeamSlug,
  teamsStore,
  useSelectedTeamSlug,
  type ConvexTeam,
} from '~/lib/stores/convex';
import { useAuth0 } from '@auth0/auth0-react';
import { useStore } from '@nanostores/react';

const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

export function TeamSelector() {
  const [open, setOpen] = useState(false);
  const { getAccessTokenSilently } = useAuth0();
  const teams = useStore(teamsStore);
  const selectedTeamSlug = useSelectedTeamSlug();

  useEffect(() => {
    async function fetchTeams() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const tokenResponse = await getAccessTokenSilently({
          detailedResponse: true,
        });
        const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/teams`, {
          headers: {
            Authorization: `Bearer ${tokenResponse.id_token}`,
          },
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Failed to fetch teams: ${response.statusText}: ${body}`);
        }
        const teamsData = await response.json();
        teamsStore.set(teamsData as ConvexTeam[]);
        initializeSelectedTeamSlug(teamsData as ConvexTeam[]);
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    }

    if (!teams) {
      fetchTeams();
    }
  }, [getAccessTokenSilently, teams]);

  if (!teams) {
    return (
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <div className="flex items-center gap-2 p-1.5 w-full">
          <div className="i-ph:spinner-gap animate-spin" />
          Loading teams…
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find((t) => t.slug === selectedTeamSlug) || teams[0];

  return (
    <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
      <Select.Root
        value={selectedTeam.slug}
        onValueChange={(value: string) => {
          setSelectedTeamSlug(value);
        }}
        open={open}
        onOpenChange={setOpen}
      >
        <Select.Trigger
          className={classNames(
            'flex items-center gap-2 p-1.5 w-full rounded-md text-left text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background',
            'hover:bg-bolt-elements-item-backgroundAccent/90',
            open ? 'bg-bolt-elements-item-backgroundAccent/90' : '',
          )}
          aria-label="Select team"
        >
          <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
          <Select.Value placeholder="Select a team...">{selectedTeam.name}</Select.Value>
          <Select.Icon className="ml-auto">
            <div className={classNames('i-ph:caret-down-bold transition-all', open ? 'rotate-180' : '')}></div>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 min-w-[200px] max-h-64 overflow-y-auto bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md shadow-lg"
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport>
              <div className="border-b border-b-bolt-elements-borderColor p-2 sticky top-0 bg-bolt-elements-button-secondary-background z-10">
                <h3 className="text-sm font-medium">Select Team</h3>
                <p className="mt-1 text-xs text-bolt-elements-textSecondary">
                  Your project will be created in this Convex team
                </p>
              </div>
              {teams.map((team) => (
                <Select.Item
                  key={team.id}
                  value={team.slug}
                  className={classNames(
                    'flex items-center gap-2 p-2 cursor-pointer outline-none text-sm',
                    'data-[highlighted]:bg-bolt-elements-item-backgroundActive data-[highlighted]:text-bolt-elements-item-contentAccent',
                    'data-[state=checked]:text-bolt-elements-item-contentAccent',
                  )}
                >
                  <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
                  <div className="max-w-48 truncate">
                    <Select.ItemText>{team.name}</Select.ItemText>
                  </div>
                  <Select.ItemIndicator className="ml-auto">
                    <div className="i-ph:check" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

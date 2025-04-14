import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { classNames } from '~/utils/classNames';
import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { useStore } from '@nanostores/react';
import { CaretDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { Spinner } from '~/components/ui/Spinner';

export function TeamSelector({
  selectedTeamSlug,
  setSelectedTeamSlug,
  description,
}: {
  selectedTeamSlug: string | null;
  setSelectedTeamSlug: (teamSlug: string) => void;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const teams = useStore(convexTeamsStore);

  if (!teams) {
    return (
      <div className="flex overflow-hidden rounded-md border border-bolt-elements-borderColor text-sm">
        <div className="flex w-full items-center gap-2 p-1.5">
          <Spinner />
          Loading teams…
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find((t) => t.slug === selectedTeamSlug) ?? null;

  return (
    <div className="flex overflow-hidden rounded-md border border-bolt-elements-borderColor text-sm">
      <Select.Root
        value={selectedTeam?.slug ?? 'Select a team...'}
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
          <img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
          <Select.Value placeholder="Select a team...">{selectedTeam?.name ?? 'Select a team...'}</Select.Value>
          <Select.Icon className="ml-auto">
            <CaretDownIcon className={classNames('transition-all', open ? 'rotate-180' : '')} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 max-h-64 min-w-[200px] overflow-y-auto rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-lg"
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport>
              <div className="sticky top-0 z-10 border-b border-b-bolt-elements-borderColor bg-bolt-elements-button-secondary-background p-2">
                <h3 className="text-sm font-medium">Select Team</h3>
                {description && <p className="mt-1 text-xs text-bolt-elements-textSecondary">{description}</p>}
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
                  <img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
                  <div className="max-w-48 truncate">
                    <Select.ItemText>{team.name}</Select.ItemText>
                  </div>
                  <Select.ItemIndicator className="ml-auto">
                    <CheckIcon />
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

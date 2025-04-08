import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { classNames } from '~/utils/classNames';
import { setSelectedTeamSlug } from '~/lib/stores/convex';

const EXAMPLE_TEAMS = [
  { id: '1', name: "Ari's Team", slug: 'atrakh' },
  { id: '2', name: 'Work Team', slug: 'work' },
  { id: '3', name: 'Open Source Team Blah Blah Blah', slug: 'opensource' },
] as const;

interface TeamSelectorProps {
  selectedTeamSlug: string | null;
  onTeamSelect: (teamSlug: string) => void;
}

export function TeamSelector({ selectedTeamSlug, onTeamSelect }: TeamSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedTeam = EXAMPLE_TEAMS.find((t) => t.slug === selectedTeamSlug) || EXAMPLE_TEAMS[0];

  return (
    <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
      <Select.Root
        value={selectedTeam.slug}
        onValueChange={(value: string) => {
          setSelectedTeamSlug(value);
          onTeamSelect(value);
        }}
        open={open}
        onOpenChange={setOpen}
      >
        <Select.Trigger
          className="flex items-center gap-2 p-1.5 w-full rounded-md text-left text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundHover bg-bolt-elements-button-secondary-background/50"
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
              <div className="border-b p-2 sticky top-0 bg-bolt-elements-button-secondary-background">
                <h3 className="text-sm font-medium">Select Team</h3>
                <p className="mt-1 text-xs text-bolt-elements-textSecondary">
                  Your project will be created in this Convex team
                </p>
              </div>
              {EXAMPLE_TEAMS.map((team) => (
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

import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { useStore } from '@nanostores/react';
import { Combobox } from '@ui/Combobox';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';

export const TeamSelector = memo(function TeamSelector({
  selectedTeamSlug,
  setSelectedTeamSlug,
  description,
  size = 'md',
}: {
  selectedTeamSlug: string | null;
  setSelectedTeamSlug: (teamSlug: string) => void;
  description?: string;
  size?: 'sm' | 'md';
}) {
  const teams = useStore(convexTeamsStore);

  const selectedTeam = teams?.find((t) => t.slug === selectedTeamSlug) ?? null;

  return (
    <Combobox
      label="Select team"
      options={
        teams?.map((team) => ({
          label: team.name,
          value: team.slug,
        })) ?? []
      }
      className="w-fit"
      buttonClasses="w-fit"
      size={size}
      buttonProps={{
        loading: !teams,
      }}
      optionsHeader={
        <div className="flex flex-col gap-0.5 px-2">
          <h5>Select Team</h5>
          {description && <p className="text-xs text-content-secondary">{description}</p>}
        </div>
      }
      disableSearch
      selectedOption={selectedTeam?.slug}
      placeholder="Select a team..."
      setSelectedOption={(option) => setSelectedTeamSlug(option ?? '')}
      Option={({ label, inButton }) => (
        <div className="flex items-center gap-1">
          {inButton && <img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />}
          <div className={classNames('truncate', inButton ? 'max-w-[6.5rem]' : 'max-w-48')}>{label}</div>
        </div>
      )}
    />
  );
});

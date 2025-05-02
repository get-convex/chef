import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { useStore } from '@nanostores/react';
import { Combobox } from '@ui/Combobox';
import { memo } from 'react';

export const TeamSelector = memo(function TeamSelector({
  selectedTeamSlug,
  setSelectedTeamSlug,
  description,
}: {
  selectedTeamSlug: string | null;
  setSelectedTeamSlug: (teamSlug: string) => void;
  description?: string;
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
        <div className="flex items-center gap-2">
          {inButton && <img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />}
          <div className="max-w-48 truncate">{label}</div>
        </div>
      )}
    />
  );
});

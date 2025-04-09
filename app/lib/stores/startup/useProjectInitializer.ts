import { setSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { convexProjectStore } from '~/lib/stores/convexProject';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useProjectInitializer(chatId: string) {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId
      ? {
          sessionId,
          chatId,
        }
      : 'skip',
  );
  useEffect(() => {
    if (projectInfo?.kind === 'connected') {
      convexProjectStore.set({
        token: projectInfo.adminKey,
        deploymentName: projectInfo.deploymentName,
        deploymentUrl: projectInfo.deploymentUrl,
        projectSlug: projectInfo.projectSlug,
        teamSlug: projectInfo.teamSlug,
      });
      setSelectedTeamSlug(projectInfo.teamSlug);
    }
    if (projectInfo?.kind === 'failed') {
      toast.error(projectInfo.errorMessage);
    }
  }, [projectInfo]);
}

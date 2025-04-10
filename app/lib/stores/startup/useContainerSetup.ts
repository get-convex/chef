import { useEffect } from 'react';
import { ContainerBootState, setContainerBootState, waitForBootStepCompleted } from '~/lib/stores/containerBootState';
import { webcontainer } from '~/lib/webcontainer';
import { useStore } from '@nanostores/react';
import { sessionIdStore } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { useConvex } from 'convex/react';
import { decompressSnapshot } from '~/lib/snapshot';
import { streamOutput } from '~/utils/process';
import { cleanTerminalOutput } from '~/utils/shell';
import { toast } from 'sonner';
import { waitForConvexProjectConnection, type ConvexProject } from '~/lib/stores/convexProject';
import type { WebContainer } from '@webcontainer/api';
import { queryEnvVariable, setEnvVariables } from '~/lib/convexEnvVariables';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';

const TEMPLATE_URL = '/template-snapshot-cb4ccf96.bin';

export function useNewChatContainerSetup() {
  const convex = useConvex();
  useEffect(() => {
    const runSetup = async () => {
      try {
        await waitForBootStepCompleted(ContainerBootState.STARTING);
        await setupContainer(convex, TEMPLATE_URL);
      } catch (error: any) {
        toast.error('Failed to setup Chef environment. Try reloading the page?');
        setContainerBootState(ContainerBootState.ERROR, error);
      }
    };
    void runSetup();
  }, [convex]);
}

export function useExistingChatContainerSetup(loadedChatId: string | undefined) {
  const sessionId = useStore(sessionIdStore);
  const convex = useConvex();
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (!loadedChatId) {
      return;
    }
    const runSetup = async () => {
      try {
        await waitForBootStepCompleted(ContainerBootState.STARTING);
        let snapshotUrl = await convex.query(api.snapshot.getSnapshotUrl, { chatId: loadedChatId, sessionId });
        if (!snapshotUrl) {
          console.warn(`Existing chat ${loadedChatId} has no snapshot. Loading the base template.`);
          snapshotUrl = TEMPLATE_URL;
        }
        await setupContainer(convex, snapshotUrl);
      } catch (error: any) {
        toast.error('Failed to setup Chef environment. Try reloading the page?');
        setContainerBootState(ContainerBootState.ERROR, error);
      }
    };
    void runSetup();
  }, [convex, loadedChatId, sessionId]);
}

async function setupContainer(convex: ConvexReactClient, snapshotUrl: string) {
  const resp = await fetch(snapshotUrl);
  if (!resp.ok) {
    throw new Error(`Failed to download snapshot (${resp.statusText}): ${resp.statusText}`);
  }
  const compressed = await resp.arrayBuffer();
  const decompressed = await decompressSnapshot(new Uint8Array(compressed));

  const container = await webcontainer;
  await container.mount(decompressed);

  // After loading the snapshot, we need to load the files into the FilesStore since
  // we won't receive file events for snapshot files.
  const { workbenchStore } = await import('~/lib/stores/workbench');
  await workbenchStore.prewarmWorkdir(container);

  setContainerBootState(ContainerBootState.DOWNLOADING_DEPENDENCIES);
  const npm = await container.spawn('npm', ['install']);
  const { output, exitCode } = await streamOutput(npm);
  console.log('NPM output', cleanTerminalOutput(output));

  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}: ${output}`);
  }

  setContainerBootState(ContainerBootState.SETTING_UP_CONVEX_PROJECT);
  const convexProject = await waitForConvexProjectConnection();

  setContainerBootState(ContainerBootState.SETTING_UP_CONVEX_ENV_VARS);
  await setupConvexEnvVars(container, convexProject);
  await setupOpenAIToken(convex, convexProject);

  setContainerBootState(ContainerBootState.CONFIGURING_CONVEX_AUTH);
  const { initializeConvexAuth } = await import('~/lib/convexAuth');
  await initializeConvexAuth(convexProject);

  setContainerBootState(ContainerBootState.STARTING_BACKUP);
  await workbenchStore.startBackup();

  setContainerBootState(ContainerBootState.READY);
}

async function setupConvexEnvVars(webcontainer: WebContainer, convexProject: ConvexProject) {
  const { token } = convexProject;

  const envFilePath = '.env.local';
  const envVarName = 'CONVEX_DEPLOY_KEY';
  const envVarLine = `${envVarName}=${token}\n`;

  let content: string | null = null;
  try {
    content = await webcontainer.fs.readFile(envFilePath, 'utf-8');
  } catch (err: any) {
    if (!err.toString().includes('ENOENT')) {
      throw err;
    }
  }
  if (content === null) {
    // Create the file if it doesn't exist
    await webcontainer.fs.writeFile(envFilePath, envVarLine);
  } else {
    const lines = content.split('\n');

    // Check if the env var already exists
    const envVarExists = lines.some((line) => line.startsWith(`${envVarName}=`));

    if (!envVarExists) {
      // Add the env var to the end of the file
      const newContent = content.endsWith('\n') ? `${content}${envVarLine}` : `${content}\n${envVarLine}`;
      await webcontainer.fs.writeFile(envFilePath, newContent);
    }
  }
}

async function setupOpenAIToken(convex: ConvexReactClient, project: ConvexProject) {
  const existing = await queryEnvVariable(project, 'CONVEX_OPENAI_API_KEY');
  if (existing) {
    return;
  }
  const token = await convex.mutation(api.openaiProxy.issueOpenAIToken);
  if (token) {
    await setEnvVariables(project, {
      CONVEX_OPENAI_API_KEY: token,
      CONVEX_OPENAI_BASE_URL: getConvexSiteUrl() + '/openai-proxy',
    });
  }
}

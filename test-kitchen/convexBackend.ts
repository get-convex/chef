import { Mutex } from 'async-mutex';
import { existsSync, mkdirSync, writeFileSync, chmodSync, openSync } from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import portfinder from 'portfinder';
import { ChildProcess, spawn } from 'child_process';
import type { ConvexProject } from 'chef-agent/types.js';
import { cleanConvexOutput } from 'chef-agent/utils/shell.js';
import { execFile } from './utils.js';
import { logger } from 'chef-agent/utils/logger.js';
import { wrapTraced } from 'braintrust';

const instance_name = 'carnitas';
const instance_secret = '4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974';
const admin_key =
  '0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd';

const convexRelease = fetch('https://api.github.com/repos/get-convex/convex-backend/releases')
  .then((r) => r.json())
  .then((releases) => releases[0]);

const downloadBinaryMutex = new Mutex();
const portMutex = new Mutex();

export interface ConvexBackend {
  port: number;
  siteProxyPort: number;
  process: ChildProcess;
  project: ConvexProject;
}

export async function withConvexBackend<T>(backendDir: string, fn: (backend: ConvexBackend) => Promise<T>): Promise<T> {
  const storageDir = path.join(backendDir, 'convex_local_storage');
  mkdirSync(storageDir, { recursive: true });

  const sqlitePath = path.join(backendDir, 'convex_local_backend.sqlite3');
  const convexBinary = await downloadConvexBinary();

  const { port, siteProxyPort, process } = await portMutex.runExclusive(async () => {
    const port = await portfinder.getPortPromise();
    // NB: `port` is currently unused, but we want `portFinder` to pick something else.
    const siteProxyPort = await portfinder.getPortPromise({ port: port + 1 });
    const args = [
      '--port',
      port.toString(),
      '--site-proxy-port',
      siteProxyPort.toString(),
      '--instance-name',
      instance_name,
      '--instance-secret',
      instance_secret,
      '--local-storage',
      storageDir,
      sqlitePath,
    ];
    const process = spawn(convexBinary, args, {
      cwd: backendDir,
      stdio: [
        null,
        openSync(path.join(backendDir, 'backend.stdout.log'), 'w'),
        openSync(path.join(backendDir, 'backend.stderr.log'), 'w'),
      ],
    });
    await healthcheck(port);
    if (process.exitCode !== null) {
      throw new Error(`Convex backend exited with code ${process.exitCode}`);
    }
    return { port, siteProxyPort, process };
  });
  try {
    const project = {
      deploymentUrl: `http://localhost:${port}`,
      deploymentName: instance_name,
      projectSlug: 'chef',
      teamSlug: 'chef',
      token: admin_key,
    };
    return await fn({ port, siteProxyPort, process, project });
  } finally {
    process.kill();
  }
}

export const deploy = wrapTraced(async function deploy(repoDir: string, backend: ConvexBackend) {
  const args = ['convex', 'dev', '--once', '--admin-key', admin_key, '--url', backend.project.deploymentUrl];
  const { stdout, stderr } = await execFile('npx', args, { cwd: repoDir });
  return cleanConvexOutput(stdout + stderr);
});

export const runTypecheck = wrapTraced(async function runTypecheck(repoDir: string) {
  const args = ['tsc', '--noEmit', '--project', 'tsconfig.app.json'];
  const { stdout, stderr } = await execFile('npx', args, { cwd: repoDir });
  return cleanConvexOutput(stdout + stderr);
});

export const npmInstall = wrapTraced(async function npmInstall(repoDir: string, packages: string[]) {
  const args = ['npm', 'install', ...packages];
  const { stdout, stderr } = await execFile('npx', args, { cwd: repoDir });
  return cleanConvexOutput(stdout + stderr);
});

const downloadConvexBinary = wrapTraced(async function downloadConvexBinary() {
  const latest = await convexRelease;
  const version = latest['tag_name'];
  const arch = { x64: 'x86_64', arm64: 'aarch64' }[os.arch()];
  if (!arch) {
    throw new Error(`Unsupported architecture: ${os.arch()}`);
  }
  const tripleOs = {
    darwin: 'apple-darwin',
    linux: 'unknown-linux-gnu',
    win32: 'pc-windows-msvc',
  }[os.platform() as string];
  if (!tripleOs) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const targetPattern = `convex-local-backend-${arch}-${tripleOs}`;
  const matchingAsset = latest['assets'].find((asset: any) => asset['name'].includes(targetPattern));
  if (!matchingAsset) {
    throw new Error(`Could not find matching asset for ${targetPattern}`);
  }

  const binaryDir = path.join(os.homedir(), '.convex-evals', 'releases');
  mkdirSync(binaryDir, { recursive: true });

  // Include version in binary name
  const binaryName = `convex-local-backend-${version}${os.platform() === 'win32' ? '.exe' : ''}`;
  const binaryPath = path.join(binaryDir, binaryName);

  return await downloadBinaryMutex.runExclusive(async () => {
    if (existsSync(binaryPath)) {
      return binaryPath;
    }

    logger.info('Latest release:', version);
    const url = matchingAsset['browser_download_url'];
    logger.info('Downloading:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const zipBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract the binary
    const extractedBinary = await zip.file('convex-local-backend')?.async('nodebuffer');
    if (!extractedBinary) {
      throw new Error('Could not find binary in zip file');
    }

    // Write the binary to disk
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, extractedBinary);

    // Make the binary executable on Unix systems
    if (os.platform() !== 'win32') {
      chmodSync(binaryPath, 0o755);
    }

    logger.info('Extracted binary to:', binaryPath);
    return binaryPath;
  });
});

const healthcheck = wrapTraced(async function healthcheck(port: number) {
  const deadline = Date.now() + 10000;
  let numAttempts = 0;
  while (true) {
    try {
      const response = await fetch(`http://localhost:${port}/version`);
      if (response.ok) {
        return true;
      }
    } catch (e) {
      const remaining = deadline - Date.now();
      if (remaining < 0) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(0.1 * 2 ** numAttempts, remaining)));
      numAttempts++;
    }
  }
});

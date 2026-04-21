#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Command } from 'commander';
import dotenv from 'dotenv';
import JSZip from 'jszip';

const DEFAULT_CHEF_URL = 'https://chef.convex.dev';
const DEFAULT_BUILD_DIR = 'dist';

function parseEnvLocal(projectDir) {
  const envLocalPath = join(projectDir, '.env.local');
  if (!existsSync(envLocalPath)) {
    return {};
  }
  return dotenv.parse(readFileSync(envLocalPath));
}

function extractDeploymentName(raw) {
  // `.env.local` stores `CONVEX_DEPLOYMENT=dev:funky-otter-123 # team: ... project: ...`
  const stripped = raw.split('#')[0].trim();
  return stripped.includes(':') ? stripped.split(':').pop().trim() : stripped;
}

function runCommand(command, cwd) {
  const [bin, ...args] = command.split(' ');
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`Command failed (${command}) with exit code ${result.status}`);
  }
}

async function addDirectoryToZip(zip, dir, base) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, absPath, base);
    } else if (entry.isFile()) {
      const relPath = relative(base, absPath);
      zip.file(relPath, await readFile(absPath));
    }
  }
}

async function buildZip(buildPath) {
  const zip = new JSZip();
  await addDirectoryToZip(zip, buildPath, buildPath);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function uploadBundle({ chefUrl, token, deploymentName, zipBuffer }) {
  const form = new FormData();
  form.append('file', new Blob([zipBuffer]), 'dist.zip');
  form.append('deploymentName', deploymentName);
  form.append('token', token);

  const url = `${chefUrl.replace(/\/+$/, '')}/api/deploy-simple`;
  const response = await fetch(url, { method: 'POST', body: form });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status} ${response.statusText}): ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function run(opts) {
  const projectDir = resolve(opts.projectDir);
  if (!existsSync(projectDir)) {
    throw new Error(`Project directory does not exist: ${projectDir}`);
  }

  const env = parseEnvLocal(projectDir);
  const token = opts.token ?? process.env.CONVEX_DEPLOY_KEY ?? env.CONVEX_DEPLOY_KEY;
  const rawDeployment = opts.deployment ?? process.env.CONVEX_DEPLOYMENT ?? env.CONVEX_DEPLOYMENT;

  if (!token) {
    throw new Error(
      'Missing CONVEX_DEPLOY_KEY. Set it in .env.local, the CONVEX_DEPLOY_KEY env var, or pass --token.',
    );
  }
  if (!rawDeployment) {
    throw new Error(
      'Missing CONVEX_DEPLOYMENT. Set it in .env.local, the CONVEX_DEPLOYMENT env var, or pass --deployment.',
    );
  }

  const deploymentName = extractDeploymentName(rawDeployment);
  console.log(`→ Project:    ${projectDir}`);
  console.log(`→ Deployment: ${deploymentName}`);
  console.log(`→ Chef host:  ${opts.chefUrl}`);

  if (!opts.skipInstall) {
    if (!existsSync(join(projectDir, 'node_modules'))) {
      console.log('\n→ Installing dependencies (npm install)...');
      runCommand('npm install --no-fund --no-audit', projectDir);
    } else {
      console.log('→ node_modules exists, skipping install');
    }
  }

  if (!opts.skipBuild) {
    console.log(`\n→ Building (${opts.buildCommand})...`);
    runCommand(opts.buildCommand, projectDir);
  }

  const buildPath = join(projectDir, opts.buildDir);
  if (!existsSync(buildPath) || !statSync(buildPath).isDirectory()) {
    throw new Error(
      `Build output directory not found: ${buildPath}. Pass --build-dir if your build writes elsewhere.`,
    );
  }

  console.log(`\n→ Zipping ${opts.buildDir}/...`);
  const zipBuffer = await buildZip(buildPath);
  console.log(`  ${(zipBuffer.length / 1024).toFixed(1)} KiB`);

  console.log('\n→ Uploading to Chef...');
  const result = await uploadBundle({
    chefUrl: opts.chefUrl,
    token,
    deploymentName,
    zipBuffer,
  });

  console.log('\n✓ Deployed');
  console.log(`  https://${deploymentName}.convex.app`);
  if (result && typeof result === 'object' && 'localDevWarning' in result) {
    console.log(`  Warning: ${result.localDevWarning}`);
  }
}

const program = new Command()
  .name('chef-deploy')
  .description('Build and deploy a Chef project to its *.convex.app host.')
  .option('-p, --project-dir <path>', 'Path to the Chef project', process.cwd())
  .option('-t, --token <token>', 'Convex deploy key (otherwise read from .env.local / CONVEX_DEPLOY_KEY)')
  .option('-d, --deployment <name>', 'Convex deployment name (otherwise read from .env.local / CONVEX_DEPLOYMENT)')
  .option('--build-command <cmd>', 'Command used to build the site', 'npm run build')
  .option('--build-dir <dir>', 'Directory containing the built site', DEFAULT_BUILD_DIR)
  .option('--chef-url <url>', 'Chef host', DEFAULT_CHEF_URL)
  .option('--skip-build', 'Skip the build step and upload --build-dir as-is', false)
  .option('--skip-install', 'Skip installing dependencies', false);

program.parseAsync(process.argv).then(
  () =>
    run(program.opts()).catch((err) => {
      console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }),
  (err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);

#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, 'cli.ts');
const tsxPath = resolve(__dirname, 'node_modules/.bin/tsx');

const result = spawnSync(tsxPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status || 0);

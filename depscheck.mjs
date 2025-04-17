#!/usr/bin/env node

import { existsSync } from 'fs';
import process from 'process';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  console.error('\x1b[31m❌ .env.local file is missing\x1b[0m');
  console.error('Run `pnpm run update-env`');
  process.exit(1);
}

function checkNodeVersion() {
  const version = process.version.match(/^v(\d+)/)[1];
  if (parseInt(version) < 20) {
    console.error('\x1b[31m❌ Node.js 20 or greater is required. Current version:', process.version, '\x1b[0m');
    console.error("Run `nvm use`, and if that doesn't work run `nvm install; nvm use`.");
    process.exit(1);
  }
}

function checkEnvVars() {
  if (!process.env.XAI_API_KEY) {
    console.error('\x1b[31m❌ XAI_API_KEY environment variable is not set\x1b[0m');
    console.error("That's just a fairly recent one, but you're probably missing others too.");
    console.error('Run `pnpm run update-env`');
    process.exit(1);
  }
}

checkNodeVersion();
checkEnvVars();

import { chromium, type Page } from '@playwright/test';
import 'dotenv/config';
import { join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import JSZip from 'jszip';
import * as lz4 from 'lz4-wasm-nodejs';

interface GenerateAppOptions {
  prompt: string;
  chefUrl: string;
  outputDir?: string;
  headless?: boolean;
  credentials: {
    email: string;
    password: string;
  };
}

async function isChefRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function handleSignIn(page: Page, chefUrl: string, credentials: { email: string; password: string }) {
  const signInPage = await page.context().newPage();
  await signInPage.goto(`${chefUrl}/signin?use-email=1`, {
    timeout: 60000,
  });
  await signInPage.click('button:has-text("Continue with GitHub")');
  await signInPage.fill('input[name="username"]', credentials.email);
  await signInPage.fill('input[type="password"]', credentials.password);
  await signInPage.click('button[type="submit"]');
  await signInPage.waitForSelector('div:has-text("Done logging in!")', { timeout: 10000 });
  await signInPage.close();
}

export async function generateApp({ prompt, chefUrl, outputDir, headless = true, credentials }: GenerateAppOptions) {
  if (!credentials.email || !credentials.password) {
    throw new Error('Email and password are required');
  }

  if (!(await isChefRunning(chefUrl))) {
    throw new Error(
      `No Chef server found at ${chefUrl}. Please start the appropriate server first:\n` +
        `  - For --dev: Run 'pnpm run dev' (http://127.0.0.1:5173)\n` +
        `  - For --local-build: Run 'pnpm run build && pnpm run start' (http://localhost:3000)\n` +
        `  - For --prod: are you connected to the internet?`,
    );
  }

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 100,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(chefUrl);
    await handleSignIn(page, chefUrl, credentials);
    console.error('Successfully signed in, ready for interaction');

    const inputSelector = 'textarea';
    await page.waitForSelector(inputSelector);
    await page.fill(inputSelector, prompt);
    const submitButton = await page.waitForSelector(`${inputSelector} ~ button:not([disabled])`);
    await submitButton.click();

    await page.waitForSelector('[data-streaming-indicator-stream-status="ready"]', { timeout: 3 * 60000 });

    const messagesData = await page.getAttribute('div[data-chat-visible="true"]', 'data-messages-for-evals');
    if (!messagesData) {
      throw new Error('No messages data found after completion');
    }
    const { sessionId, chatId, convexSiteUrl } = JSON.parse(messagesData);

    if (outputDir) {
      const codeButton = await page.waitForSelector('button:has-text("Code")', { timeout: 10000 });
      await codeButton.click();
      const downloadButton = await page.waitForSelector('button:has-text("Download Code")', { timeout: 10000 });

      // If outputDir exists, it was already checked by the CLI
      await mkdir(outputDir, { recursive: true });
      // If force was used, clean the directory
      await rm(outputDir, { recursive: true, force: true });
      await mkdir(outputDir, { recursive: true });
      console.error(`Using output directory: ${outputDir}`);

      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;

      const zipBuffer = await download.createReadStream().then((stream) => {
        const chunks: Uint8Array[] = [];
        return new Promise<Buffer>((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      });

      const zip = await JSZip.loadAsync(zipBuffer);
      for (const [path, file] of Object.entries(zip.files)) {
        if (file.dir) {
          await mkdir(join(outputDir, path), { recursive: true });
        } else {
          const content = await file.async('nodebuffer');
          await writeFile(join(outputDir, path), content);
        }
      }
    }

    // Wait a while to make sure the messages have been saved. For some reason,
    // relying on the beforeunload handler doesn't work from playwright.
    await page.waitForTimeout(10_000);

    const messagesResponse = await fetch(new URL('/initial_messages', convexSiteUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, chatId }),
    });
    console.log('messagesResponse', messagesResponse.status);
    if (!messagesResponse.ok) {
      throw new Error('Failed to fetch initial messages');
    }
    const messagesBlob = await messagesResponse.arrayBuffer();
    const decompressed = await lz4.decompress(new Uint8Array(messagesBlob));
    const messages = JSON.parse(new TextDecoder().decode(decompressed));

    return { messages, outputDir };
  } finally {
    await browser.close();
  }
}

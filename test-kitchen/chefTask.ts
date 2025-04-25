import { CoreMessage, generateText, LanguageModelUsage } from 'ai';
import * as walkdir from 'walkdir';
import { path } from 'chef-agent/utils/path';
import { ChefResult, ChefModel } from './types';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { ChatContextManager } from 'chef-agent/ChatContextManager';
import { UIMessage } from 'ai';
import { deploy, npmInstall, runTypecheck } from './convexBackend';
import { StreamingMessageParser } from 'chef-agent/message-parser';
import { withConvexBackend } from './convexBackend';
import { initializeConvexAuth } from 'chef-agent/convexAuth';
import { deployToolParameters } from 'chef-agent/tools/deploy';
import { ROLE_SYSTEM_PROMPT } from 'chef-agent/prompts/system';
import { generateId } from 'ai';
import { SystemPromptOptions } from 'chef-agent/types';
import { npmInstallToolDescription, npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import { cleanupAssistantMessages } from 'chef-agent/cleanupAssistantMessages';
import { generalSystemPrompt } from 'chef-agent/prompts/system';
import { deployToolDescription } from 'chef-agent/tools/deploy';
import { makePartId } from 'chef-agent/partId';
import { logger } from 'chef-agent/utils/logger';
import { traced, wrapTraced } from 'braintrust';

const MAX_STEPS = 8;
const OUTPUT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const IGNORED_FILENAMES = [
  '.gitignore',
  'node_modules',
  'package-lock.json',
  'tsconfig.node.json',
  'tailwind.config.js',
  'tsconfig.app.json',
  'tsconfig.json',
  'components.json',
  'vite.config.ts',
  'vite-env.d.ts',
];

const TEMPLATE_DIR = '../template';

export async function chefTask(model: ChefModel, outputDir: string, userMessage: string): Promise<ChefResult> {
  if (!path.isAbsolute(outputDir)) {
    throw new Error(`outputDir ${outputDir} must be an absolute path`);
  }

  const taskDir = path.join(outputDir, `task-${generateId()}`);
  mkdirSync(taskDir, { recursive: true });

  const repoDir = await setupRepoDir(taskDir);

  const backendDir = path.join(taskDir, 'backend');
  mkdirSync(backendDir, { recursive: true });
  const { numDeploys, usage, success } = await withConvexBackend(backendDir, async (backend) => {
    const contextManager = new ChatContextManager(
      () => undefined,
      () => ({}),
      () => new Map(),
    );

    const messageParser = new StreamingMessageParser({
      callbacks: {
        onActionClose: (data) => {
          if (data.action.type === 'file') {
            const filePath = path.join(repoDir, data.action.filePath);
            logger.info(`Writing to ${filePath}`);
            mkdirSync(path.dirname(filePath), { recursive: true });
            writeFileSync(filePath, data.action.content);
          }
        },
      },
    });

    // TODO: Set up OpenAI + Resend proxies.
    logger.info('Initializing convex auth');
    await wrapTraced(initializeConvexAuth)(backend.project);
    await deploy(repoDir, backend);

    const initialUserMessage: UIMessage = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      parts: [
        {
          type: 'text',
          text: userMessage,
        },
      ],
    };
    const opts: SystemPromptOptions = {
      enableBulkEdits: true,
      enablePreciseEdits: false,
      includeTemplate: true,
      usingOpenAi: model.name.startsWith('gpt-'),
      usingGoogle: model.name.startsWith('gemini-'),

      // TODO: We need to set up a Convex deployment running the `chef`
      // app to setup the OpenAI and Resend proxies + manage their tokens.
      openaiProxyEnabled: false,
      resendProxyEnabled: false,
    };
    const assistantMessage: UIMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      parts: [],
    };
    let numDeploys = 0;
    let success: boolean;
    let hadSuccessfulDeploy = false;
    const totalUsage: LanguageModelUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    while (true) {
      if (assistantMessage.parts.length >= MAX_STEPS) {
        logger.error('Reached max steps, ending test.');
        success = false;
        break;
      }
      const messages = [initialUserMessage];
      if (assistantMessage.parts.length > 0) {
        messages.push(assistantMessage);
      }
      const context = contextManager.prepareContext(messages);
      const start = performance.now();
      logger.info('Generating...');
      const response = await invokeGenerateText(model, opts, context);
      const partId = makePartId(assistantMessage.id, assistantMessage.parts.length);
      assistantMessage.content += response.text;
      if (response.text) {
        assistantMessage.parts.push({
          type: 'text',
          text: response.text,
        });
      }
      const parsed = messageParser.parse(partId, response.text);
      logger.info(
        `Time taken: ${performance.now() - start}ms\nUsage: ${JSON.stringify(response.usage)}\nMessage: ${parsed}`,
      );
      totalUsage.promptTokens += response.usage.promptTokens;
      totalUsage.completionTokens += response.usage.completionTokens;
      totalUsage.totalTokens += response.usage.totalTokens;

      if (response.finishReason == 'stop') {
        success = hadSuccessfulDeploy;
        break;
      }
      if (response.finishReason === 'length') {
        continue;
      }
      if (response.finishReason != 'tool-calls') {
        throw new Error(`Unknown finish reason: ${response.finishReason}`);
      }
      if (response.toolCalls.length != 1) {
        throw new Error('Expected exactly one tool call');
      }
      const toolCall = response.toolCalls[0];
      let toolCallResult: string;
      try {
        switch (toolCall.toolName) {
          case 'deploy': {
            numDeploys++;
            toolCallResult = await deploy(repoDir, backend);
            toolCallResult += await runTypecheck(repoDir);
            if (numDeploys == 1) {
              toolCallResult += '\n\nDev server started successfully!';
            }
            logger.info('Successfully deployed');
            hadSuccessfulDeploy = true;
            break;
          }
          case 'npmInstall': {
            const args = npmInstallToolParameters.parse(toolCall.args);
            const packages = args.packages.split(' ');
            toolCallResult = await npmInstall(repoDir, packages);
            break;
          }
          default:
            throw new Error(`Unknown tool call: ${JSON.stringify(toolCall)}`);
        }
      } catch (e: any) {
        logger.info('Tool call failed', e);
        let message = e.toString();
        if (!message.startsWith('Error:')) {
          message = 'Error: ' + message;
        }
        toolCallResult = message;
      }
      assistantMessage.parts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          state: 'result',
          args: toolCall.args,
          result: toolCallResult,
        },
      });
    }
    return {
      success,
      numDeploys,
      usage: totalUsage,
    };
  });
  const files: Record<string, string> = {};
  const repoPaths = walkdir.sync(repoDir, {
    filter: (directory, files) => {
      return files.filter((file) => !IGNORED_FILENAMES.includes(file));
    },
  });
  for (const repoPath of repoPaths) {
    const relativePath = path.relative(repoDir, repoPath);
    if (relativePath.startsWith('convex/_generated/')) {
      continue;
    }
    const ext = path.extname(relativePath);
    if (!OUTPUT_EXTENSIONS.includes(ext)) {
      continue;
    }
    if (!statSync(repoPath).isFile()) {
      continue;
    }
    if (IGNORED_FILENAMES.includes(relativePath)) {
      continue;
    }
    files[relativePath] = readFileSync(repoPath, 'utf8');
  }
  return {
    success,
    numDeploys,
    usage,
    files,
  };
}

const setupRepoDir = wrapTraced(async function setupRepoDir(taskDir: string) {
  const repoDir = path.join(taskDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  await copyFiles(repoDir);
  await installDependencies(repoDir);
  return repoDir;
});

const copyFiles = wrapTraced(async function copyFiles(repoDir: string) {
  logger.info('Setting up template in', repoDir);
  mkdirSync(repoDir, { recursive: true });

  const stdout = execFileSync('/usr/bin/git', ['ls-files'], {
    cwd: TEMPLATE_DIR,
    encoding: 'utf8',
  });
  if (!stdout) {
    throw new Error('No output from git ls-files');
  }
  const templateFiles = stdout
    .trim()
    .split('\n')
    .filter((file) => file.length > 0);
  for (const file of templateFiles) {
    const sourcePath = path.join(TEMPLATE_DIR, file);
    const targetPath = path.join(repoDir, file);

    // Create parent directories if they don't exist
    mkdirSync(path.dirname(targetPath), { recursive: true });

    // Copy the file
    copyFileSync(sourcePath, targetPath);
  }
});

const installDependencies = wrapTraced(async function installDependencies(repoDir: string) {
  execFileSync('npm', ['install'], { cwd: repoDir });
});

async function invokeGenerateText(model: ChefModel, opts: SystemPromptOptions, context: UIMessage[]) {
  return traced(
    async (span) => {
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content: ROLE_SYSTEM_PROMPT,
        },
        {
          role: 'system',
          content: generalSystemPrompt(opts),
        },
        ...cleanupAssistantMessages(context),
      ];
      try {
        const result = await generateText({
          model: model.ai,
          maxTokens: model.maxTokens,
          messages,
          tools: {
            deploy: {
              description: deployToolDescription,
              parameters: deployToolParameters,
            },
            npmInstall: {
              description: npmInstallToolDescription,
              parameters: npmInstallToolParameters,
            },
          },
          maxSteps: 64,
        });
        span.log({
          input: messages,
          output: {
            text: result.text,
            toolCalls: result.toolCalls,
          },
          metrics: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          },
          metadata: {
            model: model.model_slug,
          },
        });
        return result;
      } catch (e: any) {
        span.log({
          input: messages,
        });
        throw e;
      }
    },
    {
      type: 'llm',
      name: model.name,
    },
  );
}

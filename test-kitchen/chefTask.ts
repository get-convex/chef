import { ModelMessage, generateText, LanguageModelUsage } from 'ai';
import * as walkdir from 'walkdir';
import { path } from 'chef-agent/utils/path';
import { ChefResult, ChefModel } from './types';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { ChatContextManager } from 'chef-agent/ChatContextManager';
import { UIMessage } from 'ai';
import { deploy, npmInstall, runTypecheck } from './convexBackend';
import { StreamingMessageParser } from 'chef-agent/message-parser';
import { withConvexBackend } from './convexBackend';
import { initializeConvexAuth } from 'chef-agent/convexAuth';
import { deployTool } from 'chef-agent/tools/deploy';
import { ROLE_SYSTEM_PROMPT } from 'chef-agent/prompts/system';
import { generateId } from 'ai';
import { ConvexToolSet, SystemPromptOptions } from 'chef-agent/types';
import { npmInstallTool, npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import { lookupDocsTool } from 'chef-agent/tools/lookupDocs';
import { getConvexDeploymentNameTool } from 'chef-agent/tools/getConvexDeploymentName';
import { cleanupAssistantMessages } from 'chef-agent/cleanupAssistantMessages';
import { generalSystemPrompt } from 'chef-agent/prompts/system';
import { makePartId } from 'chef-agent/partId';
import { logger } from 'chef-agent/utils/logger';
import { traced, wrapTraced } from 'braintrust';
import { viewTool } from 'chef-agent/tools/view';
import { editTool, editToolParameters } from 'chef-agent/tools/edit';
import { renderFile } from 'chef-agent/utils/renderFile';
import { renderDirectory } from 'chef-agent/utils/renderDirectory';
import { viewParameters } from 'chef-agent/tools/view';
import { lookupDocsParameters, docs, type DocKey } from 'chef-agent/tools/lookupDocs';

const MAX_STEPS = 32;
const MAX_DEPLOYS = 10;
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
          if (data.action.type === 'file' && !IGNORED_FILENAMES.includes(data.action.filePath)) {
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
      enablePreciseEdits: true,
      includeTemplate: true,
      usingOpenAi: model.name.startsWith('gpt-'),
      usingGoogle: model.name.startsWith('gemini-'),

      // TODO: We need to set up a Convex deployment running the `chef`
      // app to setup the OpenAI and Resend proxies + manage their tokens.
      // For now, we are enabling the proxies to mirror the behavior of production. These
      // proxies should never be used in the test kitchen.
      openaiProxyEnabled: true,
      resendProxyEnabled: true,
      smallFiles: true,
    };
    const assistantMessage: UIMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      parts: [],
    };
    let numDeploys = 0;
    let success: boolean;
    let lastDeploySuccess = false;
    let totalUsage: LanguageModelUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    while (true) {
      if (assistantMessage.parts.length >= MAX_STEPS) {
        logger.error('Reached max steps, ending test.');
        success = false;
        break;
      }
      if (numDeploys >= MAX_DEPLOYS) {
        logger.error('Reached max deploys, ending test.');
        success = false;
        break;
      }
      const messages = [initialUserMessage];
      if (assistantMessage.parts.length > 0) {
        messages.push(assistantMessage);
      }
      const minCollapsedMessagesSize = 8192;
      const maxCollapsedMessagesSize = 65536;
      const { messages: context } = contextManager.prepareContext(
        messages,
        maxCollapsedMessagesSize,
        minCollapsedMessagesSize,
      );
      const start = performance.now();
      logger.info('Generating...');
      const response = await invokeGenerateText(model, opts, context);
      const partId = makePartId(assistantMessage.id, assistantMessage.parts.length);
      assistantMessage.content += response.text.text;
      if (response.text.text) {
        assistantMessage.parts.push({
          type: 'text',
          text: response.text.text,
        });
      }
      const parsed = messageParser.parse(partId, response.text.text);
      logger.info(
        `Time taken: ${performance.now() - start}ms\nUsage: ${JSON.stringify(response.usage)}\nMessage: ${parsed}`,
      );
      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;
      totalUsage.totalTokens += response.usage.totalTokens;
      if (response.finishReason == 'stop') {
        success = lastDeploySuccess;
        break;
      }
      if (response.finishReason === 'length') {
        continue;
      }
      if (response.finishReason != 'tool-calls') {
        throw new Error(`Unknown finish reason: ${response.finishReason}`);
      }
      if (response.toolCalls.length < 1) {
        throw new Error('Expected at least one tool call');
      }
      for (const toolCall of response.toolCalls) {
        if (!toolCall) {
          throw new Error('Expected tool call to be non-null');
        }

        let toolCallResult: string;
        try {
          switch (toolCall.toolName) {
            case 'edit': {
              const args = editToolParameters.parse(toolCall.args);
              const filePath = path.join(repoDir, cleanFilePath(args.path));
              let content: string;
              try {
                content = readFileSync(filePath, 'utf8');
              } catch (e) {
                throw new Error(`Could not read ${args.path}: ${e.message}`);
              }

              if (args.old.length > 1024) {
                throw new Error(`Old text must be less than 1024 characters: ${args.old}`);
              }
              if (args.new.length > 1024) {
                throw new Error(`New text must be less than 1024 characters: ${args.new}`);
              }
              const matchPos = content.indexOf(args.old);
              if (matchPos === -1) {
                throw new Error(`Old text not found: ${args.old}`);
              }
              const secondMatchPos = content.indexOf(args.old, matchPos + args.old.length);
              if (secondMatchPos !== -1) {
                throw new Error(`Old text found multiple times: ${args.old}`);
              }
              content = content.replace(args.old, args.new);
              writeFileSync(filePath, content);
              toolCallResult = `Successfully edited ${args.path}`;
              break;
            }
            case 'view': {
              const args = viewParameters.parse(toolCall.args);
              const filePath = path.join(repoDir, cleanFilePath(args.path));
              try {
                const stats = statSync(filePath);
                if (stats.isDirectory()) {
                  const files = walkdir.sync(filePath);
                  toolCallResult = renderDirectory(
                    files.map((file) => ({
                      name: file,
                      isFile: () => !stats.isDirectory(),
                      isDirectory: () => stats.isDirectory(),
                    })),
                  );
                } else {
                  const fileContent = readFileSync(filePath, 'utf8');
                  if (args.view_range && args.view_range.length !== 2) {
                    throw new Error('When provided, view_range must be an array of two numbers');
                  }
                  toolCallResult = renderFile(fileContent, args.view_range as [number, number]);
                }
              } catch (e) {
                throw new Error(`Could not read ${args.path}: ${e.message}`);
              }
              break;
            }
            case 'lookupDocs': {
              const args = lookupDocsParameters.parse(toolCall.args);
              const docsToLookup = args.docs;
              const results: string[] = [];

              for (const doc of docsToLookup) {
                if (doc in docs) {
                  results.push(docs[doc as DocKey]);
                } else {
                  throw new Error(`Could not find documentation for component: ${doc}. It may not yet be supported.`);
                }
              }

              toolCallResult = results.join('\n\n');
              break;
            }
            case 'deploy': {
              numDeploys++;
              try {
                toolCallResult = await deploy(repoDir, backend);
              } catch (e) {
                toolCallResult = `\n\nError: [ConvexTypecheck] ${e.message}`;
                lastDeploySuccess = false;
                break;
              }
              try {
                toolCallResult += await runTypecheck(repoDir);
              } catch (e) {
                toolCallResult += `\n\nError: [FrontendTypecheck] ${e.message}`;
                lastDeploySuccess = false;
                break;
              }
              lastDeploySuccess = true;
              if (numDeploys == 1 && lastDeploySuccess) {
                toolCallResult += '\n\nDev server started successfully!';
              }
              logger.info('Successfully deployed');
              break;
            }
            case 'npmInstall': {
              const args = npmInstallToolParameters.parse(toolCall.args);
              const packages = args.packages.split(' ');
              toolCallResult = await npmInstall(repoDir, packages);
              break;
            }
            case 'getConvexDeploymentName': {
              toolCallResult = backend.project.deploymentName;
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
      const messages: ModelMessage[] = [
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
        const tools: ConvexToolSet = {
          deploy: deployTool,
          npmInstall: npmInstallTool,
          lookupDocs: lookupDocsTool(),
          getConvexDeploymentName: getConvexDeploymentNameTool,
        };
        if (opts.enablePreciseEdits) {
          tools.view = viewTool;
          tools.edit = editTool;
        }
        const result = await generateText({
          model: model.ai,
          maxOutputTokens: model.maxOutputTokens,
          messages,
          tools,
          maxSteps: 64,
        });
        span.log({
          input: messages,
          output: {
            text: result.text.text,
            toolCalls: result.toolCalls,
          },
          metrics: {
            prompt_tokens: result.usage.inputTokens,
            completion_tokens: result.usage.outputTokens,
            total_tokens: result.usage.totalTokens,
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

function cleanFilePath(filePath: string) {
  return filePath.replace('/home/project/', '/');
}

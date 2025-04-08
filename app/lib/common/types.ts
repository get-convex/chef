import type { Tool, ToolCallUnion } from 'ai';
import { z } from 'zod';
import type { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';
import type { fileReplaceStringToolParameters } from '~/lib/runtime/fileReplaceStringTool';
import type { fileReadContentsParameters } from '~/lib/runtime/fileReadContentsTool';
import type { ActionStatus } from '~/lib/runtime/action-runner';

type EmptyArgs = z.ZodObject<Record<string, never>>;

export type ConvexToolSet = {
  deploy: Tool<EmptyArgs, string>;
  file_read_contents: Tool<typeof fileReadContentsParameters, string>;
  npm_install: Tool<typeof npmInstallToolParameters, string>;
  file_replace_string: Tool<typeof fileReplaceStringToolParameters, string>;
};

type ConvexToolCall = ToolCallUnion<ConvexToolSet>;

type ConvexToolResult =
  | {
      toolName: 'deploy';
      args?: EmptyArgs;
      result?: string;
    }
  | {
      toolName: 'file_read_contents';
      args: typeof fileReadContentsParameters;
      result: string;
    }
  | {
      toolName: 'npm_install';
      args: typeof npmInstallToolParameters;
      result: string;
    }
  | {
      toolName: 'file_replace_string';
      args: typeof fileReplaceStringToolParameters;
      result: string;
    };

export type ConvexToolInvocation =
  | ({
      state: 'partial-call';
      step?: number;
    } & ConvexToolCall)
  | ({
      state: 'call';
      step?: number;
    } & ConvexToolCall)
  | ({
      state: 'result';
      step?: number;
    } & ConvexToolResult);

export type ToolStatus = Record<string, ActionStatus>;

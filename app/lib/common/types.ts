import type { Tool, ToolCallUnion } from 'ai';
import { z } from 'zod';
import type { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';
import type { fileReplaceStringToolParameters } from '~/lib/runtime/fileReplaceStringTool';
import type { fileReadContentsParameters } from '~/lib/runtime/fileReadContentsTool';
import type { ActionStatus } from '~/lib/runtime/action-runner';

type EmptyArgs = z.ZodObject<Record<string, never>>;

export type ConvexToolSet = {
  deploy: Tool<EmptyArgs, string>;
  fileReadContents: Tool<typeof fileReadContentsParameters, string>;
  npmInstall: Tool<typeof npmInstallToolParameters, string>;
  fileReplaceString: Tool<typeof fileReplaceStringToolParameters, string>;
};

type ConvexToolCall = ToolCallUnion<ConvexToolSet>;

type ConvexToolResult =
  | {
      toolName: 'deploy';
      args?: EmptyArgs;
      result?: string;
    }
  | {
      toolName: 'fileReadContents';
      args: typeof fileReadContentsParameters;
      result: string;
    }
  | {
      toolName: 'npmInstall';
      args: typeof npmInstallToolParameters;
      result: string;
    }
  | {
      toolName: 'fileReplaceString';
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

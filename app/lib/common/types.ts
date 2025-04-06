import type { Tool, ToolCallUnion } from 'ai';
import { z } from 'zod';
import type { viewParameters } from '~/lib/runtime/viewTool';
import type { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';

type EmptyArgs = z.ZodObject<Record<string, never>>;

export type ConvexToolSet = {
  deploy: Tool<EmptyArgs, string>;
  view: Tool<typeof viewParameters, string>;
  npmInstall: Tool<typeof npmInstallToolParameters, string>;
};

type ConvexToolCall = ToolCallUnion<ConvexToolSet>;

type ConvexToolResult =
  | {
      toolName: 'deploy';
      args?: EmptyArgs;
      result?: string;
    }
  | {
      toolName: 'view';
      args: typeof viewParameters;
      result: string;
    }
  | {
      toolName: 'npmInstall';
      args: typeof npmInstallToolParameters;
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

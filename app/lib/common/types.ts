import type { Tool, ToolCallUnion } from 'ai';
import type { z } from 'zod';
import type { npmInstallToolParameters } from '~/lib/runtime/npmInstallTool';
import type { editToolParameters } from '~/lib/runtime/editTool';
import type { viewParameters } from '~/lib/runtime/viewTool';
import type { ActionStatus } from '~/lib/runtime/action-runner';

type EmptyArgs = z.ZodObject<Record<string, never>>;

export type ConvexToolSet = {
  deploy: Tool<EmptyArgs, string>;
  view: Tool<typeof viewParameters, string>;
  npmInstall: Tool<typeof npmInstallToolParameters, string>;
  edit: Tool<typeof editToolParameters, string>;
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
    }
  | {
      toolName: 'edit';
      args: typeof editToolParameters;
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

import type { ToolCallUnion } from 'ai';
import type { npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import type { editToolParameters } from 'chef-agent/tools/edit';
import type { addEnvironmentVariablesParameters } from 'chef-agent/tools/addEnvironmentVariables';
import type { viewParameters } from 'chef-agent/tools/view';
import type { ActionStatus } from '~/lib/runtime/action-runner';
import type { lookupDocsParameters } from 'chef-agent/tools/lookupDocs';
import type { ConvexToolSet, EmptyArgs } from 'chef-agent/types';
import type { getConvexDeploymentNameParameters } from 'chef-agent/tools/getConvexDeploymentName';

type ConvexToolCall = ToolCallUnion<ConvexToolSet>;

export type ConvexToolName = keyof ConvexToolSet;

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
    }
  | {
      toolName: 'lookupDocs';
      args: typeof lookupDocsParameters;
      result: string;
    }
  | {
      toolName: 'addEnvironmentVariables';
      args: typeof addEnvironmentVariablesParameters;
      result: string;
    }
  | {
      toolName: 'getConvexDeploymentName';
      args: typeof getConvexDeploymentNameParameters;
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

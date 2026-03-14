import type { TypedToolCall } from 'ai';
import type { npmInstallToolParameters } from 'chef-agent/tools/npmInstall';
import type { editToolParameters } from 'chef-agent/tools/edit';
import type { addEnvironmentVariablesParameters } from 'chef-agent/tools/addEnvironmentVariables';
import type { viewParameters } from 'chef-agent/tools/view';
import type { ActionStatus } from '~/lib/runtime/action-runner';
import type { lookupDocsParameters } from 'chef-agent/tools/lookupDocs';
import type { ConvexToolSet, EmptyArgs } from 'chef-agent/types';
import type { getConvexDeploymentNameParameters } from 'chef-agent/tools/getConvexDeploymentName';

type ConvexToolCall = TypedToolCall<ConvexToolSet>;

export type ConvexToolName = keyof ConvexToolSet;

type ConvexToolResult =
  | {
      toolName: 'deploy';
      input?: EmptyArgs;
      output?: string;
    }
  | {
      toolName: 'view';
      input: typeof viewParameters;
      output: string;
    }
  | {
      toolName: 'npmInstall';
      input: typeof npmInstallToolParameters;
      output: string;
    }
  | {
      toolName: 'edit';
      input: typeof editToolParameters;
      output: string;
    }
  | {
      toolName: 'lookupDocs';
      input: typeof lookupDocsParameters;
      output: string;
    }
  | {
      toolName: 'addEnvironmentVariables';
      input: typeof addEnvironmentVariablesParameters;
      output: string;
    }
  | {
      toolName: 'getConvexDeploymentName';
      input: typeof getConvexDeploymentNameParameters;
      output: string;
    };

export type ConvexToolInvocation =
  | ({
      state: 'input-streaming';
      step?: number;
    } & ConvexToolCall)
  | ({
      state: 'input-available';
      step?: number;
    } & ConvexToolCall)
  | ({
      state: 'output-available';
      step?: number;
    } & ConvexToolResult);

export type ToolStatus = Record<string, ActionStatus>;

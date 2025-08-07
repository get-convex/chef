import type { WebContainer } from '@webcontainer/api';
import type { UIMessage } from 'ai';

type ChefDebug = {
  messages?: UIMessage[];
  parsedMessages?: UIMessage[];
  webcontainer?: WebContainer;
  setLogLevel?: (level: any) => void;
  chatInitialId?: string;
  sessionId?: string;
};

export function setChefDebugProperty(key: keyof ChefDebug, value: ChefDebug[keyof ChefDebug]) {
  if (typeof window === 'undefined') {
    console.warn('setChefDebugProperty called on server, ignoring');
    return;
  }
  (window as any).__CHEF_DEBUG = (window as any).__CHEF_DEBUG || {};
  (window as any).__CHEF_DEBUG[key] = value;
}

import { map } from 'nanostores';
import { useStore } from '@nanostores/react';
import type { UsageData } from '~/lib/stores/usage';

const views = ['usage'] as const;
type DebugView = (typeof views)[number];
function defaultObject<const T extends readonly PropertyKey[], V>(array: T, value: V): { [K in T[number]]: V } {
  return Object.fromEntries(array.map((item) => [item, value])) as { [K in T[number]]: V };
}

export const debugVisibilityStore = map<Record<DebugView, boolean>>(defaultObject(views, false));
export const debugOverrideEnabledStore = map<Record<DebugView, boolean>>(defaultObject(views, false));
export const debugOverrideStore = map<{
  usage: UsageData | null;
}>({
  usage: null,
});

// Helper hook to manage debug state for a specific feature
export function useDebugState<T extends DebugView>(view: T) {
  const isVisible = useStore(debugVisibilityStore)[view] ?? false;
  const override = useStore(debugOverrideStore)[view] ?? null;
  const isOverriding = useStore(debugOverrideEnabledStore)[view] ?? false;

  const setVisible = (visible: boolean) => {
    debugVisibilityStore.setKey(view, visible);
  };

  const setOverride = (value: NonNullable<typeof debugOverrideStore.value>[T] | null) => {
    debugOverrideStore.setKey(view, value);
  };

  const setIsOverriding = (enabled: boolean) => {
    debugOverrideEnabledStore.setKey(view, enabled);
  };

  return {
    isVisible,
    override,
    isOverriding,
    setVisible,
    setOverride,
    setIsOverriding,
  };
}

// Register debug functions on window
if (typeof window !== 'undefined') {
  (window as any).__CHEF_DEBUG = (window as any).__CHEF_DEBUG || {};
  (window as any).__CHEF_DEBUG.debugUsage = () => {
    debugVisibilityStore.setKey('usage', true);
    debugOverrideEnabledStore.setKey('usage', true);
  };
}

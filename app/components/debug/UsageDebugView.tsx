import { useState, useEffect } from 'react';
import { useDebugState } from '~/lib/stores/debug';
import { DraggableDebugView } from './DraggableDebugView';
import { useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { serverTeamUsageStore } from '~/lib/stores/usage';

export function UsageDebugView() {
  const { isVisible, setVisible, setOverride, isOverriding, setIsOverriding } = useDebugState('usage');
  const selectedTeamSlug = useSelectedTeamSlug();
  const [overrideValues, setOverrideValues] = useState({
    centitokensUsed: 0,
    centitokensQuota: 100000,
    isPaidPlan: true,
  });

  // Initialize values from store only when first opened
  useEffect(() => {
    if (isVisible && selectedTeamSlug) {
      const current = serverTeamUsageStore.get()[selectedTeamSlug];
      if (current && !current.isLoading) {
        setOverrideValues(current.tokenUsage);
      }
    }
  }, [isVisible, selectedTeamSlug]);

  const handleOverrideChange = (field: keyof typeof overrideValues, value: number | boolean) => {
    const newValues = { ...overrideValues, [field]: value };
    setOverrideValues(newValues);
    setOverride(newValues);
  };

  return (
    <DraggableDebugView
      title="Usage Debug"
      isVisible={isVisible}
      onClose={() => {
        setVisible(false);
        setIsOverriding(false);
      }}
    >
      <div className="space-y-4 p-4">
        <div className="text-sm text-gray-500">Current Team: {selectedTeamSlug || 'None'}</div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isOverriding}
              onChange={(e) => setIsOverriding(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium">Enable Overrides</span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Centitokens Used
            <input
              type="number"
              value={overrideValues.centitokensUsed}
              onChange={(e) => handleOverrideChange('centitokensUsed', Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Centitokens Quota
            <input
              type="number"
              value={overrideValues.centitokensQuota}
              onChange={(e) => handleOverrideChange('centitokensQuota', Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={overrideValues.isPaidPlan}
              onChange={(e) => handleOverrideChange('isPaidPlan', e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium">Paid Plan</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setIsOverriding(false)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Reset
          </button>
        </div>
      </div>
    </DraggableDebugView>
  );
}

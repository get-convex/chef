import { Combobox } from '@ui/Combobox';
import { MagicWandIcon } from '@radix-ui/react-icons';
import type { ModelSelection } from '~/utils/constants';
import React from 'react';
import { Tooltip } from '@ui/Tooltip';

function svgIcon(url: string) {
  return <img className="size-4" height="16" width="16" src={url} alt="" />;
}

export interface ModelSelectorProps {
  modelSelection: ModelSelection;
  setModelSelection: (modelSelection: ModelSelection) => void;
}

const models: Partial<Record<ModelSelection, { name: string; icon: React.ReactNode; experimental: boolean }>> = {
  auto: {
    name: 'Auto',
    icon: <MagicWandIcon />,
    experimental: false,
  },
  'claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    icon: svgIcon('/icons/claude.svg'),
    experimental: false,
  },
  'gpt-4.1': {
    name: 'GPT-4.1',
    icon: svgIcon('/icons/openai.svg'),
    experimental: true,
  },
  'grok-3-mini': {
    name: 'Grok 3 Mini',
    icon: svgIcon('/icons/xai.svg'),
    experimental: true,
  },
} as const;

export const ModelSelector = React.memo(function ModelSelector({
  modelSelection,
  setModelSelection,
}: ModelSelectorProps) {
  const selectedModel = models[modelSelection];
  if (!selectedModel) {
    throw new Error(`Model ${modelSelection} not found`);
  }

  return (
    <Combobox
      searchPlaceholder="Search models..."
      label="Select model"
      options={Object.entries(models).map(([value, model]) => ({
        label: model.name,
        value: value as ModelSelection,
      }))}
      buttonClasses="w-fit"
      selectedOption={modelSelection}
      setSelectedOption={(option) => {
        if (!option) {
          throw new Error('Model selection set to null');
        }

        setModelSelection(option);
      }}
      Option={({ label, value }) => {
        const model = models[value as ModelSelection];
        return (
          <div className="flex items-center gap-2">
            {model?.icon}
            <div className="max-w-48 truncate">{label}</div>
            {model?.experimental && (
              <Tooltip className="ml-auto" side="right" tip="This model is experimental and may not work as expected.">
                <div className="text-content-secondary text-xs">Experimental</div>
              </Tooltip>
            )}
          </div>
        );
      }}
    />
  );
});

import { CaretDownIcon, CheckIcon, MagicWandIcon } from '@radix-ui/react-icons';
import * as Select from '@radix-ui/react-select';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import type { ModelSelection } from '~/utils/constants';

function svgIcon(url: string) {
  return <img className="size-4" height="16" width="16" src={url} alt="" />;
}

export interface ModelSelectorProps {
  modelSelection: ModelSelection;
  setModelSelection: (modelSelection: ModelSelection) => void;
}

export function ModelSelector(props: ModelSelectorProps) {
  const models: Partial<Record<ModelSelection, { name: string; icon: React.ReactNode }>> = {
    auto: {
      name: 'Auto',
      icon: <MagicWandIcon />,
    },
    'claude-3.5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      icon: svgIcon('/icons/claude.svg'),
    },
    'gpt-4.1': {
      name: 'GPT-4.1',
      icon: svgIcon('/icons/openai.svg'),
    },
    'grok-3-mini': {
      name: 'Grok 3 Mini',
      icon: svgIcon('/icons/xai.svg'),
    },
  };
  const [open, setOpen] = useState(false);
  const selectedModel = models[props.modelSelection];
  if (!selectedModel) {
    throw new Error(`Model ${props.modelSelection} not found`);
  }
  return (
    <div className="flex overflow-hidden rounded-md border border-bolt-elements-borderColor text-sm">
      <Select.Root
        value={props.modelSelection}
        open={open}
        onOpenChange={setOpen}
        onValueChange={(value) => {
          props.setModelSelection(value as ModelSelection);
        }}
      >
        <Select.Trigger
          className={classNames(
            'flex items-center gap-2 p-1.5 w-full rounded-md text-left text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background',
            'hover:bg-bolt-elements-item-backgroundAccent/90',
            open ? 'bg-bolt-elements-item-backgroundAccent/90' : '',
          )}
          aria-label="Select model"
        >
          {selectedModel.icon}
          <Select.Value placeholder="Select a model...">{selectedModel.name}</Select.Value>
          <Select.Icon className="ml-auto">
            <CaretDownIcon className={classNames('transition-all', open ? 'rotate-180' : '')} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 max-h-64 min-w-[200px] overflow-y-auto rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-lg"
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport>
              <div className="sticky top-0 z-10 border-b border-b-bolt-elements-borderColor bg-bolt-elements-button-secondary-background p-2">
                <h3 className="text-sm font-medium">Select Model</h3>
              </div>
              {Object.entries(models).map(([slug, model]) => (
                <Select.Item
                  key={slug}
                  value={slug}
                  className={classNames(
                    'flex items-center gap-2 p-2 cursor-pointer outline-none text-sm',
                    'data-[highlighted]:bg-bolt-elements-item-backgroundActive data-[highlighted]:text-bolt-elements-item-contentAccent',
                    'data-[state=checked]:text-bolt-elements-item-contentAccent',
                  )}
                >
                  {model.icon}
                  <div className="max-w-48 truncate">
                    <Select.ItemText>{model.name}</Select.ItemText>
                  </div>
                  <Select.ItemIndicator className="ml-auto">
                    <CheckIcon />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

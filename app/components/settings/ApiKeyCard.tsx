import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';

export function ApiKeyCard() {
  const convex = useConvex();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [alwaysUseKey, setAlwaysUseKey] = useState(false);

  const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);
  useEffect(() => {
    if (apiKey) {
      setAnthropicKey(apiKey.value || '');
      setOpenaiKey(apiKey.openai || '');
      setAlwaysUseKey(apiKey.preference === 'always');
      setIsDirty(false);
    }
  }, [apiKey]);

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: {
          preference: alwaysUseKey ? 'always' : 'quotaExhausted',
          value: anthropicKey,
          openai: openaiKey,
        },
      });
      toast.success('API key saved successfully');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOpenaiApiKey = async () => {
    try {
      await convex.mutation(api.apiKeys.deleteOpenaiApiKeyForCurrentMember);
      toast.success('OpenAI API key removed successfully');
      setOpenaiKey('');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to remove OpenAI API key:', error);
      toast.error('Failed to remove OpenAI API key');
    }
  };

  const handleDeleteAnthropicApiKey = async () => {
    try {
      await convex.mutation(api.apiKeys.deleteAnthropicApiKeyForCurrentMember);
      toast.success('Anthropic API key removed successfully');
      setAnthropicKey('');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to remove Anthropic API key:', error);
      toast.error('Failed to remove Anthropic API key');
    }
  };

  return (
    <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">API Keys</h2>

        <p className="text-bolt-elements-textSecondary text-sm mb-1">
          Chef uses different model providers to generate code. You can use your own API keys to cook with Chef.
        </p>
        <div className="space-y-4">
          <div>
            {apiKey === undefined && <ApiKeyLoading />}
            {apiKey !== undefined && (
              <div>
                <label
                  htmlFor="anthropic-key"
                  className="block text-sm font-medium text-bolt-elements-textSecondary mb-2"
                >
                  Anthropic API Key
                </label>
                <p className="text-bolt-elements-textSecondary text-sm mb-4">
                  See instructions for generating an Anthropic API key{' '}
                  <a
                    href="https://docs.anthropic.com/en/api/getting-started#accessing-the-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    here
                  </a>
                  .
                </p>
                <ApiKeyInput
                  id="anthropic-key"
                  value={anthropicKey}
                  onChange={(value) => {
                    setAnthropicKey(value);
                    setIsDirty(true);
                  }}
                  handleDelete={handleDeleteAnthropicApiKey}
                />

                <label htmlFor="openai-key" className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">
                  OpenAI API Key
                </label>
                <p className="text-bolt-elements-textSecondary text-sm mb-4">
                  See instructions for generating an OpenAI API key{' '}
                  <a
                    href="https://platform.openai.com/docs/api-reference/introduction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    here
                  </a>
                  .
                </p>
                <ApiKeyInput
                  id="openai-key"
                  value={openaiKey}
                  onChange={(value) => {
                    setOpenaiKey(value);
                    setIsDirty(true);
                  }}
                  handleDelete={handleDeleteOpenaiApiKey}
                />
                <AlwaysUseKeyCheckbox
                  disabled={anthropicKey === ''}
                  value={alwaysUseKey}
                  onChange={(value) => {
                    setAlwaysUseKey(value);
                    setIsDirty(true);
                  }}
                />
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isSaving || !isDirty}
                    className="px-2 py-1.5 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bolt-elements-button-primary-background rounded-md transition-colors w-fit"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyLoading() {
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="w-full h-[42px] animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-32 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-4 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="mt-4">
        <button
          disabled
          className="px-2 py-1.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text opacity-50 cursor-not-allowed rounded-md transition-colors w-fit"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ApiKeyInput(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  handleDelete: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  return (
    <div className="relative">
      <input
        type={showKey ? 'text' : 'password'}
        id={props.id}
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-bolt-elements-textPrimary pr-10"
        placeholder="sk-..."
      />
      <button
        type="button"
        onClick={() => setShowKey(!showKey)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary bg-transparent"
      >
        <div className={showKey ? 'i-ph:eye-slash-bold h-4 w-4' : 'i-ph:eye-bold h-4 w-4'} />
      </button>
      {props.value && (
        <button
          onClick={props.handleDelete}
          className="px-2 py-1.5 bg-bolt-elements-button-danger-background hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text rounded-md transition-colors w-fit"
        >
          Remove key
        </button>
      )}
    </div>
  );
}

function AlwaysUseKeyCheckbox(props: { disabled: boolean; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <input
        type="checkbox"
        id="always-use-key"
        checked={props.value}
        onChange={(e) => {
          props.onChange(e.target.checked);
        }}
        disabled={props.disabled}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <label htmlFor="always-use-key" className="text-sm text-bolt-elements-textSecondary">
        Always use my API keys
      </label>
      <TooltipProvider>
        <WithTooltip tooltip="When unchecked, your API key will only be used if you've run out of tokens built into your Convex plan">
          <button
            type="button"
            className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary bg-transparent"
          >
            <div className="i-ph:question-bold h-4 w-4" />
          </button>
        </WithTooltip>
      </TooltipProvider>
    </div>
  );
}

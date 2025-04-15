import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { EyeSlashIcon } from '@heroicons/react/24/outline';
import { EyeOpenIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@convex-dev/design-system/Button';

export function ApiKeyCard() {
  const convex = useConvex();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
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
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-2 text-xl font-semibold text-bolt-elements-textPrimary">API Keys</h2>

        <p className="mb-4 text-sm text-bolt-elements-textSecondary">
          Chef uses different model providers to generate code. You can use your own API keys to cook with Chef.
        </p>
        <div className="space-y-4">
          <div>
            <div>
              <label
                htmlFor="anthropic-key"
                className="mb-1 block text-lg font-medium text-bolt-elements-textSecondary"
              >
                Anthropic API Key
              </label>
              <p className="mb-4 text-sm text-bolt-elements-textSecondary">
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
                isLoading={apiKey === undefined}
                id="anthropic-key"
                value={anthropicKey}
                onChange={(value) => {
                  setAnthropicKey(value);
                  setIsDirty(true);
                }}
                handleDelete={handleDeleteAnthropicApiKey}
              />

              <label
                htmlFor="openai-key"
                className="mb-1 mt-4 block text-lg font-medium text-bolt-elements-textSecondary"
              >
                OpenAI API Key
              </label>
              <p className="mb-4 text-sm text-bolt-elements-textSecondary">
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
                isLoading={apiKey === undefined}
                id="openai-key"
                value={openaiKey}
                onChange={(value) => {
                  setOpenaiKey(value);
                  setIsDirty(true);
                }}
                handleDelete={handleDeleteOpenaiApiKey}
              />

              <AlwaysUseKeyCheckbox
                isLoading={apiKey === undefined}
                disabled={anthropicKey === '' && openaiKey === ''}
                value={alwaysUseKey}
                onChange={(value) => {
                  setAlwaysUseKey(value);
                  setIsDirty(true);
                }}
              />
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={apiKey === undefined || isSaving || !isDirty}
                  className="w-fit rounded-md bg-bolt-elements-button-primary-background px-2 py-1.5 text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bolt-elements-button-primary-background"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyInput(props: {
  isLoading: boolean;
  id: string;
  value: string;
  onChange: (value: string) => void;
  handleDelete: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  if (props.isLoading) {
    return <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type={showKey ? 'text' : 'password'}
          id={props.id}
          value={props.value}
          onChange={(e) => {
            props.onChange(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-bolt-elements-textPrimary dark:border-gray-800 dark:bg-gray-900"
          placeholder="sk-..."
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
        >
          {showKey ? <EyeSlashIcon /> : <EyeOpenIcon />}
        </button>
      </div>
      {props.value && (
        <button
          onClick={props.handleDelete}
          className="w-fit rounded-md bg-bolt-elements-button-danger-background p-2 text-bolt-elements-button-danger-text transition-colors hover:bg-bolt-elements-button-danger-backgroundHover"
        >
          Remove key
        </button>
      )}
    </div>
  );
}

function AlwaysUseKeyCheckbox(props: {
  isLoading: boolean;
  disabled: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  if (props.isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <div className="size-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="size-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }
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
      <Button
        variant="neutral"
        icon={<QuestionMarkCircledIcon />}
        inline
        size="xs"
        tip="When unchecked, your API key will only be used if you've run out of tokens built into your Convex plan"
      />
    </div>
  );
}

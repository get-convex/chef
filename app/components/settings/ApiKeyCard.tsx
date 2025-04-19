import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { EyeSlashIcon } from '@heroicons/react/24/outline';
import { EyeOpenIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { TextInput } from '@ui/TextInput';
import { Checkbox } from '@ui/Checkbox';

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
      setXaiKey(apiKey.xai || '');
      setAlwaysUseKey(apiKey.preference === 'always');
      setIsDirty(false);
    }
  }, [apiKey]);

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [xaiKey, setXaiKey] = useState('');

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: {
          preference: alwaysUseKey ? 'always' : 'quotaExhausted',
          value: anthropicKey,
          openai: openaiKey,
          xai: xaiKey,
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

  const handleDeleteXaiApiKey = async () => {
    try {
      await convex.mutation(api.apiKeys.deleteXaiApiKeyForCurrentMember);
      toast.success('xAI API key removed successfully');
      setXaiKey('');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to remove XAI API key:', error);
      toast.error('Failed to remove xAI API key');
    }
  };

  return (
    <div className="rounded-lg border bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-2 text-xl font-semibold text-content-primary">API Keys</h2>

        <p className="mb-4 text-sm text-content-secondary">
          Chef uses different model providers to generate code. You can use your own API keys to cook with Chef.
        </p>
        <div className="space-y-4">
          <div>
            <div className="flex flex-col gap-4">
              <ApiKeyInput
                label="Anthropic API key"
                description={
                  <>
                    <a
                      href="https://docs.anthropic.com/en/api/getting-started#accessing-the-api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-content-link hover:underline"
                    >
                      See instructions for generating an Anthropic API key
                    </a>
                  </>
                }
                isLoading={apiKey === undefined}
                id="anthropic-key"
                value={anthropicKey}
                onChange={(value) => {
                  setAnthropicKey(value);
                  setIsDirty(true);
                }}
                handleDelete={handleDeleteAnthropicApiKey}
              />

              <ApiKeyInput
                isLoading={apiKey === undefined}
                id="openai-key"
                label="OpenAI API key"
                description={
                  <>
                    <a
                      href="https://platform.openai.com/docs/api-reference/introduction"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-content-link hover:underline"
                    >
                      See instructions for generating an OpenAI API key
                    </a>
                  </>
                }
                value={openaiKey}
                onChange={(value) => {
                  setOpenaiKey(value);
                  setIsDirty(true);
                }}
                handleDelete={handleDeleteOpenaiApiKey}
              />
              <ApiKeyInput
                isLoading={apiKey === undefined}
                id="xai-key"
                label="xAI API key"
                description={
                  <>
                    <a
                      href="https://docs.x.ai/docs/overview#welcome"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-content-link hover:underline"
                    >
                      See instructions for generating an xAI API key
                    </a>
                  </>
                }
                value={xaiKey}
                onChange={(value) => {
                  setXaiKey(value);
                  setIsDirty(true);
                }}
                handleDelete={handleDeleteXaiApiKey}
              />
            </div>
            <AlwaysUseKeyCheckbox
              isLoading={apiKey === undefined}
              disabled={anthropicKey === '' && openaiKey === '' && xaiKey === ''}
              value={alwaysUseKey}
              onChange={(value) => {
                setAlwaysUseKey(value);
                setIsDirty(true);
              }}
            />
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={handleSaveApiKey} disabled={apiKey === undefined || isSaving || !isDirty}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyInput(props: {
  label: string;
  description: React.ReactNode;
  isLoading: boolean;
  id: string;
  value: string;
  onChange: (value: string) => void;
  handleDelete: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  if (props.isLoading) {
    return <div className="h-[78px] w-80 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-80">
        <TextInput
          type={showKey ? 'text' : 'password'}
          id={props.label}
          description={props.description}
          value={props.value}
          onChange={(e) => {
            props.onChange(e.target.value);
          }}
          placeholder={`Enter your ${props.label}`}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error Unclear issue with typing of design system
          action={(): void => {
            setShowKey(!showKey);
          }}
          icon={showKey ? <EyeSlashIcon /> : <EyeOpenIcon />}
        />
      </div>
      {props.value && (
        <Button variant="danger" onClick={props.handleDelete} className="mt-[3px]">
          Remove key
        </Button>
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
      <Checkbox
        checked={props.value}
        onChange={() => {
          props.onChange(!props.value);
        }}
        disabled={props.disabled}
        id="always-use-key"
      />
      <label htmlFor="always-use-key" className="text-sm text-content-secondary">
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

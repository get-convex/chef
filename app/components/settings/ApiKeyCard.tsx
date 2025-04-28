import { useConvex } from 'convex/react';
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { EyeNoneIcon, EyeOpenIcon, PlusIcon, QuestionMarkCircledIcon, TrashIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { TextInput } from '@ui/TextInput';
import { Checkbox } from '@ui/Checkbox';
import { Tooltip } from '@ui/Tooltip';
import { captureException } from '@sentry/remix';

export function ApiKeyCard() {
  const convex = useConvex();

  const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);

  const handleAlwaysUseKeyChange = async (value: boolean) => {
    try {
      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: {
          preference: value ? 'always' : 'quotaExhausted',
          value: apiKey?.value,
          openai: apiKey?.openai,
          xai: apiKey?.xai,
          google: apiKey?.google,
        },
      });
      toast.success('Preference updated.', { id: value ? 'always' : 'quotaExhausted' });
    } catch (error) {
      captureException(error);
      toast.error('Failed to update preference');
    }
  };

  const hasAnyKey = apiKey && (apiKey.value || apiKey.openai || apiKey.xai || apiKey.google);

  return (
    <div className="rounded-lg border bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-2 text-xl font-semibold text-content-primary">API Keys</h2>

        <p className="mb-1 max-w-prose text-sm text-content-secondary">
          You can use your own API keys to cook with Chef.
        </p>
        <p className="mb-4 max-w-prose text-sm text-content-secondary">
          By default, Chef will use tokens built into your Convex plan.
        </p>
        <div className="space-y-4">
          <AlwaysUseKeyCheckbox
            isLoading={apiKey === undefined}
            disabled={!hasAnyKey}
            value={apiKey?.preference === 'always'}
            onChange={handleAlwaysUseKeyChange}
          />
          <ApiKeyItem
            label="Anthropic API key"
            description={
              <a
                href="https://docs.anthropic.com/en/api/getting-started#accessing-the-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-link hover:underline"
              >
                See instructions for generating an Anthropic API key
              </a>
            }
            isLoading={apiKey === undefined}
            keyType="anthropic"
            value={apiKey?.value || ''}
          />

          <ApiKeyItem
            label="Google API key"
            description={
              <a
                href="https://ai.google.dev/gemini-api/docs/api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-link hover:underline"
              >
                See instructions for generating a Google API key
              </a>
            }
            isLoading={apiKey === undefined}
            keyType="google"
            value={apiKey?.google || ''}
          />

          <ApiKeyItem
            label="OpenAI API key"
            description={
              <a
                href="https://platform.openai.com/docs/api-reference/introduction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-link hover:underline"
              >
                See instructions for generating an OpenAI API key
              </a>
            }
            isLoading={apiKey === undefined}
            keyType="openai"
            value={apiKey?.openai || ''}
          />

          <ApiKeyItem
            label="xAI API key"
            description={
              <a
                href="https://docs.x.ai/docs/overview#welcome"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-link hover:underline"
              >
                See instructions for generating an xAI API key
              </a>
            }
            isLoading={apiKey === undefined}
            keyType="xai"
            value={apiKey?.xai || ''}
          />
        </div>
      </div>
    </div>
  );
}

type KeyType = 'anthropic' | 'google' | 'openai' | 'xai';

function ApiKeyItem(props: {
  label: string;
  description: React.ReactNode;
  isLoading: boolean;
  keyType: KeyType;
  value: string;
}) {
  const convex = useConvex();
  const [showKey, setShowKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');

  if (props.isLoading) {
    return <div className="h-[78px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }

  const hasKey = !!props.value;

  const handleRemoveKey = async () => {
    try {
      setIsSaving(true);

      switch (props.keyType) {
        case 'anthropic':
          await convex.mutation(api.apiKeys.deleteAnthropicApiKeyForCurrentMember);
          toast.success('Anthropic API key removed', { id: 'anthropic-removed' });
          break;
        case 'google':
          await convex.mutation(api.apiKeys.deleteGoogleApiKeyForCurrentMember);
          toast.success('Google API key removed', { id: 'google-removed' });
          break;
        case 'openai':
          await convex.mutation(api.apiKeys.deleteOpenaiApiKeyForCurrentMember);
          toast.success('OpenAI API key removed', { id: 'openai-removed' });
          break;
        case 'xai':
          await convex.mutation(api.apiKeys.deleteXaiApiKeyForCurrentMember);
          toast.success('xAI API key removed', { id: 'xai-removed' });
          break;
      }
    } catch (error) {
      captureException(error);
      toast.error(`Failed to remove ${props.keyType} API key`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKey = async () => {
    try {
      setIsSaving(true);

      const apiKeyMutation = {
        preference: 'quotaExhausted' as 'always' | 'quotaExhausted',
        value: undefined as string | undefined,
        openai: undefined as string | undefined,
        xai: undefined as string | undefined,
        google: undefined as string | undefined,
      };

      switch (props.keyType) {
        case 'anthropic':
          apiKeyMutation.value = cleanApiKey(newKeyValue);
          break;
        case 'google':
          apiKeyMutation.google = cleanApiKey(newKeyValue);
          break;
        case 'openai':
          apiKeyMutation.openai = cleanApiKey(newKeyValue);
          break;
        case 'xai':
          apiKeyMutation.xai = cleanApiKey(newKeyValue);
          break;
      }

      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: apiKeyMutation,
      });

      toast.success(`${props.label} saved`, { id: props.keyType });
      setIsAdding(false);
      setNewKeyValue('');
    } catch (error) {
      captureException(error);
      toast.error(`Failed to save ${props.keyType} API key`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewKeyValue('');
  };

  return (
    <div>
      <div className="mb-1.5">
        <span className="font-medium text-content-primary">{props.label}</span>
      </div>
      <div className="mb-2 text-xs text-content-secondary">{props.description}</div>

      {hasKey ? (
        <div className="flex items-center gap-2 py-1.5">
          <span className="max-w-80 truncate font-mono" aria-label="API key value">
            {showKey ? props.value : '•'.repeat(props.value.length)}
          </span>
          <Button
            onClick={() => setShowKey(!showKey)}
            icon={showKey ? <EyeNoneIcon /> : <EyeOpenIcon />}
            variant="neutral"
            inline
          />
          <Button variant="danger" onClick={handleRemoveKey} disabled={isSaving} icon={<TrashIcon />} inline />
        </div>
      ) : isAdding ? (
        <div className="flex items-end gap-2">
          <div className="w-80">
            <TextInput
              type={showKey ? 'text' : 'password'}
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder={`Enter your ${props.label}`}
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error Unclear issue with typing of design system
              action={(): void => {
                setShowKey(!showKey);
              }}
              icon={showKey ? <EyeNoneIcon /> : <EyeOpenIcon />}
            />
          </div>
          <Button onClick={handleSaveKey} disabled={isSaving || !newKeyValue.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="neutral" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="neutral" onClick={() => setIsAdding(true)} icon={<PlusIcon />}>
          Add {props.label}
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
    <Tooltip
      tip={props.disabled ? "You cannot use this setting when you don't have any API keys configured." : undefined}
    >
      <div className="flex items-center gap-2">
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
        <Tooltip tip="When unchecked, your API key will only be used if you've run out of tokens built into your Convex plan">
          <QuestionMarkCircledIcon />
        </Tooltip>
      </div>
    </Tooltip>
  );
}

function cleanApiKey(key: string) {
  return key.trim() === '' ? undefined : key;
}

import { useState } from 'react';
import { useConvex } from 'convex/react';
import { Button } from '@ui/Button';
import { TextInput } from '@ui/TextInput';
import { toast } from 'sonner';
import { EyeNoneIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { api } from '@convex/_generated/api';
import { captureException } from '@sentry/remix';
import { type ModelProvider, displayModelProviderName } from './ModelSelector';
import { KeyIcon } from '@heroicons/react/24/outline';
import type { Doc } from '@convex/_generated/dataModel';
import { ConfirmationDialog } from '@ui/ConfirmationDialog';
import { useLaunchDarkly } from '~/lib/hooks/useLaunchDarkly';

export interface MissingApiKeyProps {
  provider: ModelProvider;
  requireKey: boolean;
  resetDisableChatMessage: () => void;
}

export function MissingApiKey({ provider, requireKey, resetDisableChatMessage }: MissingApiKeyProps) {
  const [isAdding, setIsAdding] = useState(requireKey);
  const [isSaving, setIsSaving] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const convex = useConvex();
  const { useGeminiAuto } = useLaunchDarkly();

  const handleSaveKey = async () => {
    try {
      setIsSaving(true);

      // Get the current API key data
      const apiKey = await convex.query(api.apiKeys.apiKeyForCurrentMember);

      const apiKeyMutation: Doc<'convexMembers'>['apiKey'] = {
        preference: apiKey?.preference || ('quotaExhausted' as 'always' | 'quotaExhausted'),
        value: apiKey?.value || undefined,
        openai: apiKey?.openai || undefined,
        xai: apiKey?.xai || undefined,
        google: apiKey?.google || undefined,
      };

      switch (provider) {
        case 'anthropic':
          apiKeyMutation.value = newKeyValue.trim();
          break;
        case 'google':
          apiKeyMutation.google = newKeyValue.trim();
          break;
        case 'openai':
          apiKeyMutation.openai = newKeyValue.trim();
          break;
        case 'xai':
          apiKeyMutation.xai = newKeyValue.trim();
          break;
        case 'auto':
          if (useGeminiAuto) {
            apiKeyMutation.google = newKeyValue.trim();
          } else {
            apiKeyMutation.value = newKeyValue.trim();
          }
          break;
        default: {
          const _exhaustiveCheck: never = provider;
          throw new Error(`Unknown provider: ${_exhaustiveCheck}`);
        }
      }

      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: apiKeyMutation,
      });

      toast.success(`${displayModelProviderName(provider)} API key saved`);
      setIsAdding(false);
      setNewKeyValue('');
      resetDisableChatMessage();
    } catch (error) {
      captureException(error as Error);
      toast.error(`Failed to save ${displayModelProviderName(provider)} API key`);
    } finally {
      setIsSaving(false);
    }
  };

  const [isChangingPreference, setIsChangingPreference] = useState(false);

  const handleUseConvexTokens = async () => {
    try {
      setIsSaving(true);

      // Get the current API key data
      const apiKey = await convex.query(api.apiKeys.apiKeyForCurrentMember);

      // Change preference to 'quotaExhausted' but keep all the existing keys
      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: {
          preference: 'quotaExhausted',
          value: apiKey?.value,
          openai: apiKey?.openai,
          xai: apiKey?.xai,
          google: apiKey?.google,
        },
      });

      toast.success('Preference updated. Now using Convex tokens.');
      resetDisableChatMessage();
    } catch (error) {
      captureException(error as Error);
      toast.error('Failed to update preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewKeyValue('');
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h4>{requireKey ? 'Add an API key to use this model' : 'Choose an option to continue'}</h4>
        <p className="max-w-prose text-pretty">
          {requireKey ? (
            <>
              This model can only be used with your own API key. Please add an API key for{' '}
              <span className="font-semibold">{displayModelProviderName(provider)}</span> to continue.
            </>
          ) : (
            <>
              You&apos;ve chosen to always use your own API keys, but haven&apos;t set a{' '}
              <span className="font-semibold">{displayModelProviderName(provider)}</span> API key yet. You may choose to
              use a different model provider, use Chef tokens instead of your own API keys, or add an API key for{' '}
              <span className="font-semibold">{displayModelProviderName(provider)}</span>.
            </>
          )}
        </p>
      </div>

      {isChangingPreference && (
        <ConfirmationDialog
          onClose={() => setIsChangingPreference(false)}
          onConfirm={handleUseConvexTokens}
          variant="primary"
          confirmText="Confirm"
          dialogTitle={'Change Chef token preference'}
          dialogBody={
            'Confirming will disable your preference to always use your own API keys. Instead, Chef will prefer using Chef tokens when built-in quota is available.'
          }
        />
      )}

      {!isAdding ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button className="w-fit" onClick={() => setIsAdding(true)} icon={<KeyIcon className="size-4" />}>
            Add {displayModelProviderName(provider)} API key
          </Button>
          <Button
            variant="neutral"
            className="w-fit"
            onClick={() => setIsChangingPreference(true)}
            disabled={isSaving}
            loading={isSaving}
            icon={
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M23.6915 7.38004C23.1793 4.76192 20.1058 2.71297 16.3494 2.71297C12.593 2.71297 11.5685 3.62362 10.2594 5.04651C8.89344 5.16034 7.58438 5.55874 6.44607 6.35556C4.79552 7.49387 3.65721 9.25825 3.31571 11.2503C2.97422 13.2423 3.37264 15.2344 4.56786 16.8849C5.13702 17.7387 5.93385 18.4217 6.78758 18.9908L5.47853 26.1622C5.30778 27.1866 8.66579 28.6095 13.0483 29.4063C17.3739 30.2032 21.0734 30.0324 21.2441 29.0079L22.5532 21.8366C25.7405 21.1536 28.3016 18.4217 28.5293 15.0067C28.757 11.5918 26.708 8.57526 23.6915 7.38004Z"
                  stroke="currentColor"
                  fill="none"
                />
                <path
                  d="M25.0576 5.50184C23.4071 3.28214 20.9027 1.68851 18.1139 1.17627C15.2681 0.664028 12.4223 1.2901 10.0888 2.7699C8.32441 2.88373 6.67387 3.45289 5.19407 4.47737C3.03128 5.95717 1.60837 8.23379 1.15305 10.795C0.697724 13.3562 1.26687 15.9743 2.74668 18.1371C3.42966 19.1616 4.34033 20.0153 5.36481 20.6983L4.39724 26.0483C4.22649 27.0728 5.08024 29.0649 12.8777 30.4877C14.8128 30.8292 16.691 31 18.1708 31C19.6506 31 18.5692 31 18.74 31C20.1628 31 22.098 30.7154 22.3256 29.2925L23.2932 23.9425C27.3342 22.9749 30.4646 19.5031 30.7492 15.1206C31.0337 10.9088 28.6433 7.1524 25.0576 5.44493V5.50184ZM20.1059 28.6095C19.366 28.8372 16.9187 28.951 13.1622 28.325C9.46274 27.642 7.18609 26.6744 6.56002 26.2191L6.7877 24.91C8.09676 25.5361 10.2595 26.3329 13.3899 26.9021C15.4958 27.3005 17.2032 27.4143 18.5692 27.4143C19.9352 27.4143 19.8214 27.4143 20.2767 27.3574L20.049 28.6665L20.1059 28.6095ZM20.7889 24.967C19.6506 25.0808 17.2601 25.2515 13.8452 24.6255C10.4303 23.9994 8.26749 23.0318 7.24302 22.5196L7.35685 21.8366L7.58449 20.4137C8.66589 21.4382 10.0888 22.1212 11.6255 22.3488C12.4223 22.5196 13.276 22.5196 14.1298 22.4627C14.9835 22.8611 15.8373 23.1457 16.7479 23.3164C17.2032 23.3733 17.7155 23.4302 18.1708 23.4302C19.1953 23.4302 20.1629 23.2595 21.0735 22.8611L20.8458 24.1701L20.732 24.8531L20.7889 24.967ZM28.4725 15.0067C28.2449 18.2509 25.9682 20.8121 23.0656 21.7228C23.6916 21.0967 24.1469 20.3568 24.4315 19.56C24.6022 18.9339 24.2608 18.3078 23.6347 18.1371C23.0086 17.9663 22.3826 18.3078 22.2118 18.9339C21.9842 19.7876 21.3012 20.5275 20.2767 20.9259C19.423 21.2674 18.4554 21.3813 17.4878 21.2674C17.0325 21.2674 16.5771 21.0967 16.1218 20.9259C16.008 20.9259 15.8373 20.8121 15.7234 20.7552L16.1218 18.7062C16.2357 18.0802 15.8373 17.511 15.2112 17.3972C14.5851 17.2834 14.016 17.6818 13.9021 18.3078L13.5606 20.3568C13.4468 20.3568 13.2761 20.3568 13.1622 20.3568C12.7069 20.3568 12.2516 20.2999 11.8532 20.1861C10.8856 19.9584 9.97495 19.5031 9.29196 18.877C8.49514 18.1371 8.09673 17.2264 8.15365 16.4296C8.15365 15.8036 7.69835 15.2913 7.07228 15.2344C6.44621 15.2344 5.93394 15.6897 5.87703 16.3158C5.87703 17.1695 6.0478 18.0802 6.50312 18.877C5.82013 18.3647 5.19406 17.7956 4.68182 17.0557C3.54351 15.4051 3.08818 13.4131 3.42967 11.4211C3.77116 9.42902 4.90947 7.72155 6.56002 6.52632C6.61694 6.52632 6.73078 6.41249 6.7877 6.35557C6.67387 6.8109 6.78769 7.32314 7.24302 7.60772C7.75526 7.94921 8.49515 7.83538 8.83664 7.32314V7.20931C9.46271 6.41249 10.1457 5.72951 10.8856 5.16035C11.967 4.36354 13.1622 3.85129 14.4713 3.56672C15.5527 3.33905 16.6341 3.33905 17.7724 3.56672C18.8538 3.73746 19.9352 4.19279 20.8458 4.76195C21.9841 5.44493 22.9517 6.41249 23.6347 7.49388C24.147 8.2907 24.5453 9.20135 24.8299 10.112C24.9438 10.6242 25.3991 10.9657 25.9113 10.9657C26.4236 10.9657 26.0821 10.9657 26.1959 10.9657C26.6512 10.8519 26.9927 10.4535 27.0496 9.99817C28.131 11.4211 28.7002 13.1854 28.5863 15.1206L28.4725 15.0067Z"
                  fill="currentColor"
                />
              </svg>
            }
          >
            Use Chef Tokens instead
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="w-80">
            <TextInput
              autoFocus
              type={showKey ? 'text' : 'password'}
              // TODO: Remove when gap in design system is fixed
              className="h-[34px]"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder={`Enter your ${displayModelProviderName(provider)} API key`}
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error Unclear issue with typing of design system
              action={(): void => {
                setShowKey(!showKey);
              }}
              icon={showKey ? <EyeNoneIcon /> : <EyeOpenIcon />}
            />
          </div>
          <Button onClick={handleSaveKey} disabled={isSaving || !newKeyValue.trim()} loading={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {!requireKey && (
            <Button variant="neutral" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </>
  );
}

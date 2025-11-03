import { Button } from "@convex-dev/design-system";
import { useStore } from "@nanostores/react";
import { $selectedProvider, setProvider } from "../stores/providerStore";

export const ProviderSelector = () => {
  const selectedProvider = useStore($selectedProvider);

  return (
    <div className="flex gap-2">
      <Button
        variant={selectedProvider === 'openai' ? 'primary' : 'secondary'}
        onClick={() => setProvider('openai')}
      >
        OpenAI
      </Button>
      <Button
        variant={selectedProvider === 'anthropic' ? 'primary' : 'secondary'}
        onClick={() => setProvider('anthropic')}
      >
        Anthropic
      </Button>
      <Button
        variant={selectedProvider === 'openrouter' ? 'primary' : 'secondary'}
        onClick={() => setProvider('openrouter')}
      >
        OpenRouter
      </Button>
    </div>
  );
};
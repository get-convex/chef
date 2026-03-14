import { ApiKeyForm } from "../components/ApiKeyForm";
import { $apiKeys } from "../stores/apiKeyStore";

export const SettingsRoute = () => {
  return (
    <div>
      <h2>API Keys</h2>
      <ApiKeyForm 
        provider="openai" 
        label="OpenAI" 
      />
      <ApiKeyForm 
        provider="anthropic" 
        label="Anthropic" 
      />
      <ApiKeyForm 
        provider="openrouter" 
        providerName="OpenRouter"
        label="OpenRouter" 
      />
    </div>
  );
};
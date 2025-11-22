type kwAIConfiguration = { provider, model, url, apiKey, alias };

type kwAIConfigurations = 'provider' | 'model' | 'url' | 'apiKey' | 'alias';

type kwAIModelResponse = {
  data: {
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }[];
  object: string;
};

type kwAIStoredModel = {
  provider: string;
  url: string;
  apiKey: string;
  model: string;
  apiVersion: string;
  alias: string;
}

type kwAIStoredModels = {
  defaultProvider: string;
  providerCollection: {
    [uuid: string]: kwAIStoredModel;
  }
};

interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant" | "system"
  timestamp: Date,
  isNotVisible?: boolean,
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
  error?: boolean;
  reasoning?: string;
  isReasoning?: boolean;
}

type kwAIStoredChatHistory = {
  [clusterConfig: string]: {
    [key: string]: {
      messages: ChatMessage[];
      provider: string;
    };
  }
};

type kwAIModel = {
  label: string;
  value: string;
};

export {
  kwAIModel,
  kwAIConfiguration,
  kwAIConfigurations,
  kwAIModelResponse,
  kwAIStoredModel,
  kwAIStoredModels,
  kwAIStoredChatHistory,
  ChatMessage
};

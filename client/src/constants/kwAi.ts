import { PROVIDER_ICONS } from "@/components/app/kwAI/Configuration/icons";

const KW_AI_PROVIDERS = [
  {
    value: "xai",
    label: "xAI Grok",
    providerDefaultUrl: "https://api.x.ai",
    urlHint: "xAI's official API endpoint. Default: https://api.x.ai",
    icon: PROVIDER_ICONS.xai
  },
  {
    value: "openai",
    label: "OpenAI",
    providerDefaultUrl: "https://api.openai.com/v1",
    urlHint: "OpenAI API base. Use a proxy URL if routing through a gateway. Default: https://api.openai.com/v1",
    icon: PROVIDER_ICONS.openai
  },
  {
    value: "azure",
    label: "Azure",
    providerDefaultUrl: "",
    urlHint: "Your Azure OpenAI resource endpoint. Format: https://{resource-name}.openai.azure.com/openai/deployments",
    icon: PROVIDER_ICONS.azure
  },
  {
    value: "anthropic",
    label: "Anthropic",
    providerDefaultUrl: "https://api.anthropic.com/v1",
    urlHint: "Anthropic's Claude API. Use a proxy or router URL if applicable. Default: https://api.anthropic.com/v1",
    icon: PROVIDER_ICONS.anthropic
  },
  // {
  //   value: "amazon-bedrock",
  //   label: "Amazon Bedrock",
  //   providerDefaultUrl: "",
  //   urlHint: ""
  // },
  {
    value: "groq",
    label: "Groq",
    providerDefaultUrl: "https://api.groq.com/openai/v1",
    urlHint: "Groq's OpenAI-compatible inference API. Default: https://api.groq.com/openai/v1",
    icon: PROVIDER_ICONS.groq
  },
  {
    value: "deepinfra",
    label: "DeepInfra",
    providerDefaultUrl: "https://api.deepinfra.com/v1/openai",
    urlHint: "DeepInfra's OpenAI-compatible endpoint. Default: https://api.deepinfra.com/v1/openai",
    icon: PROVIDER_ICONS.deepinfra
  },
  // {
  //   value: "google-vertex",
  //   label: "Google Vertex",
  //   providerDefaultUrl: "",
  //   urlHint: ""
  // },
  {
    value: "mistral",
    label: "Mistral AI",
    providerDefaultUrl: "https://api.mistral.ai/v1",
    urlHint: "Mistral's hosted API. Default: https://api.mistral.ai/v1",
    icon: PROVIDER_ICONS.mistral
  },
  {
    value: "togetherai",
    label: "Together.ai",
    providerDefaultUrl: "https://api.together.xyz/v1",
    urlHint: "Together.ai inference API. Default: https://api.together.xyz/v1",
    icon: PROVIDER_ICONS.togetherai
  },
  {
    value: "cohere",
    label: "Cohere",
    providerDefaultUrl: "https://api.cohere.com/v2",
    urlHint: "Cohere v2 API endpoint. Default: https://api.cohere.com/v2",
    icon: PROVIDER_ICONS.cohere
  },
  {
    value: "fireworks",
    label: "Fireworks",
    providerDefaultUrl: "https://api.fireworks.ai/inference/v1",
    urlHint: "Fireworks AI inference endpoint. Default: https://api.fireworks.ai/inference/v1",
    icon: PROVIDER_ICONS.fireworks
  },
  {
    value: "deepseek",
    label: "Deepseek",
    providerDefaultUrl: "https://api.deepseek.com/v1",
    urlHint: "DeepSeek's API. Default: https://api.deepseek.com/v1",
    icon: PROVIDER_ICONS.deepseek
  },
  {
    value: "cerebras",
    label: "Cerebras",
    providerDefaultUrl: "https://api.cerebras.ai/v1",
    urlHint: "Cerebras inference API. Default: https://api.cerebras.ai/v1",
    icon: PROVIDER_ICONS.cerebras
  },
  {
    value: "ollama",
    label: "Ollama",
    providerDefaultUrl: "http://127.0.0.1:11434/v1",
    urlHint: "Local Ollama server. Change the host/port if running remotely. Default: http://127.0.0.1:11434/v1",
    icon: PROVIDER_ICONS.ollama
  },
  {
    value: "lmstudio",
    label: "LM Studio",
    providerDefaultUrl: "https://localhost:1234/v1",
    urlHint: "Local LM Studio server. Adjust if using a different port. Default: https://localhost:1234/v1",
    icon: PROVIDER_ICONS.lmstudio
  },
  {
    value: "openrouter",
    label: "Open Router",
    providerDefaultUrl: "https://openrouter.ai/api/v1",
    urlHint: "OpenRouter gateway — routes to multiple providers. Default: https://openrouter.ai/api/v1",
    icon: PROVIDER_ICONS.openrouter
  }
];

export {
  KW_AI_PROVIDERS
};

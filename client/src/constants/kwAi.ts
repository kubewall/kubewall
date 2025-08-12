const KW_AI_PROVIDERS = [
  {
    value: "xai",
    label: "xAI Grok",
    providerDefaultUrl: "https://api.x.ai"
  },
  {
    value: "openai",
    label: "OpenAI",
    providerDefaultUrl: "https://api.openai.com/v1"
  },
  {
    value: "azure",
    label: "Azure",
    providerDefaultUrl: ""
  },
  {
    value: "anthropic",
    label: "Anthropic",
    providerDefaultUrl: "https://api.anthropic.com/v1"
  },
  // {
  //   value: "amazon-bedrock",
  //   label: "Amazon Bedrock,"
  //  providerDefaultUrl: ""
  // },
  { 
    value: "groq",
    label: "Groq",
    providerDefaultUrl: "https://api.groq.com/openai/v1"
  },
  {
    value: "deepinfra",
    label: "DeepInfra",
    providerDefaultUrl: "https://api.deepinfra.com/v1/openai"
  },
  // {
  //   value: "google-vertex",
  //   label: "Google Vertex,"
  //  providerDefaultUrl: ""
  // },
  {
    value: "mistral",
    label: "Mistral AI",
    providerDefaultUrl: "https://api.mistral.ai/v1"
  },
  {
    value: "togetherai",
    label: "Together.ai",
    providerDefaultUrl: "https://api.together.xyz/v1"
  },
  {
    value: "cohere",
    label: "Cohere",
    providerDefaultUrl: "https://api.cohere.com/v2"
  },
  {
    value: "fireworks",
    label: "Fireworks",
    providerDefaultUrl: "https://api.fireworks.ai/inference/v1"
  },
  {
    value: "deepseek",
    label: "Deepseek",
    providerDefaultUrl: "https://api.deepseek.com/v1"
  },
  {
    value: "cerebras",
    label: "Cerebras",
    providerDefaultUrl: "https://api.cerebras.ai/v1"
  },
  {
    value: "ollama",
    label: "Ollama",
    providerDefaultUrl: "http://127.0.0.1:11434/v1"
  },
  {
    value: "lmstudio",
    label: "LM Studio",
    providerDefaultUrl: "https://localhost:1234/v1"
  },
  {
    value:"openrouter",
    label: "Open Router",
    providerDefaultUrl: "https://openrouter.ai/api/v1"
  }
];

export {
  KW_AI_PROVIDERS
};

import { kwAIModelResponse } from "@/types/kwAI/addConfiguration";

const formatKwAIModels = (kwAIModelsResponse: kwAIModelResponse) => {
  try {
    if (!kwAIModelsResponse?.data || !Array.isArray(kwAIModelsResponse.data)) {
      console.warn('Invalid model response format or empty response, using default models:', kwAIModelsResponse);
      return [];
    }
    const models = kwAIModelsResponse.data
      .map(({ id }) => ({
        label: id,
        value: id
      }));
        
    // If no Anthropic models found, return default models
    if (models.length === 0) {
      console.log('No models found, using default models');
      return [];
    }
    
    return models;
  } catch (error) {
    console.error('Error formatting models:', error);
    return [];
  }
};

export {
  formatKwAIModels
};

import { kwAIModelResponse } from "@/types/kwAI/addConfiguration";

const formatKwAIModels = (kwAIModelsResponse: kwAIModelResponse) => {
  return kwAIModelsResponse.data.map(({ id}) => ({
    label: id,
    value: id
  }));
};

export {
  formatKwAIModels
};

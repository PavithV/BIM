export const AI_MODELS = [
    { id: "azure.gpt-4.1-mini", label: "GPT-4.1 Mini (Standard)" },
    { id: "azure.gpt-4.1", label: "GPT-4.1" },
    { id: "azure.gpt-5.1", label: "GPT-5.1" },
] as const;

export const DEFAULT_MODEL = "azure.gpt-4.1-mini";
export type AIModelId = (typeof AI_MODELS)[number]["id"];

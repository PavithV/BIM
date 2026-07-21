export const AI_MODELS = [
    { id: "google.claude-haiku-4.5", label: "Claude Haiku 4.5 (Standard)" },
    { id: "standard-extern", label: "GPT-5 Mini" },
    { id: "azure.gpt-5.1", label: "GPT-5.1" },
] as const;

export const DEFAULT_MODEL = "google.claude-haiku-4.5";
export type AIModelId = (typeof AI_MODELS)[number]["id"];
